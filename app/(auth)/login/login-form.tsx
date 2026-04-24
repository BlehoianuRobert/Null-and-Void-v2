"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { loginSchema, type LoginInput } from "@/lib/validations";

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setSubmitError(null);

    try {
      const res = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
        callbackUrl: callbackUrl || "/",
      });

      if (!res) {
        setSubmitError("No response from server. Try again.");
        return;
      }

      if (res.error) {
        setSubmitError(`Sign-in failed (${res.error}).`);
        return;
      }

      if (res.url) {
        router.push(res.url);
        router.refresh();
        return;
      }

      router.push("/");
      router.refresh();
    } catch (e) {
      setSubmitError("Sign-in request failed. Check server logs.");
    }
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-slate-950 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/40 p-8 shadow-xl backdrop-blur">
        <div className="mb-8">
          <div className="text-xs font-semibold tracking-wide text-[#1D9E75]">
            BlindHat
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-50">Sign in</h1>
          <p className="mt-2 text-sm text-slate-400">
            Admin and caregiver accounts only.
          </p>
        </div>

        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <div>
            <label className="block text-sm font-medium text-slate-200" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-slate-50 outline-none ring-0 focus:border-[#1D9E75]"
              {...form.register("email")}
            />
            {form.formState.errors.email ? (
              <p className="mt-2 text-sm text-red-400">{form.formState.errors.email.message}</p>
            ) : null}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-slate-50 outline-none ring-0 focus:border-[#1D9E75]"
              {...form.register("password")}
            />
            {form.formState.errors.password ? (
              <p className="mt-2 text-sm text-red-400">{form.formState.errors.password.message}</p>
            ) : null}
          </div>

          {submitError ? <p className="text-sm text-red-400">{submitError}</p> : null}

          <button
            type="submit"
            className="w-full rounded-lg bg-[#1D9E75] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:opacity-60"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Need help?{" "}
          <Link className="text-[#1D9E75] hover:underline" href="/">
            Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
