import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type PhoneLine = {
  kind: "phone";
  id: string;
  sentAt: Date;
  userName: string;
  reason: string;
  peakMagnitudeMs2: number;
  deltaMs2: number | null;
  latitude: number | null;
  longitude: number | null;
};

type HatLine = {
  kind: "hat";
  id: string;
  sentAt: Date;
  userName: string;
  deviceLabel: string;
  deviceSerial: string;
  distanceCm: number;
  severity: string;
};

export default async function CaregiverNotificationsPage() {
  const session = await getServerSession(authOptions);
  requireRole(session, ["CAREGIVER"]);
  const caregiverId = session!.user.id;

  const [phoneRows, hatRows] = await Promise.all([
    prisma.caregiverNotification.findMany({
      where: { caregiverId, safetyMotionAlertId: { not: null } },
      include: {
        safetyMotionAlert: {
          include: { user: { select: { name: true } } },
        },
      },
      orderBy: { sentAt: "desc" },
      take: 50,
    }),
    prisma.caregiverNotification.findMany({
      where: { caregiverId, alertLogId: { not: null } },
      include: {
        alertLog: {
          include: {
            user: { select: { name: true } },
            device: { select: { label: true, serialNumber: true } },
          },
        },
      },
      orderBy: { sentAt: "desc" },
      take: 50,
    }),
  ]);

  const phoneLines: PhoneLine[] = [];
  for (const row of phoneRows) {
    const m = row.safetyMotionAlert;
    if (!m) continue;
    phoneLines.push({
      kind: "phone",
      id: row.id,
      sentAt: row.sentAt,
      userName: m.user.name,
      reason: m.reason,
      peakMagnitudeMs2: m.peakMagnitudeMs2,
      deltaMs2: m.deltaMs2,
      latitude: m.latitude,
      longitude: m.longitude,
    });
  }

  const hatLines: HatLine[] = [];
  for (const row of hatRows) {
    const a = row.alertLog;
    if (!a) continue;
    hatLines.push({
      kind: "hat",
      id: row.id,
      sentAt: row.sentAt,
      userName: a.user.name,
      deviceLabel: a.device.label,
      deviceSerial: a.device.serialNumber,
      distanceCm: a.distanceCm,
      severity: a.severity,
    });
  }

  const merged: (PhoneLine | HatLine)[] = [...phoneLines, ...hatLines].sort(
    (a, b) => b.sentAt.getTime() - a.sentAt.getTime()
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Notifications</h1>
        <p className="mt-2 text-sm text-slate-400">
          <span className="text-amber-200/90">Phone alerts</span> include impact/fall-like events from accelerometer
          and speed-over-threshold events. <span className="text-sky-200/90">Hat distance</span> alerts come from the
          ultrasonic sensor thresholds.
        </p>
      </div>

      {merged.length === 0 ? (
        <p className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-500">
          No notifications yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {merged.map((item) =>
            item.kind === "phone" ? (
              <li
                key={item.id}
                className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-amber-200/90">
                    {item.reason === "SPEED_OVER_LIMIT" ? "Phone speed" : "Phone impact"}
                  </span>
                  <time className="text-xs text-slate-500" dateTime={item.sentAt.toISOString()}>
                    {item.sentAt.toLocaleString()}
                  </time>
                </div>
                <p className="mt-2 text-sm text-slate-200">
                  <span className="font-medium text-slate-100">{item.userName}</span>
                  <span className="text-slate-500"> — </span>
                  {item.reason === "SPEED_OVER_LIMIT"
                    ? "speed threshold exceeded."
                    : `possible accident signal (${item.reason.replace(/_/g, " ").toLowerCase()}).`}
                </p>
                <p className="mt-1 font-mono text-xs text-slate-400">
                  {item.reason === "SPEED_OVER_LIMIT" ? (
                    <>
                      Speed ≈ {item.peakMagnitudeMs2.toFixed(2)} m/s ({(item.peakMagnitudeMs2 * 3.6).toFixed(1)} km/h)
                    </>
                  ) : (
                    <>
                      Peak ≈ {item.peakMagnitudeMs2.toFixed(1)} m/s² (includes gravity)
                      {item.deltaMs2 != null ? ` · Δ ≈ ${item.deltaMs2.toFixed(1)} m/s²` : null}
                    </>
                  )}
                </p>
                {item.latitude != null && item.longitude != null ? (
                  <a
                    href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-xs text-amber-300/90 underline hover:text-amber-200"
                  >
                    Open last known location in Maps
                  </a>
                ) : (
                  <p className="mt-2 text-xs text-slate-600">No GPS position was attached to this event.</p>
                )}
              </li>
            ) : (
              <li
                key={item.id}
                className="rounded-lg border border-sky-900/40 bg-slate-950/60 p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-sky-200/90">
                    Hat distance
                  </span>
                  <time className="text-xs text-slate-500" dateTime={item.sentAt.toISOString()}>
                    {item.sentAt.toLocaleString()}
                  </time>
                </div>
                <p className="mt-2 text-sm text-slate-200">
                  <span className="font-medium text-slate-100">{item.userName}</span>
                  <span className="text-slate-500"> — </span>
                  {item.deviceLabel} ({item.deviceSerial})
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Distance {item.distanceCm} cm · severity{" "}
                  <span className="font-mono text-slate-300">{item.severity}</span>
                </p>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}
