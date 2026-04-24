import { LoginForm } from "./login-form";

export default function LoginPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const raw = searchParams?.callbackUrl;
  const callbackUrl = typeof raw === "string" ? raw : undefined;

  return <LoginForm callbackUrl={callbackUrl} />;
}
