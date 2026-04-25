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
        latitude?: number;
        longitude?: number;
        accuracyM?: number;
        speedMps?: number;
        sentAt?: string;
      }
    | null;

  if (!body?.blindUserId || typeof body.latitude !== "number" || typeof body.longitude !== "number") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const sentAt = body.sentAt ? new Date(body.sentAt) : new Date();

  await prisma.locationPing.create({
    data: {
      userId: body.blindUserId,
      latitude: body.latitude,
      longitude: body.longitude,
      accuracyM: typeof body.accuracyM === "number" ? body.accuracyM : null,
      speedMps: typeof body.speedMps === "number" ? body.speedMps : null,
      sentAt,
    },
  });

  return NextResponse.json({ ok: true });
}

