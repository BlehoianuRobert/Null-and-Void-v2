import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type PhoneAlert = {
  id: string;
  sentAt: Date;
  userName: string;
  reason: string;
  peakMagnitudeMs2: number;
};

type HatAlert = {
  id: string;
  sentAt: Date;
  userName: string;
  deviceLabel: string;
  severity: string;
  distanceCm: number;
};

export default async function CaregiverAlertsPage() {
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
      take: 100,
    }),
    prisma.caregiverNotification.findMany({
      where: { caregiverId, alertLogId: { not: null } },
      include: {
        alertLog: {
          include: {
            user: { select: { name: true } },
            device: { select: { label: true } },
          },
        },
      },
      orderBy: { sentAt: "desc" },
      take: 100,
    }),
  ]);

  const phoneAlerts: PhoneAlert[] = [];
  for (const row of phoneRows) {
    const m = row.safetyMotionAlert;
    if (!m) continue;
    phoneAlerts.push({
      id: row.id,
      sentAt: row.sentAt,
      userName: m.user.name,
      reason: m.reason,
      peakMagnitudeMs2: m.peakMagnitudeMs2,
    });
  }

  const hatAlerts: HatAlert[] = [];
  for (const row of hatRows) {
    const a = row.alertLog;
    if (!a) continue;
    hatAlerts.push({
      id: row.id,
      sentAt: row.sentAt,
      userName: a.user.name,
      deviceLabel: a.device.label,
      severity: a.severity,
      distanceCm: a.distanceCm,
    });
  }

  const merged = [
    ...phoneAlerts.map((a) => ({ kind: "phone" as const, ...a })),
    ...hatAlerts.map((a) => ({ kind: "hat" as const, ...a })),
  ].sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Alerts</h1>
        <p className="mt-2 text-sm text-slate-400">
          Includes hat distance thresholds and phone alerts (impact + speed over limit).
        </p>
      </div>

      {merged.length === 0 ? (
        <p className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-500">
          No alerts yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {merged.map((item) =>
            item.kind === "phone" ? (
              <li key={item.id} className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-4">
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
                    ? `speed threshold exceeded (${(item.peakMagnitudeMs2 * 3.6).toFixed(1)} km/h).`
                    : `possible accident signal (${item.reason.replace(/_/g, " ").toLowerCase()}).`}
                </p>
              </li>
            ) : (
              <li key={item.id} className="rounded-lg border border-sky-900/40 bg-slate-950/60 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-sky-200/90">Hat distance</span>
                  <time className="text-xs text-slate-500" dateTime={item.sentAt.toISOString()}>
                    {item.sentAt.toLocaleString()}
                  </time>
                </div>
                <p className="mt-2 text-sm text-slate-200">
                  <span className="font-medium text-slate-100">{item.userName}</span>
                  <span className="text-slate-500"> — </span>
                  {item.deviceLabel}
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

