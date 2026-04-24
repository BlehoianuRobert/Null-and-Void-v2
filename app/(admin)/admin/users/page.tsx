import { prisma } from "@/lib/prisma";
import { createUserAction } from "./actions";

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      notes: true,
      createdAt: true,
    },
    take: 50,
  });

  return (
    <div>
      <h1 className="text-xl font-semibold">Users</h1>
      <p className="mt-2 text-sm text-slate-400">
        Create Admin/Caregiver accounts (with credentials) and Blind User profiles (no login).
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-900 bg-slate-950/60 p-5">
          <h2 className="text-sm font-semibold text-slate-200">Create user</h2>

          <form
            action={async (formData) => {
              "use server";
              const role = String(formData.get("role") ?? "");
              const name = String(formData.get("name") ?? "");
              const phone = String(formData.get("phone") ?? "");
              const notes = String(formData.get("notes") ?? "");
              const email = String(formData.get("email") ?? "");
              const password = String(formData.get("password") ?? "");

              if (role === "BLIND_USER") {
                await createUserAction({ role, name, phone, notes });
                return;
              }

              await createUserAction({ role, name, phone, email, password });
            }}
            className="mt-4 space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-200" htmlFor="role">
                  Role
                </label>
                <select
                  id="role"
                  name="role"
                  defaultValue="BLIND_USER"
                  className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-slate-50 outline-none focus:border-[#1D9E75]"
                >
                  <option value="BLIND_USER">BLIND_USER (profile only)</option>
                  <option value="CAREGIVER">CAREGIVER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>

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
                <label className="block text-sm font-medium text-slate-200" htmlFor="email">
                  Email (Admin/Caregiver only)
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-slate-50 outline-none focus:border-[#1D9E75]"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-200" htmlFor="password">
                  Password (Admin/Caregiver only)
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-slate-50 outline-none focus:border-[#1D9E75]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200" htmlFor="notes">
                  Notes (Blind user only)
                </label>
                <input
                  id="notes"
                  name="notes"
                  className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-slate-50 outline-none focus:border-[#1D9E75]"
                />
              </div>
            </div>

            <button
              type="submit"
              className="rounded-lg bg-[#1D9E75] px-4 py-2 text-sm font-semibold text-slate-950 hover:brightness-110"
            >
              Create
            </button>
          </form>
        </div>

        <div className="rounded-xl border border-slate-900 bg-slate-950/60 p-5">
          <h2 className="text-sm font-semibold text-slate-200">Latest users</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Phone</th>
                  <th className="py-2 pr-3">Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {users.map((u) => (
                  <tr key={u.id} className="text-slate-200">
                    <td className="py-2 pr-3">{u.name}</td>
                    <td className="py-2 pr-3">{u.role}</td>
                    <td className="py-2 pr-3 text-slate-400">{u.email ?? "—"}</td>
                    <td className="py-2 pr-3 text-slate-400">{u.phone ?? "—"}</td>
                    <td className="py-2 pr-3">{u.isActive ? "Yes" : "No"}</td>
                  </tr>
                ))}
                {users.length === 0 ? (
                  <tr>
                    <td className="py-6 text-slate-400" colSpan={5}>
                      No users yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

