import mqtt from "mqtt";

const MQTT_URL = process.env.MQTT_URL || "mqtt://mqtt-broker:1883";
const MQTT_TOPIC_DISTANCE = process.env.MQTT_TOPIC_DISTANCE || "senzor/distanta";
const MQTT_TOPIC_PHONE_LOCATION = process.env.MQTT_TOPIC_PHONE_LOCATION || "phone/location";
const MQTT_TOPIC_PHONE_MOTION = process.env.MQTT_TOPIC_PHONE_MOTION || "phone/motion";

// Device routing:
// 1) Preferred: JSON on distance topic includes deviceMac | mac | serial | serialNumber (same MAC as in the web app).
//    Then Portainer does NOT need DEVICE_SERIAL per hat — caregiver registers MAC once; ESP sends it each message.
// 2) Legacy: plain number payload — needs a MAC: DEVICE_SERIAL env, or JSON deviceMac on each message,
//    or DEFAULT_DEVICE_MAC_FOR_PLAIN_PAYLOAD (same default as compose) so a bare ESP number still routes.
const DEVICE_SERIAL = (process.env.DEVICE_SERIAL || "").trim();
const DEFAULT_PLAIN_MAC = (
  process.env.DEFAULT_DEVICE_MAC_FOR_PLAIN_PAYLOAD || "98:A3:16:7E:57:C0"
).trim();

const APP_BASE_URL = process.env.APP_BASE_URL || "http://web:3000";
const DEVICE_API_KEY = process.env.DEVICE_API_KEY || "";

if (!DEVICE_API_KEY) {
  console.error("Missing DEVICE_API_KEY env var (must match web app DEVICE_API_KEY).");
  process.exit(1);
}

function serialForPlainPayload(parsedSerial) {
  if (parsedSerial) return normalizeDeviceSerial(parsedSerial);
  if (DEVICE_SERIAL) return normalizeDeviceSerial(DEVICE_SERIAL);
  return normalizeDeviceSerial(DEFAULT_PLAIN_MAC);
}

/** Same rules as lib/normalizeDeviceSerial.ts (keep in sync). */
function normalizeDeviceSerial(input) {
  const trimmed = String(input).trim();
  if (!trimmed) return trimmed;
  const compact = trimmed.replace(/[:-]/g, "").toUpperCase();
  if (/^[0-9A-F]{12}$/.test(compact)) {
    return compact.match(/.{2}/g).join(":");
  }
  const withColons = trimmed.replace(/-/g, ":").trim();
  const parts = withColons.split(":").map((p) => p.trim().toUpperCase());
  if (parts.length === 6 && parts.every((p) => /^[0-9A-F]{2}$/.test(p))) {
    return parts.join(":");
  }
  return trimmed;
}

/** @returns {{ distanceCm: number, serial: string | null } | null} */
function parseDistancePayload(payload) {
  const raw = payload.toString("utf8").trim();
  if (!raw) return null;

  try {
    const j = JSON.parse(raw);
    if (!j || typeof j !== "object") return null;
    const rawMac = String(j.deviceMac ?? j.mac ?? j.serial ?? j.serialNumber ?? "").trim();
    const serial = rawMac ? normalizeDeviceSerial(rawMac) : "";
    let d = j.distanceCm ?? j.distanta ?? j.distance ?? j.cm;
    if (typeof d === "string") d = Number(String(d).replace(",", "."));
    if (!Number.isFinite(d)) return null;
    return { distanceCm: d, serial: serial ? serial : null };
  } catch {
    const n = Number(raw.replace(",", "."));
    if (!Number.isFinite(n)) return null;
    return { distanceCm: n, serial: null };
  }
}

async function postTelemetry({ distanceCm, serialNumber }) {
  const url = `${APP_BASE_URL}/api/devices/${encodeURIComponent(serialNumber)}/telemetry`;

  const body = {
    distanceCm,
    firmwareVersion: "mqtt-bridge",
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${DEVICE_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Telemetry POST failed ${res.status}: ${text}`);
  }
}

async function postPhoneMotion({
  blindUserId,
  peakMagnitudeMs2,
  deltaMs2,
  reason,
  latitude,
  longitude,
  triggeredAt,
}) {
  const url = `${APP_BASE_URL}/api/phone/motion`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${DEVICE_API_KEY}`,
    },
    body: JSON.stringify({
      blindUserId,
      peakMagnitudeMs2,
      deltaMs2,
      reason,
      latitude,
      longitude,
      triggeredAt,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Phone motion POST failed ${res.status}: ${text}`);
  }
}

async function postPhoneLocation({ blindUserId, latitude, longitude, accuracyM, speedMps, sentAt }) {
  const url = `${APP_BASE_URL}/api/phone/location`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${DEVICE_API_KEY}`,
    },
    body: JSON.stringify({ blindUserId, latitude, longitude, accuracyM, speedMps, sentAt }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Phone location POST failed ${res.status}: ${text}`);
  }
}

console.log("MQTT ingestor starting");
console.log("MQTT_URL:", MQTT_URL);
console.log(
  "Topics:",
  MQTT_TOPIC_DISTANCE,
  MQTT_TOPIC_PHONE_LOCATION,
  MQTT_TOPIC_PHONE_MOTION
);
console.log("DEVICE_SERIAL (override for plain payloads):", DEVICE_SERIAL || "(none)");
console.log("DEFAULT_DEVICE_MAC_FOR_PLAIN_PAYLOAD:", DEFAULT_PLAIN_MAC);
console.log("APP_BASE_URL:", APP_BASE_URL);

const client = mqtt.connect(MQTT_URL, {
  clientId: `blindhat-worker-${Math.random().toString(16).slice(2)}`,
  reconnectPeriod: 2000,
});

client.on("connect", () => {
  console.log("MQTT connected");
  client.subscribe([MQTT_TOPIC_DISTANCE, MQTT_TOPIC_PHONE_LOCATION, MQTT_TOPIC_PHONE_MOTION], (err) => {
    if (err) console.error("MQTT subscribe error", err);
    else console.log("MQTT subscribed");
  });
});

client.on("error", (err) => {
  console.error("MQTT error", err);
});

client.on("message", async (topic, payload) => {
  try {
    if (topic === MQTT_TOPIC_PHONE_LOCATION) {
      const s = payload.toString("utf8").trim();
      const json = JSON.parse(s);
      if (!json || typeof json !== "object") return;

      const blindUserId = String(json.blindUserId ?? "");
      const latitude = Number(json.latitude);
      const longitude = Number(json.longitude);
      if (!blindUserId || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

      const accuracyM = Number.isFinite(Number(json.accuracyM)) ? Number(json.accuracyM) : undefined;
      const speedMps = Number.isFinite(Number(json.speedMps)) ? Number(json.speedMps) : undefined;
      const sentAt = typeof json.sentAt === "string" ? json.sentAt : undefined;

      await postPhoneLocation({ blindUserId, latitude, longitude, accuracyM, speedMps, sentAt });
      console.log("Forwarded phone location", blindUserId, latitude, longitude);
      return;
    }

    if (topic === MQTT_TOPIC_PHONE_MOTION) {
      const s = payload.toString("utf8").trim();
      const json = JSON.parse(s);
      if (!json || typeof json !== "object") return;

      const blindUserId = String(json.blindUserId ?? "");
      const peakMagnitudeMs2 = Number(json.peakMagnitudeMs2);
      if (!blindUserId || !Number.isFinite(peakMagnitudeMs2)) return;

      const deltaMs2 = Number.isFinite(Number(json.deltaMs2)) ? Number(json.deltaMs2) : undefined;
      const reason = typeof json.reason === "string" ? json.reason : "MQTT";
      const latitude = Number.isFinite(Number(json.latitude)) ? Number(json.latitude) : undefined;
      const longitude = Number.isFinite(Number(json.longitude)) ? Number(json.longitude) : undefined;
      const triggeredAt = typeof json.triggeredAt === "string" ? json.triggeredAt : undefined;

      await postPhoneMotion({
        blindUserId,
        peakMagnitudeMs2,
        deltaMs2,
        reason,
        latitude,
        longitude,
        triggeredAt,
      });
      console.log("Forwarded phone motion", blindUserId, peakMagnitudeMs2, reason);
      return;
    }

    if (topic === MQTT_TOPIC_DISTANCE) {
      const rawPreview = payload.toString("utf8").trim().slice(0, 200);
      const parsed = parseDistancePayload(payload);
      if (!parsed) {
        console.warn("Distance MQTT: could not parse payload:", rawPreview);
        return;
      }

      const serial = serialForPlainPayload(parsed.serial);
      if (!serial) {
        console.error("Distance MQTT: no device MAC after routing; payload:", rawPreview);
        return;
      }

      try {
        await postTelemetry({
          distanceCm: parsed.distanceCm,
          serialNumber: serial,
        });
        console.log("Forwarded distance", parsed.distanceCm, "cm → device", serial);
      } catch (e) {
        console.error("Distance MQTT: POST failed for device", serial, "payload:", rawPreview, e);
      }
    }
  } catch (e) {
    console.error("INGEST_ERROR", e);
  }
});

