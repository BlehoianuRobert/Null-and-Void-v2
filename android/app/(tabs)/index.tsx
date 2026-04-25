import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Accelerometer } from 'expo-sensors';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

/** Defaults match your stack; override with EXPO_PUBLIC_* in android/.env or EAS secrets. */
const DEFAULT_API_BASE = 'http://10.136.37.252:3000';
const DEFAULT_DEVICE_API_KEY =
  '69d494dd6070d4c26e582c3cfd80e725eb1c44ea4765ffe1af9057b30119ce61';

const STORAGE_PATIENT_ID = 'blindhat_patient_id';
const STORAGE_API_BASE = 'blindhat_api_base';

const ENV_API_BASE = (process.env.EXPO_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE).replace(/\/$/, '');
const DEVICE_API_KEY = process.env.EXPO_PUBLIC_DEVICE_API_KEY ?? DEFAULT_DEVICE_API_KEY;
const ENV_BLIND_USER_ID = (process.env.EXPO_PUBLIC_BLIND_USER_ID ?? '').trim();

const MOTION_COOLDOWN_MS = 90_000;
const SUPPRESS_AFTER_OK_MS = 10 * 60 * 1000;
const LOCATION_SEND_INTERVAL_MS = 120_000;
// Keep realtime phone speed cadence aligned with dashboard telemetry polling (~4s).
const SPEED_SEND_INTERVAL_MS = 4000;

function normalizeApiBaseInput(raw: string): string {
  let s = raw.trim();
  // Common typo: "http:10.0.0.5:3000" -> "http://10.0.0.5:3000"
  s = s.replace(/^http:\/?(?!\/)/i, 'http://');
  s = s.replace(/^https:\/?(?!\/)/i, 'https://');
  s = s.replace(/\/+$/, '');
  return s;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function mapLocationError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const msg = raw.toLowerCase();
  if (msg.includes('location services') || msg.includes('location unavailable')) {
    return 'Current location unavailable. Turn on phone Location/GPS and set mode to High accuracy.';
  }
  if (msg.includes('denied')) {
    return 'Location permission denied. Allow location for this app in system settings.';
  }
  return raw || 'Location error';
}

async function getBestEffortLocation(): Promise<Location.LocationObject> {
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    throw new Error('Location services are disabled');
  }

  try {
    return await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
  } catch {
    const last = await Location.getLastKnownPositionAsync({
      maxAge: 120_000,
      requiredAccuracy: 150,
    });
    if (last) return last as Location.LocationObject;
    throw new Error('Current location unavailable');
  }
}

async function postPhoneLocation(
  apiBase: string,
  body: {
    blindUserId: string;
    latitude: number;
    longitude: number;
    accuracyM?: number;
    speedMps?: number;
    sentAt: string;
  }
) {
  const url = `${apiBase}/api/phone/location`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${DEVICE_API_KEY}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(`Network request failed. Check API base URL (${apiBase}) and phone/WiFi network.`);
  }
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(t || `HTTP ${res.status}`);
  }
}

async function postPhoneMotion(
  apiBase: string,
  body: {
    blindUserId: string;
    peakMagnitudeMs2: number;
    deltaMs2?: number;
    reason: string;
    latitude?: number;
    longitude?: number;
    triggeredAt: string;
  }
) {
  const url = `${apiBase}/api/phone/motion`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${DEVICE_API_KEY}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(`Network request failed. Check API base URL (${apiBase}) and phone/WiFi network.`);
  }
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(t || `HTTP ${res.status}`);
  }
}

async function postPhoneSpeed(
  apiBase: string,
  body: {
    blindUserId: string;
    speedMps: number;
    sentAt: string;
  }
) {
  const url = `${apiBase}/api/phone/speed`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${DEVICE_API_KEY}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(`Network request failed. Check API base URL (${apiBase}) and phone/WiFi network.`);
  }
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
  const [patientIdInput, setPatientIdInput] = useState('');
  const [apiBaseInput, setApiBaseInput] = useState('');
  const [idReady, setIdReady] = useState(false);
  const [saveHint, setSaveHint] = useState('');
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
  const lastLocationPostAtRef = useRef(0);
  const lastSpeedPostAtRef = useRef(0);
  const lastSpeedSampleRef = useRef<{ latitude: number; longitude: number; atMs: number } | null>(null);

  useEffect(() => {
    void Promise.all([AsyncStorage.getItem(STORAGE_PATIENT_ID), AsyncStorage.getItem(STORAGE_API_BASE)]).then(
      ([storedId, storedApi]) => {
      if (storedId && storedId.trim()) setPatientIdInput(storedId.trim());
      else if (ENV_BLIND_USER_ID) setPatientIdInput(ENV_BLIND_USER_ID);
      if (storedApi && storedApi.trim()) setApiBaseInput(storedApi.trim());
      else setApiBaseInput(ENV_API_BASE);
      setIdReady(true);
      }
    );
  }, []);

  const effectivePatientId = useMemo(
    () => patientIdInput.trim() || ENV_BLIND_USER_ID,
    [patientIdInput]
  );
  const effectiveApiBase = useMemo(
    () => normalizeApiBaseInput(apiBaseInput || ENV_API_BASE),
    [apiBaseInput]
  );

  const configOk = Boolean(effectivePatientId && effectiveApiBase && isValidHttpUrl(effectiveApiBase));

  const saveSettings = useCallback(async () => {
    const id = patientIdInput.trim();
    const api = normalizeApiBaseInput(apiBaseInput);
    if (!isValidHttpUrl(api)) {
      setLastErr('Invalid API base URL. Use http://IP:PORT or https://domain');
      return;
    }
    await AsyncStorage.setItem(STORAGE_PATIENT_ID, id);
    await AsyncStorage.setItem(STORAGE_API_BASE, api);
    setApiBaseInput(api);
    setLastErr(null);
    setSaveHint(id && api ? 'Saved on this phone' : 'Updated');
    setTimeout(() => setSaveHint(''), 2500);
  }, [patientIdInput, apiBaseInput]);

  const keyPreview =
    DEVICE_API_KEY.length > 24
      ? `${DEVICE_API_KEY.slice(0, 10)}…${DEVICE_API_KEY.slice(-6)}`
      : DEVICE_API_KEY;

  const stop = useCallback(async () => {
    subRef.current?.remove();
    subRef.current = null;
    setTracking(false);
    setStatus('Stopped');
    prevMagRef.current = null;
    lastLowGAtRef.current = null;
    lastLocationPostAtRef.current = 0;
    lastSpeedPostAtRef.current = 0;
    lastSpeedSampleRef.current = null;
  }, []);

  const sendOnce = useCallback(async () => {
    if (!configOk) return;
    setLastErr(null);
    let loc: Location.LocationObject;
    try {
      loc = await getBestEffortLocation();
    } catch (e: unknown) {
      throw new Error(mapLocationError(e));
    }
    lastGeoRef.current = {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    };
    const sentAt = new Date().toISOString();
    await postPhoneLocation(effectiveApiBase, {
      blindUserId: effectivePatientId,
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracyM: loc.coords.accuracy ?? undefined,
      speedMps: loc.coords.speed ?? undefined,
      sentAt,
    });
    if (typeof loc.coords.speed === 'number' && Number.isFinite(loc.coords.speed)) {
      await postPhoneSpeed(effectiveApiBase, {
        blindUserId: effectivePatientId,
        speedMps: Math.max(0, loc.coords.speed),
        sentAt,
      });
      lastSpeedPostAtRef.current = Date.now();
    }
    lastLocationPostAtRef.current = Date.now();
    setLastOk(new Date().toLocaleTimeString());
  }, [configOk, effectivePatientId, effectiveApiBase]);

  const start = useCallback(async () => {
    if (!configOk) {
      setLastErr('Enter patient ID and a valid API base URL (http://... or https://...), then Save.');
      return;
    }
    await AsyncStorage.setItem(STORAGE_PATIENT_ID, effectivePatientId);
    await AsyncStorage.setItem(STORAGE_API_BASE, effectiveApiBase);
    setLastErr(null);
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') {
      setLastErr('Location permission denied');
      setStatus('Open system settings to allow location');
      return;
    }

    if (Platform.OS === 'android') {
      // Shows native prompt to enable better location provider on Android devices.
      await Location.enableNetworkProviderAsync().catch(() => {
        /* ignore; user can still proceed if GPS works */
      });
    }

    await sendOnce().catch((e: unknown) => {
      setLastErr(e instanceof Error ? e.message : mapLocationError(e));
    });

    subRef.current?.remove();
    subRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        // Keep updates frequent for realtime speed; persist full location every 2 minutes.
        timeInterval: SPEED_SEND_INTERVAL_MS,
        distanceInterval: 0,
      },
      async (loc) => {
        lastGeoRef.current = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        try {
          const sentAt = new Date().toISOString();

          const nowMs = Date.now();
          let speedForRealtime: number | null = null;
          if (typeof loc.coords.speed === 'number' && Number.isFinite(loc.coords.speed)) {
            speedForRealtime = Math.max(0, loc.coords.speed);
          } else if (lastSpeedSampleRef.current) {
            const prev = lastSpeedSampleRef.current;
            const dt = (nowMs - prev.atMs) / 1000;
            if (dt > 0.5) {
              const d = Math.sqrt(
                Math.pow((loc.coords.latitude - prev.latitude) * 111139, 2) +
                  Math.pow((loc.coords.longitude - prev.longitude) * 111139, 2)
              );
              const s = d / dt;
              if (Number.isFinite(s) && s >= 0) speedForRealtime = s;
            }
          }
          lastSpeedSampleRef.current = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            atMs: nowMs,
          };

          if (
            speedForRealtime != null &&
            nowMs - lastSpeedPostAtRef.current >= SPEED_SEND_INTERVAL_MS
          ) {
            await postPhoneSpeed(effectiveApiBase, {
              blindUserId: effectivePatientId,
              speedMps: speedForRealtime,
              sentAt,
            });
            lastSpeedPostAtRef.current = nowMs;
          }

          if (nowMs - lastLocationPostAtRef.current >= LOCATION_SEND_INTERVAL_MS) {
            await postPhoneLocation(effectiveApiBase, {
              blindUserId: effectivePatientId,
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              accuracyM: loc.coords.accuracy ?? undefined,
              speedMps: speedForRealtime ?? undefined,
              sentAt,
            });
            lastLocationPostAtRef.current = nowMs;
          }

          setLastOk(new Date().toLocaleTimeString());
          setLastErr(null);
        } catch (e: unknown) {
          setLastErr(e instanceof Error ? e.message : 'Send failed');
        }
      }
    );
    setTracking(true);
    setStatus('Tracking (GPS + fall sensor)');
  }, [configOk, effectivePatientId, effectiveApiBase, sendOnce]);

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

        void postPhoneMotion(effectiveApiBase, {
          blindUserId: effectivePatientId,
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
  }, [tracking, configOk, effectivePatientId, effectiveApiBase]);

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

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Phone settings</Text>
        <Text style={styles.body}>
          The caregiver opens <Text style={styles.bold}>My users</Text> on the web, finds the blind person, and copies
          the ID from <Text style={styles.bold}>Connect this patient</Text>. Paste it here with the backend URL (for
          example <Text style={styles.mono}>http://10.136.37.252:3000</Text>), then tap <Text style={styles.bold}>Save</Text>.
        </Text>
        <TextInput
          value={apiBaseInput}
          onChangeText={setApiBaseInput}
          placeholder="API base URL, e.g. http://10.136.37.252:3000"
          placeholderTextColor="#64748b"
          autoCapitalize="none"
          autoCorrect={false}
          editable={idReady}
          style={styles.input}
        />
        <TextInput
          value={patientIdInput}
          onChangeText={setPatientIdInput}
          placeholder="e.g. clxxxxxxxxxxxxxxxxxx"
          placeholderTextColor="#64748b"
          autoCapitalize="none"
          autoCorrect={false}
          editable={idReady}
          style={styles.input}
        />
        <View style={styles.row}>
          <Pressable style={styles.btnSecondary} onPress={() => void saveSettings()}>
            <Text style={styles.btnSecondaryText}>Save settings</Text>
          </Pressable>
          {saveHint ? <Text style={styles.ok}>{saveHint}</Text> : null}
        </View>
        {!configOk && idReady ? (
          <Text style={styles.err}>Enter and save patient ID + API base URL before starting tracking.</Text>
        ) : null}
      </View>

      {configOk ? (
        <View style={styles.info}>
          <Text style={styles.infoText}>
            Server <Text style={styles.mono}>{effectiveApiBase}</Text> • device key{' '}
            <Text style={styles.mono}>{keyPreview}</Text>{' '}
            • patient <Text style={styles.monoSmallInline}>{effectivePatientId}</Text>
          </Text>
        </View>
      ) : null}

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
  card: {
    borderWidth: 1,
    borderColor: 'rgba(29,158,117,0.35)',
    backgroundColor: 'rgba(15,23,42,0.95)',
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#86efac' },
  input: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: '#f8fafc',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    backgroundColor: '#0f172a',
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
