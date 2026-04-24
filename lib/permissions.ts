import { redirect } from "next/navigation";
import type { Session } from "next-auth";

export function requireRole(session: Session | null, allowedRoles: string[]) {
  const role = session?.user?.role;
  if (!session?.user?.id) redirect("/login");
  if (!role || !allowedRoles.includes(role)) redirect("/");
  return session;
}

