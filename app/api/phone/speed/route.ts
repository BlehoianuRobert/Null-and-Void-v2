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

  await prisma.device.updateMany({
    where: { ownerId: body.blindUserId },
    data: {
      lastPhoneSpeedMps: speedMps,
      lastPhoneSpeedAt: sentAt,
    },
  });

  return NextResponse.json({ ok: true });
}

