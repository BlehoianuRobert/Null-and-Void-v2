import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function getBearerToken(req: Request) {
  const h = req.headers.get("authorization");
  if (!h) return null;
  const [type, token] = h.split(" ");
  if (type?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const apiKey = process.env.DEVICE_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Server not configured" }, { status: 500 });

  const token = getBearerToken(req);
  if (token !== apiKey) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const serialNumber = ctx.params.id;
  if (!serialNumber) return NextResponse.json({ error: "Missing serial" }, { status: 400 });

  const body = (await req.json().catch(() => null)) as
    | {
        distanceCm?: number;
        accelX?: number;
        batteryLevel?: number;
        firmwareVersion?: string;
        latitude?: number;
        longitude?: number;
      }
    | null;

  if (!body || typeof body.distanceCm !== "number") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const device = await prisma.device.findUnique({
    where: { serialNumber },
    select: {
      id: true,
      ownerId: true,
      thresholdCritical: true,
      thresholdNear: true,
      thresholdMedium: true,
    },
  });

  // Device must be registered (so we know which blind user owns it)
  if (!device) return NextResponse.json({ error: "Device not registered" }, { status: 404 });

  const now = new Date();
  const distanceCm = Math.max(0, Math.floor(body.distanceCm));
  const lastAccelX =
    typeof body.accelX === "number" && Number.isFinite(body.accelX) ? body.accelX : undefined;

  await prisma.device.update({
    where: { serialNumber },
    data: {
      isOnline: true,
      lastSeenAt: now,
      lastDistanceCm: distanceCm,
      ...(lastAccelX !== undefined ? { lastAccelX } : {}),
      batteryLevel: typeof body.batteryLevel === "number" ? body.batteryLevel : undefined,
      firmwareVersion: typeof body.firmwareVersion === "string" ? body.firmwareVersion : undefined,
    },
  });

  let severity: "CRITICAL" | "NEAR" | "MEDIUM" | null = null;
  if (distanceCm <= device.thresholdCritical) severity = "CRITICAL";
  else if (distanceCm <= device.thresholdNear) severity = "NEAR";
  else if (distanceCm <= device.thresholdMedium) severity = "MEDIUM";

  if (!severity) {
    return NextResponse.json({ ok: true, triggered: false, distanceCm });
  }

  const alert = await prisma.alertLog.create({
    data: {
      deviceId: device.id,
      userId: device.ownerId,
      distanceCm,
      severity,
      triggeredAt: now,
      latitude: typeof body.latitude === "number" ? body.latitude : null,
      longitude: typeof body.longitude === "number" ? body.longitude : null,
    },
    select: { id: true },
  });

  // Create notifications (real-time pushing via Pusher will be added next)
  const caregivers = await prisma.careRelationship.findMany({
    where: { blindUserId: device.ownerId, isActive: true },
    select: { caregiverId: true },
  });

  if (caregivers.length > 0) {
    await prisma.caregiverNotification.createMany({
      data: caregivers.map((c) => ({
        caregiverId: c.caregiverId,
        alertLogId: alert.id,
        channel: "IN_APP",
        sentAt: now,
      })),
    });
  }

  return NextResponse.json({ ok: true, triggered: true, severity });
}

