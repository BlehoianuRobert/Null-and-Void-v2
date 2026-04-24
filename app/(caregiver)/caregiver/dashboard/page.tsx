import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export default async function CaregiverDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "CAREGIVER") redirect("/");

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 text-slate-50">
      <h1 className="text-2xl font-semibold">Caregiver dashboard</h1>
      <p className="mt-2 text-sm text-slate-400">
        Signed in as <span className="text-slate-200">{session.user.email}</span>
      </p>
      <p className="mt-6 text-sm text-slate-400">
        This is a placeholder page. Next we’ll add assigned users, alerts, and notifications.
      </p>
    </div>
  );
}
