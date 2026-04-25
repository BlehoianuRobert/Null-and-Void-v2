"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type FeedItem = {
  id: string;
  sentAt: string;
  blindUserName: string;
  reason: string;
  peakMagnitudeMs2: number;
  latitude: number | null;
  longitude: number | null;
};

const POLL_MS = 7000;
const TOAST_MS = 12000;

function isSpeedAlert(reason: string) {
  return reason.toUpperCase() === "SPEED_OVER_LIMIT";
}

export function PhoneImpactRealtimeAlerts() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported"
  );
  const [toasts, setToasts] = useState<FeedItem[]>([]);
  const [enabled, setEnabled] = useState(false);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const lastSeenAtRef = useRef<string | null>(null);

  const canNotify = useMemo(() => permission === "granted", [permission]);

  useEffect(() => {
    let cancelled = false;

    async function poll(firstLoad = false) {
      try {
        const q = new URLSearchParams({ take: "20" });
        if (lastSeenAtRef.current) q.set("since", lastSeenAtRef.current);
        const res = await fetch(`/api/caregiver/phone-impact-feed?${q.toString()}`, { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { items: FeedItem[] };
        const items = (json.items ?? []).slice().reverse();
        if (items.length === 0) return;

        for (const item of items) {
          if (item.sentAt && (!lastSeenAtRef.current || item.sentAt > lastSeenAtRef.current)) {
            lastSeenAtRef.current = item.sentAt;
          }
        }

        if (firstLoad) {
          for (const item of items) seenIdsRef.current.add(item.id);
          return;
        }

        const fresh = items.filter((i) => !seenIdsRef.current.has(i.id));
        if (fresh.length === 0) return;
        fresh.forEach((i) => seenIdsRef.current.add(i.id));
        if (cancelled) return;

        setToasts((prev) => {
          const merged = [...fresh, ...prev];
          return merged.slice(0, 4);
        });

        if (canNotify) {
          for (const item of fresh) {
            const speed = isSpeedAlert(item.reason);
            const title = speed ? `Phone speed alert: ${item.blindUserName}` : `Phone impact: ${item.blindUserName}`;
            const body = speed
              ? `${(item.peakMagnitudeMs2 * 3.6).toFixed(1)} km/h over threshold`
              : `${item.reason.replace(/_/g, " ").toLowerCase()} · Peak ${item.peakMagnitudeMs2.toFixed(1)} m/s²`;
            const n = new Notification(title, {
              body,
              tag: item.id,
            });
            n.onclick = () => {
              window.focus();
              window.location.href = "/caregiver/notifications";
            };
          }
        }
      } catch {
        // Keep polling silently.
      }
    }

    void poll(true).then(() => {
      if (!cancelled) setEnabled(true);
    });

    const id = window.setInterval(() => {
      if (!enabled && !canNotify) return;
      void poll(false);
    }, POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [canNotify, enabled]);

  useEffect(() => {
    if (toasts.length === 0) return;
    const id = window.setTimeout(() => {
      setToasts((prev) => prev.slice(0, -1));
    }, TOAST_MS);
    return () => window.clearTimeout(id);
  }, [toasts]);

  async function requestPermission() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    try {
      const p = await Notification.requestPermission();
      setPermission(p);
    } catch {
      setPermission("denied");
    }
  }

  return (
    <>
      {permission !== "unsupported" && permission !== "granted" ? (
        <div className="mb-3 rounded-lg border border-amber-800/50 bg-amber-950/40 p-3 text-xs text-amber-200">
          Browser impact notifications are off.
          <button
            onClick={requestPermission}
            className="ml-2 rounded border border-amber-500/40 px-2 py-1 text-[11px] font-semibold hover:bg-amber-900/30"
          >
            Enable
          </button>
        </div>
      ) : null}

      <div className="pointer-events-none fixed bottom-4 right-4 z-[1200] flex w-[min(92vw,360px)] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto rounded-lg border border-amber-800/40 bg-slate-950/95 p-3 text-xs shadow-xl"
          >
            <div className="font-semibold text-amber-200">
              {isSpeedAlert(t.reason) ? "Phone speed threshold alert" : "Phone impact detected"}
            </div>
            <div className="mt-1 text-slate-200">
              {t.blindUserName} · {t.reason.replace(/_/g, " ").toLowerCase()}
            </div>
            <div className="mt-1 font-mono text-slate-400">
              {isSpeedAlert(t.reason)
                ? `Speed ${t.peakMagnitudeMs2.toFixed(2)} m/s (${(t.peakMagnitudeMs2 * 3.6).toFixed(1)} km/h)`
                : `Peak ${t.peakMagnitudeMs2.toFixed(1)} m/s²`}
            </div>
            <div className="mt-2 flex items-center gap-3">
              <Link href="/caregiver/notifications" className="text-amber-300 underline hover:text-amber-200">
                Open notifications
              </Link>
              {t.latitude != null && t.longitude != null ? (
                <a
                  href={`https://www.google.com/maps?q=${t.latitude},${t.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-300 underline hover:text-white"
                >
                  Map
                </a>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

