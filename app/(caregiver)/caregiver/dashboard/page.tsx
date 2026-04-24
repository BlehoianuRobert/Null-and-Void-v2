import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export default async function CaregiverDashboardPage() {
  const session = await getServerSession(authOptions);
  requireRole(session, ["CAREGIVER"]);
  const caregiverId = session!.user.id;

  const relationships = await prisma.careRelationship.findMany({
    where: { caregiverId, isActive: true },
    select: { blindUserId: true, blindUser: { select: { name: true } } },
    orderBy: { assignedAt: "desc" },
  });

  const blindUserIds = relationships.map((r) => r.blindUserId);

  const devicesByOwner =
    blindUserIds.length > 0
      ? await prisma.device.findMany({
          where: { ownerId: { in: blindUserIds } },
          select: {
            ownerId: true,
            serialNumber: true,
            label: true,
            lastDistanceCm: true,
            lastAccelX: true,
            lastSeenAt: true,
            isOnline: true,
            batteryLevel: true,
          },
        })
      : [];

  const devicesGrouped = new Map<string, typeof devicesByOwner>();
  for (const d of devicesByOwner) {
    const list = devicesGrouped.get(d.ownerId) ?? [];
    list.push(d);
    devicesGrouped.set(d.ownerId, list);
  }

  const lastPingByUser = blindUserIds.length
    ? await prisma.locationPing.findMany({
        where: { userId: { in: blindUserIds } },
        orderBy: { sentAt: "desc" },
        take: 200,
        select: { userId: true, sentAt: true },
      })
    : [];

  const seen = new Set<string>();
  const lastPingAt = new Map<string, Date>();
  for (const p of lastPingByUser) {
    if (seen.has(p.userId)) continue;
    seen.add(p.userId);
    lastPingAt.set(p.userId, p.sentAt);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Caregiver dashboard</h1>
        <p className="mt-2 text-sm text-slate-400">
          Signed in as <span className="text-slate-200">{session!.user.email}</span>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-900 bg-slate-950/60 p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Assigned patients
          </div>
          <div className="mt-2 text-3xl font-semibold">{relationships.length}</div>
          <div className="mt-3 text-sm text-slate-400">
            <Link className="text-[#1D9E75] hover:underline" href="/caregiver/my-users">
              Manage patients →
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-slate-900 bg-slate-950/60 p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Location updates (last 5 min)
          </div>
          <div className="mt-2 text-3xl font-semibold">
            {
              relationships.filter((r) => {
                const t = lastPingAt.get(r.blindUserId);
                return t ? Date.now() - t.getTime() < 5 * 60 * 1000 : false;
              }).length
            }
          </div>
          <div className="mt-3 text-sm text-slate-400">
            <Link className="text-[#1D9E75] hover:underline" href="/caregiver/map">
              View map →
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-slate-900 bg-slate-950/60 p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Avg speed (last 5 min)
          </div>
          <div className="mt-2 text-sm text-slate-400">
            Open a patient in map popup and we’ll show their speed next (UI coming next step).
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-900 bg-slate-950/60 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-200">Patients</h2>
          <Link className="text-sm text-[#1D9E75] hover:underline" href="/caregiver/my-users">
            Add patient →
          </Link>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">ESP last distance</th>
                <th className="py-2 pr-3">ESP last seen</th>
                <th className="py-2 pr-3">Last phone ping</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900">
              {relationships.map((r) => {
                const devs = devicesGrouped.get(r.blindUserId) ?? [];
                const distSummary =
                  devs.length === 0
                    ? "—"
                    : devs
                        .map((d) =>
                          d.lastDistanceCm != null
                            ? `${d.label}: ${d.lastDistanceCm} cm`
                            : `${d.label}: —`
                        )
                        .join("; ");
                const seenSummary =
                  devs.length === 0
                    ? "—"
                    : devs
                        .map((d) =>
                          d.lastSeenAt ? `${d.label}: ${d.lastSeenAt.toLocaleString()}` : `${d.label}: —`
                        )
                        .join("; ");

                return (
                  <tr key={r.blindUserId} className="text-slate-200">
                    <td className="py-2 pr-3">{r.blindUser.name}</td>
                    <td
                      className="max-w-[220px] py-2 pr-3 text-xs text-slate-400"
                      title={devs.map((d) => d.serialNumber).join(", ") || undefined}
                    >
                      {distSummary}
                    </td>
                    <td className="max-w-[220px] py-2 pr-3 text-xs text-slate-400">{seenSummary}</td>
                    <td className="py-2 pr-3 text-slate-400">
                      {lastPingAt.get(r.blindUserId)?.toLocaleString() ?? "—"}
                    </td>
                  </tr>
                );
              })}
              {relationships.length === 0 ? (
                <tr>
                  <td className="py-6 text-slate-400" colSpan={4}>
                    No patients assigned yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
