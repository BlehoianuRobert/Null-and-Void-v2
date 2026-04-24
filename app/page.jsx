import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import LandingPage from "@/components/landing/LandingPage";

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role === "ADMIN") redirect("/admin/dashboard");
  if (session?.user?.role === "CAREGIVER") redirect("/caregiver/dashboard");
  return <LandingPage />;
}
