import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeDeviceSerial } from "@/lib/normalizeDeviceSerial";

/** Caregiver-only: latest stored telemetry fields for one device (by MAC / serial). */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "CAREGIVER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const fromQuery = searchParams.get("serial")?.trim() ?? "";
  if (!fromQuery) return NextResponse.json({ error: "Missing serial" }, { status: 400 });

  const canon = normalizeDeviceSerial(fromQuery);
  const serialVariants = [...new Set([fromQuery, canon, canon.replace(/:/g, "-")])].filter(Boolean);

  const device = await prisma.device.findFirst({
    where: { serialNumber: { in: serialVariants } },
    select: {
      id: true,
      ownerId: true,
      label: true,
      serialNumber: true,
      lastDistanceCm: true,
      lastAccelX: true,
      lastPhoneSpeedMps: true,
      lastPhoneSpeedAt: true,
      lastSeenAt: true,
      isOnline: true,
      batteryLevel: true,
    },
  });

  if (!device) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowed = await prisma.careRelationship.findFirst({
    where: {
      caregiverId: session.user.id,
      blindUserId: device.ownerId,
      isActive: true,
    },
    select: { id: true },
  });

  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({
    serialNumber: device.serialNumber,
    label: device.label,
    lastDistanceCm: device.lastDistanceCm,
    lastAccelX: device.lastAccelX,
    lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
    isOnline: device.isOnline,
    batteryLevel: device.batteryLevel,
    lastPhoneSpeedMps: device.lastPhoneSpeedMps ?? null,
    lastPhoneSpeedAt: device.lastPhoneSpeedAt?.toISOString() ?? null,
  });
}
