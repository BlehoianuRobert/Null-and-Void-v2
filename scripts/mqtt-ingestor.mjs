import mqtt from "mqtt";

const MQTT_URL = process.env.MQTT_URL || "mqtt://mqtt-broker:1883";
const MQTT_TOPIC_DISTANCE = process.env.MQTT_TOPIC_DISTANCE || "senzor/distanta";
const MQTT_TOPIC_ACCEL = process.env.MQTT_TOPIC_ACCEL || "senzor/acceleratie";
const MQTT_TOPIC_PHONE_LOCATION = process.env.MQTT_TOPIC_PHONE_LOCATION || "phone/location";
const MQTT_TOPIC_PHONE_MOTION = process.env.MQTT_TOPIC_PHONE_MOTION || "phone/motion";

// Because your ESP32 publishes without a device id in the topic/payload,
// we map the incoming MQTT messages to ONE registered device serial number
// (must match Device.serialNumber in the web app — usually the ESP Wi‑Fi MAC).
// For multiple devices later, use per-serial topics, e.g. devices/<serial>/distanta
const DEVICE_SERIAL = (process.env.DEVICE_SERIAL || "").trim();

const APP_BASE_URL = process.env.APP_BASE_URL || "http://web:3000";
const DEVICE_API_KEY = process.env.DEVICE_API_KEY || "";

if (!DEVICE_API_KEY) {
  console.error("Missing DEVICE_API_KEY env var (must match web app DEVICE_API_KEY).");
  process.exit(1);
}

if (!DEVICE_SERIAL) {
  console.error(
    "Missing DEVICE_SERIAL: set it to the same value as the device serial in the app (e.g. ESP32 Wi‑Fi MAC)."
  );
  process.exit(1);
}

let lastAccelX = null;

function toNumber(payload) {
  const s = payload.toString("utf8").trim().replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

async function postTelemetry({ distanceCm, accelX }) {
  const url = `${APP_BASE_URL}/api/devices/${encodeURIComponent(DEVICE_SERIAL)}/telemetry`;

  const body = {
    distanceCm,
    // This field is optional and currently ignored by the API route,
    // but we keep it for future telemetry expansion.
    accelX,
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
  MQTT_TOPIC_ACCEL,
  MQTT_TOPIC_PHONE_LOCATION,
  MQTT_TOPIC_PHONE_MOTION
);
console.log("DEVICE_SERIAL:", DEVICE_SERIAL);
console.log("APP_BASE_URL:", APP_BASE_URL);

const client = mqtt.connect(MQTT_URL, {
  clientId: `blindhat-worker-${Math.random().toString(16).slice(2)}`,
  reconnectPeriod: 2000,
});

client.on("connect", () => {
  console.log("MQTT connected");
  client.subscribe(
    [MQTT_TOPIC_DISTANCE, MQTT_TOPIC_ACCEL, MQTT_TOPIC_PHONE_LOCATION, MQTT_TOPIC_PHONE_MOTION],
    (err) => {
      if (err) console.error("MQTT subscribe error", err);
      else console.log("MQTT subscribed");
    }
  );
});

client.on("error", (err) => {
  console.error("MQTT error", err);
});

client.on("message", async (topic, payload) => {
  try {
    if (topic === MQTT_TOPIC_ACCEL) {
      lastAccelX = toNumber(payload);
      return;
    }

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
      const distance = toNumber(payload);
      if (distance == null) return;

      await postTelemetry({ distanceCm: distance, accelX: lastAccelX });
      console.log("Forwarded distance", distance, "accelX", lastAccelX);
    }
  } catch (e) {
    console.error("INGEST_ERROR", e);
  }
});

