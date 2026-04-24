"use client";

import { useEffect, useState } from "react";

type Snapshot = {
  lastDistanceCm: number | null;
  lastAccelX: number | null;
  lastSeenAt: string | null;
  isOnline: boolean;
  batteryLevel: number | null;
};

type Props = {
  serialNumber: string;
  label: string;
  initial: Snapshot;
};

export function EspDeviceTelemetryLive({ serialNumber, label, initial }: Props) {
  const [data, setData] = useState<Snapshot>(initial);

  useEffect(() => {
    setData(initial);
  }, [initial.lastSeenAt, initial.lastDistanceCm, initial.lastAccelX, initial.isOnline, initial.batteryLevel]);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      try {
        const q = encodeURIComponent(serialNumber);
        const res = await fetch(`/api/caregiver/device-snapshot?serial=${q}`, { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as Snapshot;
        if (!cancelled) setData(json);
      } catch {
        /* ignore */
      }
    }

    const id = window.setInterval(tick, 4000);
    void tick();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [serialNumber]);

  return (
    <div className="border-t border-slate-900 pt-3 first:border-t-0 first:pt-0">
      <div className="text-sm font-medium text-slate-200">
        {label} <span className="font-normal text-slate-500">({serialNumber})</span>
      </div>
      <dl className="mt-2 grid gap-1 text-xs text-slate-400 sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Last distance</dt>
          <dd className="font-mono text-slate-200">
            {data.lastDistanceCm != null ? `${data.lastDistanceCm} cm` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Last accel X</dt>
          <dd className="font-mono text-slate-200">{data.lastAccelX != null ? String(data.lastAccelX) : "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Last seen</dt>
          <dd>{data.lastSeenAt ? new Date(data.lastSeenAt).toLocaleString() : "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Online / battery</dt>
          <dd>
            {data.isOnline ? "Online" : "Offline"}
            {data.batteryLevel != null ? ` • ${data.batteryLevel}%` : ""}
          </dd>
        </div>
      </dl>
    </div>
  );
}
