import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function getBearerToken(req: Request) {
  const h = req.headers.get("authorization");
  if (!h) return null;
  const [type, token] = h.split(" ");
  if (type?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export async function POST(req: Request) {
  const apiKey = process.env.DEVICE_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Server not configured" }, { status: 500 });

  const token = getBearerToken(req);
  if (token !== apiKey) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | {
        blindUserId?: string;
        speedMps?: number;
        sentAt?: string;
      }
    | null;

  if (!body?.blindUserId || typeof body.speedMps !== "number" || !Number.isFinite(body.speedMps)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { id: body.blindUserId, role: "BLIND_USER", isActive: true },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: "Unknown blind user" }, { status: 404 });

  const sentAt = body.sentAt ? new Date(body.sentAt) : new Date();
  const speedMps = Math.max(0, body.speedMps);
  const speedKmh = speedMps * 3.6;
  const thresholdKmh = Number(process.env.PHONE_SPEED_ALERT_THRESHOLD_KMH ?? "4");
  const cooldownMs = Number(process.env.PHONE_SPEED_ALERT_COOLDOWN_MS ?? "180000");

  const shouldTriggerSpeedAlert =
    Number.isFinite(thresholdKmh) && thresholdKmh > 0 ? speedKmh >= thresholdKmh : speedKmh >= 4;

  if (shouldTriggerSpeedAlert) {
    const lastSpeedAlert = await prisma.safetyMotionAlert.findFirst({
      where: {
        userId: body.blindUserId,
        reason: "SPEED_OVER_LIMIT",
      },
      orderBy: { triggeredAt: "desc" },
      select: { triggeredAt: true },
    });

    const cooldownActive =
      lastSpeedAlert != null && sentAt.getTime() - lastSpeedAlert.triggeredAt.getTime() < Math.max(0, cooldownMs);

    if (!cooldownActive) {
      const speedAlert = await prisma.safetyMotionAlert.create({
        data: {
          userId: body.blindUserId,
          triggeredAt: sentAt,
          // Reused column: for SPEED_OVER_LIMIT reason this value represents speed (m/s), not acceleration.
          peakMagnitudeMs2: speedMps,
          deltaMs2: null,
          reason: "SPEED_OVER_LIMIT",
          latitude: null,
          longitude: null,
        },
        select: { id: true },
      });

      const caregivers = await prisma.careRelationship.findMany({
        where: { blindUserId: body.blindUserId, isActive: true },
        select: { caregiverId: true },
      });

      if (caregivers.length > 0) {
        await prisma.caregiverNotification.createMany({
          data: caregivers.map((c) => ({
            caregiverId: c.caregiverId,
            safetyMotionAlertId: speedAlert.id,
            sentAt,
          })),
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}

