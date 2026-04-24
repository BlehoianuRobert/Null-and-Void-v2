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

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "CAREGIVER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const blindUserId = url.searchParams.get("blindUserId");
  if (!blindUserId) return NextResponse.json({ error: "Missing blindUserId" }, { status: 400 });

  // Ensure relationship
  const rel = await prisma.careRelationship.findFirst({
    where: { caregiverId: session.user.id, blindUserId, isActive: true },
    select: { id: true },
  });
  if (!rel) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const since = new Date(Date.now() - 5 * 60 * 1000);

  const pings = await prisma.locationPing.findMany({
    where: { userId: blindUserId, sentAt: { gte: since } },
    orderBy: { sentAt: "asc" },
    select: { sentAt: true, latitude: true, longitude: true, speedMps: true },
    take: 500,
  });

  if (pings.length < 2) {
    return NextResponse.json({ avgSpeedMps: 0, samples: pings.length });
  }

  // Prefer device-provided speed when available; otherwise compute from points.
  let totalSpeed = 0;
  let count = 0;

  for (let i = 1; i < pings.length; i++) {
    const prev = pings[i - 1];
    const cur = pings[i];

    if (typeof cur.speedMps === "number" && Number.isFinite(cur.speedMps)) {
      totalSpeed += cur.speedMps;
      count++;
      continue;
    }

    const dt = (cur.sentAt.getTime() - prev.sentAt.getTime()) / 1000;
    if (dt <= 0) continue;
    const d = haversineM(prev.latitude, prev.longitude, cur.latitude, cur.longitude);
    const s = d / dt;
    if (!Number.isFinite(s)) continue;
    totalSpeed += s;
    count++;
  }

  const avgSpeedMps = count > 0 ? totalSpeed / count : 0;
  return NextResponse.json({ avgSpeedMps, samples: count });
}

