"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Fragment } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer } from "react-leaflet";

type TrackingUser = {
  blindUserId: string;
  blindUserName: string;
  totalDistanceKm: number;
  pingCount: number;
  lastSeenAt: string | null;
  latestPoint: {
    latitude: number;
    longitude: number;
    triggeredAt: string;
  } | null;
  track: Array<{
    latitude: number;
    longitude: number;
    triggeredAt: string;
  }>;
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

function colorForUser(seed: string): string {
  const palette = ["#22c55e", "#38bdf8", "#f59e0b", "#a78bfa", "#f43f5e", "#14b8a6"];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

export function TrackingMap() {
  const [users, setUsers] = useState<TrackingUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [windowMode, setWindowMode] = useState<"1d" | "2d" | "1w" | "day">("1d");
  const [dayValue, setDayValue] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [nowTick, setNowTick] = useState(() => Date.now());

  const loadPoints = useCallback(async () => {
    setError(null);
    const params = new URLSearchParams({ window: windowMode });
    if (windowMode === "day") params.set("day", dayValue);
    const res = await fetch(`/api/caregiver/tracking?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || "Failed to load tracking data");
    }
    const json = (await res.json()) as { users: TrackingUser[] };
    setUsers(json.users ?? []);
    setNowTick(Date.now());
  }, [windowMode, dayValue]);

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
  }, [loadPoints, windowMode, dayValue]);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const center = useMemo<[number, number]>(() => {
    const firstWithPoint = users.find((u) => u.latestPoint != null);
    if (firstWithPoint?.latestPoint) return [firstWithPoint.latestPoint.latitude, firstWithPoint.latestPoint.longitude];
    return [44.4268, 26.1025];
  }, [users]);

  const totalKm = useMemo(() => users.reduce((acc, u) => acc + u.totalDistanceKm, 0), [users]);

  return (
    <div className="relative h-full w-full">
      {error ? (
        <div className="absolute left-2 right-2 top-2 z-[1000] rounded-lg border border-red-900/60 bg-slate-950/95 p-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="absolute bottom-2 left-2 right-2 z-[1000] max-h-[46%] overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/95 p-3 text-xs text-slate-200 shadow-lg md:bottom-auto md:left-auto md:right-2 md:top-2 md:max-h-[58%] md:w-[340px]">
        <div className="font-semibold text-slate-100">Location history + distance</div>
        <p className="mt-1 text-[11px] text-slate-500">
          Per-user totals are computed from phone GPS pings. Refreshes every {POLL_MS / 1000}s.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(["1d", "2d", "1w", "day"] as const).map((w) => (
            <button
              key={w}
              onClick={() => setWindowMode(w)}
              className={`rounded border px-2 py-1 text-[11px] ${
                windowMode === w
                  ? "border-[#1D9E75] bg-[#1D9E75]/20 text-emerald-200"
                  : "border-slate-700 bg-slate-900 text-slate-300"
              }`}
            >
              {w === "1w" ? "1 week" : w === "day" ? "Pick day" : w}
            </button>
          ))}
        </div>
        {windowMode === "day" ? (
          <input
            type="date"
            value={dayValue}
            onChange={(e) => setDayValue(e.target.value)}
            className="mt-2 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-200 outline-none"
          />
        ) : null}
        <div className="mt-2 text-[11px] text-slate-400">Total all users: {totalKm.toFixed(2)} km</div>
        <ul className="mt-2 space-y-2">
          {users.length === 0 ? (
            <li className="text-slate-500">No locations yet. Send pings from the phone app with this patient’s ID.</li>
          ) : (
            users.map((u) => (
              <li key={u.blindUserId} className="border-t border-slate-800 pt-2 first:border-t-0 first:pt-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-slate-100">{u.blindUserName}</div>
                  <div className="font-mono text-[11px]" style={{ color: colorForUser(u.blindUserId) }}>
                    {u.totalDistanceKm.toFixed(2)} km
                  </div>
                </div>
                <div className="mt-0.5 text-slate-400">
                  {u.lastSeenAt ? formatMinutesAgo(u.lastSeenAt, nowTick) : "No recent pings"}
                </div>
                <div className="mt-0.5 text-[10px] text-slate-500">Pings: {u.pingCount}</div>
                {u.latestPoint ? (
                  <div className="mt-0.5 font-mono text-[10px] text-slate-500">
                    {u.latestPoint.latitude.toFixed(5)}, {u.latestPoint.longitude.toFixed(5)}
                  </div>
                ) : null}
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

        {users.map((u) => {
          const points = u.track.map((p) => [p.latitude, p.longitude] as [number, number]);
          const latest = u.latestPoint;
          if (!latest) return null;
          return (
            <Fragment key={u.blindUserId}>
              {points.length >= 2 ? (
                <Polyline
                  positions={points}
                  pathOptions={{ color: colorForUser(u.blindUserId), weight: 4, opacity: 0.8 }}
                />
              ) : null}
              <Marker position={[latest.latitude, latest.longitude]}>
                <Popup>
                  <div className="text-sm">
                    <div className="font-semibold">{u.blindUserName}</div>
                    <div className="text-xs text-slate-600">Phone GPS history</div>
                    <div className="mt-2 text-xs">
                      <span className="font-semibold text-slate-800">Distance in range:</span>{" "}
                      {u.totalDistanceKm.toFixed(2)} km
                    </div>
                    <div className="text-xs text-slate-600">Pings: {u.pingCount}</div>
                    <div className="mt-1 text-xs text-slate-600">
                      Last update: {u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleString() : "—"}
                    </div>
                  </div>
                </Popup>
              </Marker>
            </Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
}
