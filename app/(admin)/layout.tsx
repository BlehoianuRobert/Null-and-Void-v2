import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/permissions";
import { AppShell } from "@/components/shared/app-shell";
import { SignOutButton } from "@/components/shared/sign-out-button";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  requireRole(session, ["ADMIN"]);

  return (
    <AppShell
      title="BlindHat"
      roleLabel="Admin"
      nav={[
        { href: "/admin/dashboard", label: "Dashboard" },
        { href: "/admin/users", label: "Users" },
        { href: "/admin/care-relationships", label: "Care relationships" },
        { href: "/admin/devices", label: "Devices" },
        { href: "/admin/alerts", label: "Alerts" },
      ]}
      topRight={<SignOutButton />}
    >
      {children}
    </AppShell>
  );
}

