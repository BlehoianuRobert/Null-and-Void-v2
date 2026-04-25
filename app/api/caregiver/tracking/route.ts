import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function parseWindow(url: URL): { since: Date; until: Date; mode: "1d" | "2d" | "1w" | "day"; day: string | null } {
  const mode = (url.searchParams.get("window") ?? "1d").toLowerCase();
  const now = new Date();

  if (mode === "2d") {
    return { since: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), until: now, mode: "2d", day: null };
  }
  if (mode === "1w" || mode === "7d") {
    return { since: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), until: now, mode: "1w", day: null };
  }
  if (mode === "day") {
    const dayRaw = (url.searchParams.get("day") ?? "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(dayRaw)) {
      const since = new Date(`${dayRaw}T00:00:00.000Z`);
      const until = new Date(`${dayRaw}T23:59:59.999Z`);
      return { since, until, mode: "day", day: dayRaw };
    }
  }

  return { since: new Date(now.getTime() - 24 * 60 * 60 * 1000), until: now, mode: "1d", day: null };
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "CAREGIVER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const caregiverId = session.user.id;
  const url = new URL(req.url);
  const windowInfo = parseWindow(url);

  const relationships = await prisma.careRelationship.findMany({
    where: { caregiverId, isActive: true },
    select: { blindUserId: true, blindUser: { select: { name: true } } },
  });

  const blindUserIds = relationships.map((r) => r.blindUserId);
  if (blindUserIds.length === 0) return NextResponse.json({ users: [] });

  const nameByUserId = new Map(relationships.map((r) => [r.blindUserId, r.blindUser.name]));

  const [devices, motionAlerts] = await Promise.all([
    prisma.device.findMany({
      where: { ownerId: { in: blindUserIds } },
      orderBy: [{ ownerId: "asc" }, { updatedAt: "desc" }],
      select: {
        ownerId: true,
        serialNumber: true,
        label: true,
        lastDistanceCm: true,
        isOnline: true,
        batteryLevel: true,
        lastSeenAt: true,
        lastPhoneSpeedMps: true,
        lastPhoneSpeedAt: true,
      },
    }),
    prisma.safetyMotionAlert.findMany({
      where: { userId: { in: blindUserIds } },
      orderBy: [{ userId: "asc" }, { triggeredAt: "desc" }],
      select: {
        userId: true,
        triggeredAt: true,
        reason: true,
        peakMagnitudeMs2: true,
      },
      take: 1000,
    }),
  ]);

  const firstDeviceByUser = new Map<string, (typeof devices)[number]>();
  for (const d of devices) {
    if (!firstDeviceByUser.has(d.ownerId)) firstDeviceByUser.set(d.ownerId, d);
  }

  const latestMotionByUser = new Map<string, (typeof motionAlerts)[number]>();
  for (const m of motionAlerts) {
    if (!latestMotionByUser.has(m.userId)) latestMotionByUser.set(m.userId, m);
  }

  // Phone GPS pings for selected range
  const pings = await prisma.locationPing.findMany({
    where: {
      userId: { in: blindUserIds },
      sentAt: { gte: windowInfo.since, lte: windowInfo.until },
    },
    orderBy: [{ userId: "asc" }, { sentAt: "asc" }],
    take: 12000,
    select: {
      userId: true,
      sentAt: true,
      latitude: true,
      longitude: true,
    },
  });

  const grouped = new Map<string, typeof pings>();
  for (const p of pings) {
    const list = grouped.get(p.userId) ?? [];
    list.push(p);
    grouped.set(p.userId, list);
  }

  const users = blindUserIds.map((blindUserId) => {
    const userPings = grouped.get(blindUserId) ?? [];
    let totalM = 0;
    for (let i = 1; i < userPings.length; i++) {
      const prev = userPings[i - 1];
      const cur = userPings[i];
      const d = haversineM(prev.latitude, prev.longitude, cur.latitude, cur.longitude);
      // Ignore likely GPS spikes; >500m between 15s samples is usually noise.
      if (d <= 500) totalM += d;
    }

    const latest = userPings.length > 0 ? userPings[userPings.length - 1] : null;
    const device = firstDeviceByUser.get(blindUserId) ?? null;
    const motion = latestMotionByUser.get(blindUserId) ?? null;
    return {
      blindUserId,
      blindUserName: nameByUserId.get(blindUserId) ?? "Unknown",
      totalDistanceKm: Number((totalM / 1000).toFixed(2)),
      pingCount: userPings.length,
      lastSeenAt: latest?.sentAt.toISOString() ?? null,
      latestPoint: latest
        ? {
            latitude: latest.latitude,
            longitude: latest.longitude,
            triggeredAt: latest.sentAt.toISOString(),
          }
        : null,
      track: userPings.map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
        triggeredAt: p.sentAt.toISOString(),
      })),
      esp: device
        ? {
            serialNumber: device.serialNumber,
            label: device.label,
            lastDistanceCm: device.lastDistanceCm,
            isOnline: device.isOnline,
            batteryLevel: device.batteryLevel,
            lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
          }
        : null,
      phone: {
        realtimeSpeedMps:
          device && typeof device.lastPhoneSpeedMps === "number" && Number.isFinite(device.lastPhoneSpeedMps)
            ? device.lastPhoneSpeedMps
            : null,
        realtimeSpeedAt: device?.lastPhoneSpeedAt?.toISOString() ?? null,
        lastGpsPingAt: latest?.sentAt.toISOString() ?? null,
        lastImpactAt: motion?.triggeredAt?.toISOString() ?? null,
        lastImpactReason: motion?.reason ?? null,
        lastImpactPeakMs2:
          motion && typeof motion.peakMagnitudeMs2 === "number" && Number.isFinite(motion.peakMagnitudeMs2)
            ? motion.peakMagnitudeMs2
            : null,
      },
    };
  });

  return NextResponse.json({
    window: windowInfo.mode,
    day: windowInfo.day,
    since: windowInfo.since.toISOString(),
    until: windowInfo.until.toISOString(),
    users,
  });
}

