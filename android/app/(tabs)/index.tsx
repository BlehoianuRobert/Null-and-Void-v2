import * as Haptics from 'expo-haptics';
import { Accelerometer } from 'expo-sensors';
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

/** Defaults match typical Docker deploy; override with EXPO_PUBLIC_* in android/.env or EAS secrets. */
const DEFAULT_API_BASE = 'http://10.136.37.252:3000';
const DEFAULT_DEVICE_API_KEY = 'change-me';

const API_BASE = (process.env.EXPO_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE).replace(/\/$/, '');
const DEVICE_API_KEY = process.env.EXPO_PUBLIC_DEVICE_API_KEY ?? DEFAULT_DEVICE_API_KEY;
const BLIND_USER_ID = (process.env.EXPO_PUBLIC_BLIND_USER_ID ?? '').trim();

const MOTION_COOLDOWN_MS = 90_000;
const SUPPRESS_AFTER_OK_MS = 10 * 60 * 1000;

async function postPhoneLocation(body: {
  blindUserId: string;
  latitude: number;
  longitude: number;
  accuracyM?: number;
  speedMps?: number;
  sentAt: string;
}) {
  const url = `${API_BASE}/api/phone/location`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${DEVICE_API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(t || `HTTP ${res.status}`);
  }
}

async function postPhoneMotion(body: {
  blindUserId: string;
  peakMagnitudeMs2: number;
  deltaMs2?: number;
  reason: string;
  latitude?: number;
  longitude?: number;
  triggeredAt: string;
}) {
  const url = `${API_BASE}/api/phone/motion`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${DEVICE_API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(t || `HTTP ${res.status}`);
  }
}

export default function TrackScreen() {
  const [tracking, setTracking] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [lastOk, setLastOk] = useState<string | null>(null);
  const [lastErr, setLastErr] = useState<string | null>(null);
  const [fallModal, setFallModal] = useState<{ visible: boolean; detail: string }>({
    visible: false,
    detail: '',
  });

  const subRef = useRef<Location.LocationSubscription | null>(null);
  const lastGeoRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const lastFireAtRef = useRef(0);
  const suppressUntilRef = useRef(0);
  const prevMagRef = useRef<number | null>(null);
  const lastLowGAtRef = useRef<number | null>(null);

  const configOk = Boolean(BLIND_USER_ID);

  const stop = useCallback(async () => {
    subRef.current?.remove();
    subRef.current = null;
    setTracking(false);
    setStatus('Stopped');
    prevMagRef.current = null;
    lastLowGAtRef.current = null;
  }, []);

  const sendOnce = useCallback(async () => {
    if (!configOk) return;
    setLastErr(null);
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    lastGeoRef.current = {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    };
    const sentAt = new Date().toISOString();
    await postPhoneLocation({
      blindUserId: BLIND_USER_ID,
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracyM: loc.coords.accuracy ?? undefined,
      speedMps: loc.coords.speed ?? undefined,
      sentAt,
    });
    setLastOk(new Date().toLocaleTimeString());
  }, [configOk]);

  const start = useCallback(async () => {
    if (!configOk) {
      setLastErr('Set the patient ID: add EXPO_PUBLIC_BLIND_USER_ID (from web → My users) in android/.env, then restart with npx expo start -c');
      return;
    }
    setLastErr(null);
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') {
      setLastErr('Location permission denied');
      setStatus('Open system settings to allow location');
      return;
    }

    await sendOnce().catch((e: unknown) => {
      setLastErr(e instanceof Error ? e.message : 'Send failed');
    });

    subRef.current?.remove();
    subRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 15_000,
        distanceInterval: 5,
      },
      async (loc) => {
        lastGeoRef.current = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        try {
          const sentAt = new Date().toISOString();
          await postPhoneLocation({
            blindUserId: BLIND_USER_ID,
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            accuracyM: loc.coords.accuracy ?? undefined,
            speedMps: loc.coords.speed ?? undefined,
            sentAt,
          });
          setLastOk(new Date().toLocaleTimeString());
          setLastErr(null);
        } catch (e: unknown) {
          setLastErr(e instanceof Error ? e.message : 'Send failed');
        }
      }
    );
    setTracking(true);
    setStatus('Tracking (GPS + fall sensor)');
  }, [configOk, sendOnce]);

  useEffect(() => {
    return () => {
      void stop();
    };
  }, [stop]);

  useEffect(() => {
    if (!tracking || !configOk) {
      prevMagRef.current = null;
      lastLowGAtRef.current = null;
      return;
    }

    let accelSub: { remove: () => void } | null = null;
    let cancelled = false;

    void (async () => {
      const available = await Accelerometer.isAvailableAsync();
      if (cancelled || !available) return;

      Accelerometer.setUpdateInterval(100);
      if (cancelled) return;

      accelSub = Accelerometer.addListener(({ x, y, z }) => {
        const mag = Math.sqrt(x * x + y * y + z * z);
        const now = Date.now();

        if (now < suppressUntilRef.current) {
          prevMagRef.current = mag;
          return;
        }
        if (now - lastFireAtRef.current < MOTION_COOLDOWN_MS) {
          prevMagRef.current = mag;
          return;
        }

        if (mag < 5.5) lastLowGAtRef.current = now;

        const prev = prevMagRef.current;
        let reason: string | null = null;
        let delta: number | undefined;

        if (mag > 32 && lastLowGAtRef.current != null && now - lastLowGAtRef.current < 850) {
          reason = 'LOW_G_THEN_IMPACT';
        } else if (prev != null && mag > 30 && mag - prev > 18) {
          reason = 'SUDDEN_IMPACT';
          delta = mag - prev;
        }

        prevMagRef.current = mag;
        if (!reason) return;

        lastFireAtRef.current = now;
        lastLowGAtRef.current = null;

        const geo = lastGeoRef.current;
        const triggeredAt = new Date().toISOString();

        void postPhoneMotion({
          blindUserId: BLIND_USER_ID,
          peakMagnitudeMs2: mag,
          deltaMs2: delta,
          reason,
          latitude: geo?.latitude,
          longitude: geo?.longitude,
          triggeredAt,
        })
          .then(() => {
            setFallModal({
              visible: true,
              detail: `Possible accident (${reason}). Peak acceleration ≈ ${mag.toFixed(1)} m/s² (includes gravity). Not a medical diagnosis.`,
            });
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          })
          .catch((e: unknown) => {
            setLastErr(e instanceof Error ? e.message : 'Motion alert failed');
          });
      });
    })();

    return () => {
      cancelled = true;
      accelSub?.remove();
      accelSub = null;
      prevMagRef.current = null;
      lastLowGAtRef.current = null;
    };
  }, [tracking, configOk]);

  const dismissFallModal = () => {
    suppressUntilRef.current = Date.now() + SUPPRESS_AFTER_OK_MS;
    setFallModal({ visible: false, detail: '' });
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll} style={styles.root}>
      <Text style={styles.title}>Phone safety tracking</Text>
      <Text style={styles.body}>
        <Text style={styles.bold}>Start tracking</Text> sends GPS to the caregiver map and runs a simple{' '}
        <Text style={styles.bold}>accelerometer check</Text> for sudden impacts / possible falls. False alarms can
        happen (running, dropping the phone). Tap <Text style={styles.bold}>I’m OK</Text> to pause new alerts for 10
        minutes.
      </Text>

      {!configOk ? (
        <View style={styles.warn}>
          <Text style={styles.warnTitle}>Set the patient ID on this phone</Text>
          <Text style={styles.body}>
            API URL defaults to <Text style={styles.mono}>{DEFAULT_API_BASE}</Text> and device key to{' '}
            <Text style={styles.mono}>{DEFAULT_DEVICE_API_KEY}</Text> (same as Docker compose). Override with{' '}
            <Text style={styles.mono}>EXPO_PUBLIC_*</Text> in <Text style={styles.mono}>android/.env</Text> if needed.
          </Text>
          <Text style={styles.monoSmall}>EXPO_PUBLIC_BLIND_USER_ID</Text>
          <Text style={styles.hint}>
            Required: copy from web app → caregiver → My users → “Connect this patient” for the blind user.
          </Text>
        </View>
      ) : (
        <View style={styles.info}>
          <Text style={styles.infoText}>
            Using <Text style={styles.mono}>{API_BASE}</Text> • key <Text style={styles.mono}>{DEVICE_API_KEY}</Text> •
            patient <Text style={styles.monoSmallInline}>{BLIND_USER_ID}</Text>
          </Text>
        </View>
      )}

      <View style={styles.row}>
        {!tracking ? (
          <Pressable style={styles.btnPrimary} onPress={() => void start()}>
            <Text style={styles.btnPrimaryText}>Start tracking</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.btnDanger} onPress={() => void stop()}>
            <Text style={styles.btnDangerText}>Stop</Text>
          </Pressable>
        )}
        <Pressable
          style={styles.btnSecondary}
          onPress={() => void sendOnce().catch((e: unknown) => setLastErr(e instanceof Error ? e.message : 'Send failed'))}
          disabled={!configOk}>
          <Text style={styles.btnSecondaryText}>Send GPS once</Text>
        </Pressable>
      </View>

      {tracking ? (
        <View style={styles.inline}>
          <ActivityIndicator />
          <Text style={styles.status}> {status}</Text>
        </View>
      ) : (
        <Text style={styles.status}>{status || (configOk ? 'Idle' : '')}</Text>
      )}

      {lastOk ? <Text style={styles.ok}>Last GPS sent: {lastOk}</Text> : null}
      {lastErr ? <Text style={styles.err}>{lastErr}</Text> : null}

      <Text style={styles.section}>System</Text>
      <Pressable style={styles.linkBtn} onPress={() => void Linking.openSettings()}>
        <Text style={styles.linkBtnText}>Open app settings</Text>
      </Pressable>
      {Platform.OS === 'android' ? (
        <Text style={styles.body}>
          For hotspot, use Android quick settings or Settings → Hotspot & tethering. Keep this screen open for
          foreground updates.
        </Text>
      ) : null}

      <Modal visible={fallModal.visible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Check on user</Text>
            <Text style={styles.modalBody}>{fallModal.detail}</Text>
            <Pressable style={styles.btnPrimary} onPress={dismissFallModal}>
              <Text style={styles.btnPrimaryText}>I’m OK — snooze 10 min</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { padding: 20, paddingTop: 48, gap: 12 },
  title: { fontSize: 22, fontWeight: '700', color: '#f8fafc' },
  body: { fontSize: 14, color: '#94a3b8', lineHeight: 20 },
  bold: { fontWeight: '700', color: '#e2e8f0' },
  mono: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 13,
    color: '#86efac',
  },
  monoSmallInline: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 11,
    color: '#a5b4fc',
  },
  info: {
    borderWidth: 1,
    borderColor: '#14532d',
    backgroundColor: '#052e16',
    padding: 10,
    borderRadius: 10,
  },
  infoText: { fontSize: 12, color: '#bbf7d0', lineHeight: 18 },
  monoSmall: {
    marginTop: 8,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 12,
    color: '#cbd5e1',
  },
  hint: { fontSize: 12, color: '#64748b', marginTop: 2 },
  warn: {
    borderWidth: 1,
    borderColor: '#854d0e',
    backgroundColor: '#422006',
    padding: 12,
    borderRadius: 10,
    marginTop: 4,
  },
  warnTitle: { color: '#fef08a', fontWeight: '600', marginBottom: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  btnPrimary: { backgroundColor: '#1D9E75', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10 },
  btnPrimaryText: { color: '#022c22', fontWeight: '700', textAlign: 'center' },
  btnDanger: { backgroundColor: '#7f1d1d', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10 },
  btnDangerText: { color: '#fecaca', fontWeight: '700' },
  btnSecondary: { borderWidth: 1, borderColor: '#334155', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10 },
  btnSecondaryText: { color: '#e2e8f0', fontWeight: '600' },
  inline: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  status: { color: '#94a3b8', fontSize: 14 },
  ok: { color: '#86efac', fontSize: 13 },
  err: { color: '#fca5a5', fontSize: 13 },
  section: { marginTop: 16, fontSize: 16, fontWeight: '600', color: '#e2e8f0' },
  linkBtn: { alignSelf: 'flex-start', paddingVertical: 8 },
  linkBtnText: { color: '#38bdf8', fontSize: 14, textDecorationLine: 'underline' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#f8fafc' },
  modalBody: { fontSize: 14, color: '#cbd5e1', lineHeight: 20 },
});
