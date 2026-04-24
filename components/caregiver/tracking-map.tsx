"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useState } from "react";
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

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setError(null);
      const res = await fetch("/api/caregiver/tracking", { cache: "no-store" });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Failed to load tracking data");
      }
      const json = (await res.json()) as { points: Point[] };
      if (!cancelled) setPoints(json.points);
    }

    run().catch((e: unknown) => {
      if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load tracking data");
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const center = useMemo<[number, number]>(() => {
    if (points.length > 0) return [points[0].latitude, points[0].longitude];
    // Bucharest fallback
    return [44.4268, 26.1025];
  }, [points]);

  return (
    <div className="h-full w-full">
      {error ? (
        <div className="p-4 text-sm text-red-400">{error}</div>
      ) : null}

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
                <div className="text-xs text-slate-600">Device: {p.deviceSerialNumber}</div>
                <div className="mt-2">
                  Severity: <b>{p.severity}</b> ({p.distanceCm}cm)
                </div>
                <div className="text-xs text-slate-600">
                  {new Date(p.triggeredAt).toLocaleString()}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

