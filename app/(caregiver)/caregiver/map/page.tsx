import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/permissions";
import { TrackingMap } from "@/components/caregiver/tracking-map";

export default async function CaregiverMapPage() {
  const session = await getServerSession(authOptions);
  requireRole(session, ["CAREGIVER"]);

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-semibold">Map tracking</h1>
        <p className="mt-2 text-sm text-slate-400">
          Shows the latest phone GPS ping per patient (from the Android app or MQTT{" "}
          <span className="font-mono text-slate-300">phone/location</span>). Open a marker popup for exact time and
          coordinates.
        </p>
      </div>

      <div className="h-[70vh] overflow-hidden rounded-xl border border-slate-900 bg-slate-950/60">
        <TrackingMap />
      </div>
    </div>
  );
}

