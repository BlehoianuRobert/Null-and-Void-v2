import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "CAREGIVER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const sinceRaw = (url.searchParams.get("since") ?? "").trim();
  const takeRaw = Number(url.searchParams.get("take") ?? "20");
  const take = Number.isFinite(takeRaw) ? Math.max(1, Math.min(50, Math.floor(takeRaw))) : 20;
  const since = sinceRaw ? new Date(sinceRaw) : null;

  const rows = await prisma.caregiverNotification.findMany({
    where: {
      caregiverId: session.user.id,
      safetyMotionAlertId: { not: null },
      ...(since && Number.isFinite(since.getTime()) ? { sentAt: { gt: since } } : {}),
    },
    include: {
      safetyMotionAlert: {
        include: { user: { select: { name: true } } },
      },
    },
    orderBy: { sentAt: "desc" },
    take,
  });

  const items = rows
    .filter((r) => r.safetyMotionAlert != null)
    .map((r) => ({
      id: r.id,
      sentAt: r.sentAt.toISOString(),
      blindUserName: r.safetyMotionAlert!.user.name,
      reason: r.safetyMotionAlert!.reason,
      peakMagnitudeMs2: r.safetyMotionAlert!.peakMagnitudeMs2,
      latitude: r.safetyMotionAlert!.latitude,
      longitude: r.safetyMotionAlert!.longitude,
    }));

  return NextResponse.json({ items });
}

