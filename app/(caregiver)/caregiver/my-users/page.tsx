import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { EspDeviceTelemetryLive } from "@/components/caregiver/esp-device-telemetry-live";
import { addPatientAction, registerDeviceForPatientAction, removePatientAction } from "./actions";

const errorMessages: Record<string, string> = {
  "add-patient": "Could not add patient. Check the name (at least 2 characters) and try again.",
  "register-device":
    "Could not register the device. Enter the ESP32 Wi‑Fi MAC in the MAC field. Label is optional (defaults to “Hat device”).",
  "remove-patient": "Could not remove this patient. Try again.",
};

type PageProps = { searchParams?: Record<string, string | string[] | undefined> };

export default async function CaregiverMyUsersPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  requireRole(session, ["CAREGIVER"]);
  const caregiverId = session!.user.id;

  const errorKey =
    typeof searchParams?.error === "string" ? searchParams.error : undefined;
  const errorBanner = errorKey ? errorMessages[errorKey] ?? "Something went wrong. Try again." : null;

  const phoneAppBaseUrl = (process.env.PHONE_APP_BASE_URL ?? "http://10.136.37.252:3000").replace(/\/$/, "");
  const deviceApiKeyForPhone = (process.env.DEVICE_API_KEY ?? "").trim();

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
      {errorBanner ? (
        <div
          className="mt-4 rounded-lg border border-amber-900/60 bg-amber-950/40 px-4 py-3 text-sm text-amber-100"
          role="alert"
        >
          {errorBanner}
        </div>
      ) : null}
      <p className="mt-2 text-sm text-slate-400">
        Add a patient (blind user profile). You can also add the ESP32 Wi‑Fi MAC now, or register it later. Hat
        telemetry reaches the web app when the MQTT worker can resolve the device: either set{" "}
        <span className="font-mono text-slate-300">DEVICE_SERIAL</span> to that MAC for plain number payloads, or have
        the ESP publish <span className="font-mono text-slate-300">JSON</span> with the same MAC (see below) — then no{" "}
        <span className="font-mono text-slate-300">DEVICE_SERIAL</span> change is needed in Portainer when you add a new
        hat.
      </p>
      <p className="mt-2 rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 font-mono text-[11px] text-slate-400">
        MQTT distance example:{" "}
        <span className="text-slate-200">{`{"distanceCm":40,"deviceMac":"98:A3:16:7E:57:C0"}`}</span> — also accepts{" "}
        <span className="text-slate-300">mac</span>, <span className="text-slate-300">serial</span>, or{" "}
        <span className="text-slate-300">serialNumber</span>. Keys <span className="text-slate-300">distanta</span> /{" "}
        <span className="text-slate-300">distance</span> work for the numeric field.
      </p>

      <div className="mt-6 rounded-xl border border-[#1D9E75]/40 bg-slate-950/80 p-5">
        <h2 className="text-sm font-semibold text-[#1D9E75]">Android app — values for this server</h2>
        <p className="mt-2 text-xs text-slate-500">
          Set these on the patient’s phone (Track tab), or in <span className="font-mono">android/.env</span> / EAS
          secrets as <span className="font-mono">EXPO_PUBLIC_*</span>. The patient ID is different for each blind user —
          use the green “Connect this patient” box on their card below.
        </p>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              EXPO_PUBLIC_API_BASE_URL (no /api, no trailing slash)
            </dt>
            <dd className="mt-1 break-all font-mono text-slate-200">{phoneAppBaseUrl}</dd>
            <p className="mt-1 text-xs text-slate-500">
              Override on the server with env <span className="font-mono">PHONE_APP_BASE_URL</span> if this host is
              wrong.
            </p>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              EXPO_PUBLIC_DEVICE_API_KEY (must match server)
            </dt>
            <dd className="mt-1 break-all font-mono text-slate-200">
              {deviceApiKeyForPhone ? deviceApiKeyForPhone : "— not set on server (set DEVICE_API_KEY in .env / Docker)"}
            </dd>
            <p className="mt-1 text-xs text-slate-500">
              This is the same secret as <span className="font-mono">DEVICE_API_KEY</span> in your web container /{" "}
              <span className="font-mono">.env</span> (and MQTT worker). Default in repo Docker is{" "}
              <span className="font-mono">change-me</span> — change it in production.
            </p>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Patient ID on the phone</dt>
            <dd className="mt-1 text-slate-400">
              Copy from each patient’s card below. On the Android <span className="text-slate-200">Track</span> tab the
              caregiver can paste it into the <span className="text-slate-200">Patient ID</span> field (saved on that
              device). Optional build env: <span className="font-mono text-slate-300">EXPO_PUBLIC_BLIND_USER_ID</span>.
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-amber-200/90">
          Anyone with caregiver login can see the device key here — use a strong random key in production and do not
          share screenshots publicly.
        </p>
      </div>

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
                    <div className="mt-3 rounded-lg border border-[#1D9E75]/35 bg-slate-950/80 p-3">
                      <div className="text-xs font-semibold text-[#1D9E75]">Connect this patient (Android)</div>
                      <div className="mt-2 text-sm text-slate-200">
                        Name: <span className="font-semibold">{r.blindUser.name}</span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Put this ID in the phone as <span className="font-mono text-slate-300">EXPO_PUBLIC_BLIND_USER_ID</span>
                        :
                      </div>
                      <div className="mt-1 break-all font-mono text-sm text-slate-100">{r.blindUser.id}</div>
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
                      placeholder="Label (optional)"
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
                        Latest telemetry (ESP + phone)
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-500">
                        This panel is database-backed (not a direct stream): <span className="text-slate-400">distance</span>{" "}
                        comes from ESP over MQTT, while <span className="text-slate-400">Last accel X (phone)</span>{" "}
                        comes from phone motion events. If distance stays empty, verify ESP broker host/port 1883 and{" "}
                        <span className="font-mono text-slate-400">mqtt-worker</span> logs;{" "}
                        <span className="font-mono text-slate-400">DEVICE_API_KEY</span> must match on web/worker.
                      </p>
                      {r.blindUser.devices.map((d) => (
                        <EspDeviceTelemetryLive
                          key={d.id}
                          serialNumber={d.serialNumber}
                          label={d.label}
                          initial={{
                            lastDistanceCm: d.lastDistanceCm,
                            lastAccelX: d.lastAccelX,
                            lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
                            isOnline: d.isOnline,
                            batteryLevel: d.batteryLevel,
                          }}
                        />
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

