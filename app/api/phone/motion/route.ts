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
        peakMagnitudeMs2?: number;
        deltaMs2?: number;
        reason?: string;
        latitude?: number;
        longitude?: number;
        triggeredAt?: string;
      }
    | null;

  if (!body?.blindUserId || typeof body.peakMagnitudeMs2 !== "number") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { id: body.blindUserId, role: "BLIND_USER", isActive: true },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: "Unknown blind user" }, { status: 404 });

  const triggeredAt = body.triggeredAt ? new Date(body.triggeredAt) : new Date();
  const reason =
    typeof body.reason === "string" && body.reason.trim().length > 0 ? body.reason.trim() : "UNKNOWN";

  const row = await prisma.safetyMotionAlert.create({
    data: {
      userId: body.blindUserId,
      triggeredAt,
      peakMagnitudeMs2: body.peakMagnitudeMs2,
      deltaMs2: typeof body.deltaMs2 === "number" ? body.deltaMs2 : null,
      reason,
      latitude: typeof body.latitude === "number" ? body.latitude : null,
      longitude: typeof body.longitude === "number" ? body.longitude : null,
    },
    select: { id: true },
  });

  // In-app caregiver notifications: phone accelerometer only (not hat / distance alerts).
  const minPeak = Number(process.env.PHONE_IMPACT_NOTIFY_MIN_PEAK_MS2 ?? "28");
  const notifyCaregivers = Number.isFinite(minPeak) ? body.peakMagnitudeMs2 >= minPeak : true;
  if (notifyCaregivers) {
    const caregivers = await prisma.careRelationship.findMany({
      where: { blindUserId: body.blindUserId, isActive: true },
      select: { caregiverId: true },
    });
    if (caregivers.length > 0) {
      await prisma.caregiverNotification.createMany({
        data: caregivers.map((c) => ({
          caregiverId: c.caregiverId,
          safetyMotionAlertId: row.id,
          sentAt: triggeredAt,
        })),
      });
    }
  }

  return NextResponse.json({ ok: true, id: row.id });
}
