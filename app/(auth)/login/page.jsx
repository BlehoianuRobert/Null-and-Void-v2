import { LoginForm } from "./login-form";

export default function LoginPage({ searchParams }) {
  const raw = searchParams?.callbackUrl;
  const callbackUrl = typeof raw === "string" ? raw : undefined;
  return <LoginForm callbackUrl={callbackUrl} />;
}
