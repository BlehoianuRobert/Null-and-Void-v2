import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "CAREGIVER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const caregiverId = session.user.id;

  const relationships = await prisma.careRelationship.findMany({
    where: { caregiverId, isActive: true },
    select: { blindUserId: true, blindUser: { select: { name: true } } },
  });

  const blindUserIds = relationships.map((r) => r.blindUserId);
  if (blindUserIds.length === 0) return NextResponse.json({ points: [] });

  // For each blind user, take their latest alert that includes GPS
  const alerts = await prisma.alertLog.findMany({
    where: {
      userId: { in: blindUserIds },
      latitude: { not: null },
      longitude: { not: null },
    },
    orderBy: { triggeredAt: "desc" },
    take: 200,
    select: {
      userId: true,
      severity: true,
      distanceCm: true,
      triggeredAt: true,
      latitude: true,
      longitude: true,
      device: { select: { serialNumber: true } },
    },
  });

  const nameByUserId = new Map(relationships.map((r) => [r.blindUserId, r.blindUser.name]));
  const firstByUserId = new Map<string, typeof alerts[number]>();
  for (const a of alerts) {
    if (!firstByUserId.has(a.userId)) firstByUserId.set(a.userId, a);
  }

  const points = Array.from(firstByUserId.entries()).map(([blindUserId, a]) => ({
    blindUserId,
    blindUserName: nameByUserId.get(blindUserId) ?? "Unknown",
    deviceSerialNumber: a.device.serialNumber,
    severity: a.severity,
    distanceCm: a.distanceCm,
    triggeredAt: a.triggeredAt.toISOString(),
    latitude: a.latitude!,
    longitude: a.longitude!,
  }));

  return NextResponse.json({ points });
}

