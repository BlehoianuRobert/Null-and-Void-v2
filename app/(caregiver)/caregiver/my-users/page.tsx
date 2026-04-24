import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { addPatientAction, registerDeviceForPatientAction, removePatientAction } from "./actions";

export default async function CaregiverMyUsersPage() {
  const session = await getServerSession(authOptions);
  requireRole(session, ["CAREGIVER"]);
  const caregiverId = session!.user.id;

  const relationships = await prisma.careRelationship.findMany({
    where: { caregiverId, isActive: true },
    orderBy: { assignedAt: "desc" },
    select: {
      id: true,
      notes: true,
      assignedAt: true,
      blindUser: {
        select: {
          id: true,
          name: true,
          phone: true,
          notes: true,
          devices: {
            select: {
              id: true,
              serialNumber: true,
              label: true,
              isOnline: true,
              lastSeenAt: true,
              batteryLevel: true,
              lastDistanceCm: true,
              lastAccelX: true,
            },
          },
        },
      },
    },
  });

  return (
    <div>
      <h1 className="text-xl font-semibold">My users</h1>
      <p className="mt-2 text-sm text-slate-400">
        Add a patient (blind user profile). You can also add the ESP32 Wi‑Fi MAC now, or register it later.
        Distance and accelerometer values from MQTT appear under each device once the worker{" "}
        <span className="text-slate-300">DEVICE_SERIAL</span> matches that MAC.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-900 bg-slate-950/60 p-5">
          <h2 className="text-sm font-semibold text-slate-200">Add patient</h2>
          <form
            action={async (formData) => {
              "use server";
              const name = String(formData.get("name") ?? "");
              const phone = String(formData.get("phone") ?? "");
              const notes = String(formData.get("notes") ?? "");
              const deviceMac = String(formData.get("deviceMac") ?? "");
              const deviceLabel = String(formData.get("deviceLabel") ?? "");
              await addPatientAction({ name, phone, notes, deviceMac, deviceLabel });
            }}
            className="mt-4 space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-slate-200" htmlFor="name">
                Name
              </label>
              <input
                id="name"
                name="name"
                required
                className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-slate-50 outline-none focus:border-[#1D9E75]"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-200" htmlFor="phone">
                  Phone (optional)
                </label>
                <input
                  id="phone"
                  name="phone"
                  className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-slate-50 outline-none focus:border-[#1D9E75]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-200" htmlFor="notes">
                  Notes (optional)
                </label>
                <input
                  id="notes"
                  name="notes"
                  className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-slate-50 outline-none focus:border-[#1D9E75]"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-200" htmlFor="deviceMac">
                  ESP32 Wi‑Fi MAC (optional)
                </label>
                <input
                  id="deviceMac"
                  name="deviceMac"
                  placeholder="24:6F:28:AA:BB:CC"
                  className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-slate-50 outline-none focus:border-[#1D9E75]"
                />
                <p className="mt-2 text-xs text-slate-500">
                  If provided, we’ll auto-register the device for this patient.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-200" htmlFor="deviceLabel">
                  Device label (optional)
                </label>
                <input
                  id="deviceLabel"
                  name="deviceLabel"
                  placeholder="Hat #1"
                  className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-slate-50 outline-none focus:border-[#1D9E75]"
                />
              </div>
            </div>

            <button
              type="submit"
              className="rounded-lg bg-[#1D9E75] px-4 py-2 text-sm font-semibold text-slate-950 hover:brightness-110"
            >
              Add patient
            </button>
          </form>
        </div>

        <div className="rounded-xl border border-slate-900 bg-slate-950/60 p-5">
          <h2 className="text-sm font-semibold text-slate-200">Assigned patients</h2>
          <div className="mt-4 space-y-4">
            {relationships.length === 0 ? (
              <div className="rounded-lg border border-slate-900 bg-slate-950 p-4 text-sm text-slate-400">
                No assigned patients yet.
              </div>
            ) : null}

            {relationships.map((r) => (
              <div key={r.id} className="rounded-xl border border-slate-900 bg-slate-950/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{r.blindUser.name}</div>
                    <div className="text-xs text-slate-400">
                      Phone: {r.blindUser.phone ?? "—"} • Devices: {r.blindUser.devices.length}
                    </div>
                    <div className="mt-2 text-xs text-slate-400">
                      <span className="font-semibold text-slate-300">Device MAC(s):</span>{" "}
                      {r.blindUser.devices.length > 0
                        ? r.blindUser.devices.map((d) => d.serialNumber).join(", ")
                        : "— (not registered yet)"}
                    </div>
                  </div>
                  <form
                    action={async () => {
                      "use server";
                      await removePatientAction({ blindUserId: r.blindUser.id });
                    }}
                  >
                    <button
                      type="submit"
                      className="rounded-lg border border-red-900/60 bg-slate-950 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-950/30"
                    >
                      Remove
                    </button>
                  </form>
                </div>

                <div className="mt-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Register device (use ESP32 WiFi MAC as serial)
                  </div>
                  <form
                    action={async (formData) => {
                      "use server";
                      const serialNumber = String(formData.get("serialNumber") ?? "");
                      const label = String(formData.get("label") ?? "");
                      await registerDeviceForPatientAction({
                        blindUserId: r.blindUser.id,
                        serialNumber,
                        label,
                      });
                    }}
                    className="mt-2 grid gap-3 sm:grid-cols-3"
                  >
                    <input type="hidden" name="blindUserId" value={r.blindUser.id} />
                    <input
                      name="serialNumber"
                      placeholder="MAC (e.g. 24:6F:28:AA:BB:CC)"
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none focus:border-[#1D9E75]"
                    />
                    <input
                      name="label"
                      placeholder="Label (e.g. Hat #1)"
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none focus:border-[#1D9E75]"
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-white"
                    >
                      Register
                    </button>
                  </form>
                  {r.blindUser.devices.length > 0 ? (
                    <div className="mt-4 space-y-3 rounded-lg border border-slate-900 bg-slate-950/50 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Latest from ESP (MQTT)
                      </div>
                      {r.blindUser.devices.map((d) => (
                        <div key={d.id} className="border-t border-slate-900 pt-3 first:border-t-0 first:pt-0">
                          <div className="text-sm font-medium text-slate-200">
                            {d.label}{" "}
                            <span className="font-normal text-slate-500">({d.serialNumber})</span>
                          </div>
                          <dl className="mt-2 grid gap-1 text-xs text-slate-400 sm:grid-cols-2">
                            <div>
                              <dt className="text-slate-500">Last distance</dt>
                              <dd className="font-mono text-slate-200">
                                {d.lastDistanceCm != null ? `${d.lastDistanceCm} cm` : "—"}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-slate-500">Last accel X</dt>
                              <dd className="font-mono text-slate-200">
                                {d.lastAccelX != null ? String(d.lastAccelX) : "—"}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-slate-500">Last seen</dt>
                              <dd>{d.lastSeenAt ? d.lastSeenAt.toLocaleString() : "—"}</dd>
                            </div>
                            <div>
                              <dt className="text-slate-500">Online / battery</dt>
                              <dd>
                                {d.isOnline ? "Online" : "Offline"}
                                {d.batteryLevel != null ? ` • ${d.batteryLevel}%` : ""}
                              </dd>
                            </div>
                          </dl>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

