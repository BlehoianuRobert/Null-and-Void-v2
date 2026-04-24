import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Location from 'expo-location';

const API_BASE = (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').replace(/\/$/, '');
const DEVICE_API_KEY = process.env.EXPO_PUBLIC_DEVICE_API_KEY ?? '';
const BLIND_USER_ID = process.env.EXPO_PUBLIC_BLIND_USER_ID ?? '';

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

export default function TrackScreen() {
  const [tracking, setTracking] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [lastOk, setLastOk] = useState<string | null>(null);
  const [lastErr, setLastErr] = useState<string | null>(null);
  const subRef = useRef<Location.LocationSubscription | null>(null);

  const configOk = Boolean(API_BASE && DEVICE_API_KEY && BLIND_USER_ID);

  const stop = useCallback(async () => {
    subRef.current?.remove();
    subRef.current = null;
    setTracking(false);
    setStatus('Stopped');
  }, []);

  const sendOnce = useCallback(async () => {
    if (!configOk) return;
    setLastErr(null);
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
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
      setLastErr('Set EXPO_PUBLIC_API_BASE_URL, EXPO_PUBLIC_DEVICE_API_KEY, EXPO_PUBLIC_BLIND_USER_ID');
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
    setStatus('Tracking (foreground)');
  }, [configOk, sendOnce]);

  useEffect(() => {
    return () => {
      void stop();
    };
  }, [stop]);

  return (
    <ScrollView contentContainerStyle={styles.scroll} style={styles.root}>
      <Text style={styles.title}>Phone GPS → map</Text>
      <Text style={styles.body}>
        While tracking is on, this tab sends your position to your BlindHat server so caregivers see you on{' '}
        <Text style={styles.mono}>/caregiver/map</Text>. Use the patient ID from <Text style={styles.bold}>My users</Text>{' '}
        in the web app as <Text style={styles.mono}>EXPO_PUBLIC_BLIND_USER_ID</Text>.
      </Text>

      {!configOk ? (
        <View style={styles.warn}>
          <Text style={styles.warnTitle}>Configure build env (EAS secrets or .env)</Text>
          <Text style={styles.monoSmall}>EXPO_PUBLIC_API_BASE_URL</Text>
          <Text style={styles.hint}>Example: https://your-server.com or http://192.168.43.1:3000</Text>
          <Text style={styles.monoSmall}>EXPO_PUBLIC_DEVICE_API_KEY</Text>
          <Text style={styles.hint}>Same value as DEVICE_API_KEY on the server / Pi bridge.</Text>
          <Text style={styles.monoSmall}>EXPO_PUBLIC_BLIND_USER_ID</Text>
          <Text style={styles.hint}>The patient’s internal ID (shown under each user in My users).</Text>
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
          <Text style={styles.btnSecondaryText}>Send once</Text>
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

      {lastOk ? <Text style={styles.ok}>Last sent: {lastOk}</Text> : null}
      {lastErr ? <Text style={styles.err}>{lastErr}</Text> : null}

      <Text style={styles.section}>System</Text>
      <Pressable style={styles.linkBtn} onPress={() => void Linking.openSettings()}>
        <Text style={styles.linkBtnText}>Open app location settings</Text>
      </Pressable>
      {Platform.OS === 'android' ? (
        <Text style={styles.body}>
          For hotspot, use Android quick settings or Settings → Hotspot & tethering. Keep this screen open for
          foreground updates.
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { padding: 20, paddingTop: 48, gap: 12 },
  title: { fontSize: 22, fontWeight: '700', color: '#f8fafc' },
  body: { fontSize: 14, color: '#94a3b8', lineHeight: 20 },
  bold: { fontWeight: '700', color: '#e2e8f0' },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), color: '#86efac' },
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
  btnPrimaryText: { color: '#022c22', fontWeight: '700' },
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
});
