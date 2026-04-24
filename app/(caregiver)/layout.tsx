import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/permissions";
import { AppShell } from "@/components/shared/app-shell";
import { SignOutButton } from "@/components/shared/sign-out-button";

export default async function CaregiverLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  requireRole(session, ["CAREGIVER"]);

  return (
    <AppShell
      title="BlindHat"
      roleLabel="Caregiver"
      nav={[
        { href: "/caregiver/dashboard", label: "Dashboard" },
        { href: "/caregiver/my-users", label: "My users" },
        { href: "/caregiver/map", label: "Map tracking" },
        { href: "/caregiver/alerts", label: "Alerts" },
        { href: "/caregiver/notifications", label: "Notifications" },
      ]}
      topRight={<SignOutButton />}
    >
      {children}
    </AppShell>
  );
}

