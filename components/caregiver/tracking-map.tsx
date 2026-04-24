"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";

type Point = {
  blindUserId: string;
  blindUserName: string;
  deviceSerialNumber: string;
  severity: "CRITICAL" | "NEAR" | "MEDIUM";
  distanceCm: number;
  triggeredAt: string;
  latitude: number;
  longitude: number;
};

const POLL_MS = 20_000;

function formatMinutesAgo(iso: string, nowMs: number): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const sec = Math.max(0, Math.floor((nowMs - t) / 1000));
  if (sec < 60) return "< 1 min ago";
  const min = Math.floor(sec / 60);
  if (min < 120) return `${min} min ago`;
  const h = Math.floor(min / 60);
  return `${h} h ${min % 60} min ago`;
}

// Fix default icon paths when bundling
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

export function TrackingMap() {
  const [points, setPoints] = useState<Point[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const loadPoints = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/caregiver/tracking", { cache: "no-store" });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || "Failed to load tracking data");
    }
    const json = (await res.json()) as { points: Point[] };
    setPoints(json.points);
    setNowTick(Date.now());
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadPoints().catch((e: unknown) => {
      if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load tracking data");
    });

    const id = window.setInterval(() => {
      loadPoints().catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load tracking data");
      });
    }, POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [loadPoints]);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const center = useMemo<[number, number]>(() => {
    if (points.length > 0) return [points[0].latitude, points[0].longitude];
    return [44.4268, 26.1025];
  }, [points]);

  return (
    <div className="relative h-full w-full">
      {error ? (
        <div className="absolute left-2 right-2 top-2 z-[1000] rounded-lg border border-red-900/60 bg-slate-950/95 p-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="absolute left-2 top-2 z-[1000] max-h-[45%] w-[min(100%-1rem,280px)] overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/95 p-3 text-xs text-slate-200 shadow-lg">
        <div className="font-semibold text-slate-100">Last phone GPS</div>
        <p className="mt-1 text-[11px] text-slate-500">
          Map refreshes about every {POLL_MS / 1000}s. “Minutes ago” updates live.
        </p>
        <ul className="mt-2 space-y-2">
          {points.length === 0 ? (
            <li className="text-slate-500">No locations yet. Send pings from the phone app with this patient’s ID.</li>
          ) : (
            points.map((p) => (
              <li key={p.blindUserId} className="border-t border-slate-800 pt-2 first:border-t-0 first:pt-0">
                <div className="font-medium text-slate-100">{p.blindUserName}</div>
                <div className="mt-0.5 text-slate-400">{formatMinutesAgo(p.triggeredAt, nowTick)}</div>
                <div className="mt-0.5 font-mono text-[10px] text-slate-500">
                  {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      <MapContainer center={center} zoom={13} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {points.map((p) => (
          <Marker key={`${p.blindUserId}-${p.deviceSerialNumber}`} position={[p.latitude, p.longitude]}>
            <Popup>
              <div className="text-sm">
                <div className="font-semibold">{p.blindUserName}</div>
                <div className="text-xs text-slate-600">
                  {p.deviceSerialNumber === "PHONE" ? "Phone GPS (LocationPing)" : `Device: ${p.deviceSerialNumber}`}
                </div>
                <div className="mt-2 text-xs">
                  <span className="font-semibold text-slate-800">Last update:</span>{" "}
                  {formatMinutesAgo(p.triggeredAt, nowTick)}
                </div>
                <div className="text-xs text-slate-600">{new Date(p.triggeredAt).toLocaleString()}</div>
                {p.deviceSerialNumber !== "PHONE" ? (
                  <div className="mt-1 text-xs">
                    Severity: <b>{p.severity}</b> ({p.distanceCm} cm)
                  </div>
                ) : null}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
