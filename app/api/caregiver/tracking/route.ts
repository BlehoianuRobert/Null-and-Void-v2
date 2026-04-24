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

  const nameByUserId = new Map(relationships.map((r) => [r.blindUserId, r.blindUser.name]));

  // Latest phone ping with GPS for each blind user
  const pings = await prisma.locationPing.findMany({
    where: { userId: { in: blindUserIds } },
    orderBy: { sentAt: "desc" },
    take: 300,
    select: {
      userId: true,
      sentAt: true,
      latitude: true,
      longitude: true,
    },
  });

  const firstPingByUserId = new Map<string, typeof pings[number]>();
  for (const p of pings) {
    if (!firstPingByUserId.has(p.userId)) firstPingByUserId.set(p.userId, p);
  }

  const points = Array.from(firstPingByUserId.entries()).map(([blindUserId, p]) => ({
    blindUserId,
    blindUserName: nameByUserId.get(blindUserId) ?? "Unknown",
    deviceSerialNumber: "PHONE",
    severity: "MEDIUM" as const,
    distanceCm: 0,
    triggeredAt: p.sentAt.toISOString(),
    latitude: p.latitude,
    longitude: p.longitude,
  }));

  return NextResponse.json({ points });
}

