import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeDeviceSerial } from "@/lib/normalizeDeviceSerial";

function getBearerToken(req: Request) {
  const h = req.headers.get("authorization");
  if (!h) return null;
  const [type, token] = h.split(" ");
  if (type?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

function asFiniteNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(String(v).replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const apiKey = process.env.DEVICE_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Server not configured" }, { status: 500 });

  const token = getBearerToken(req);
  if (token !== apiKey) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const fromUrl = (ctx.params.id ?? "").trim();
  if (!fromUrl) return NextResponse.json({ error: "Missing serial" }, { status: 400 });

  const canon = normalizeDeviceSerial(fromUrl);
  const serialVariants = [...new Set([fromUrl, canon, canon.replace(/:/g, "-")])].filter(Boolean);

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;

  const distanceCmRaw = asFiniteNumber(body?.distanceCm);
  if (!body || distanceCmRaw === undefined) {
    return NextResponse.json({ error: "Invalid body: distanceCm must be a number" }, { status: 400 });
  }

  const device = await prisma.device.findFirst({
    where: { serialNumber: { in: serialVariants } },
    select: {
      id: true,
      serialNumber: true,
      ownerId: true,
      thresholdCritical: true,
      thresholdNear: true,
      thresholdMedium: true,
    },
  });

  // Device must be registered (so we know which blind user owns it)
  if (!device) return NextResponse.json({ error: "Device not registered" }, { status: 404 });

  const now = new Date();
  const distanceCm = Math.max(0, Math.floor(distanceCmRaw));
  const accelParsed = asFiniteNumber(body.accelX);
  const lastAccelX = accelParsed !== undefined ? accelParsed : undefined;

  await prisma.device.update({
    where: { id: device.id },
    data: {
      isOnline: true,
      lastSeenAt: now,
      lastDistanceCm: distanceCm,
      ...(lastAccelX !== undefined ? { lastAccelX } : {}),
      batteryLevel: (() => {
        const b = asFiniteNumber(body.batteryLevel);
        return b !== undefined ? Math.round(Math.max(0, Math.min(100, b))) : undefined;
      })(),
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
      latitude: asFiniteNumber(body.latitude) ?? null,
      longitude: asFiniteNumber(body.longitude) ?? null,
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

