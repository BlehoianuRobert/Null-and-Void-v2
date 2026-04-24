"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { loginSchema } from "@/lib/validations";

function RadarViz() {
  return (
    <div className="relative w-64 h-64 flex items-center justify-center">
      {/* Grid background */}
      <div
        className="absolute inset-0 rounded-full overflow-hidden"
        style={{
          backgroundImage: `
            linear-gradient(rgba(29,158,117,0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(29,158,117,0.08) 1px, transparent 1px)
          `,
          backgroundSize: "24px 24px",
        }}
      />
      {/* Crosshairs */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-full h-px bg-[#1D9E75]/15" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-px h-full bg-[#1D9E75]/15" />
      </div>
      {/* Static rings */}
      {[220, 164, 108, 56].map((size, i) => (
        <div
          key={i}
          className="absolute rounded-full border border-[#1D9E75]/20"
          style={{ width: size, height: size }}
        />
      ))}
      {/* Radar sweep */}
      <div
        className="absolute inset-0 rounded-full overflow-hidden"
        style={{
          animation: "scan-line 4s linear infinite",
          background:
            "conic-gradient(from 0deg, rgba(29,158,117,0.28) 0deg, rgba(29,158,117,0.06) 45deg, transparent 45deg)",
        }}
      />
      {/* Expanding ping rings */}
      {[0, 1.1, 2.2].map((delay, i) => (
        <div
          key={i}
          className="absolute rounded-full border border-[#1D9E75]/70"
          style={{
            width: 56,
            height: 56,
            animation: `radar-ring 3.3s ease-out ${delay}s infinite`,
          }}
        />
      ))}
      {/* Obstacle dots */}
      <div
        className="absolute w-2.5 h-2.5 rounded-full bg-amber-400"
        style={{ top: "22%", left: "65%", boxShadow: "0 0 8px #f59e0b" }}
      />
      <div
        className="absolute w-2 h-2 rounded-full bg-red-400"
        style={{ top: "60%", left: "26%", boxShadow: "0 0 8px #f87171" }}
      />
      <div
        className="absolute w-2 h-2 rounded-full bg-emerald-400"
        style={{ top: "36%", left: "38%", boxShadow: "0 0 6px #34d399" }}
      />
      {/* Center sensor */}
      <div
        className="relative w-4 h-4 rounded-full bg-[#1D9E75] z-10"
        style={{ animation: "glow-pulse 2s ease-in-out infinite", boxShadow: "0 0 16px #1D9E75" }}
      />
    </div>
  );
}

export function LoginForm({ callbackUrl }) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState(null);

  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values) {
    setSubmitError(null);
    try {
      const res = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
        callbackUrl: callbackUrl || "/",
      });
      if (!res) { setSubmitError("No response from server. Try again."); return; }
      if (res.error) { setSubmitError("Invalid email or password."); return; }
      if (res.url) { router.push(res.url); router.refresh(); return; }
      router.push("/");
      router.refresh();
    } catch {
      setSubmitError("Sign-in request failed. Check server logs.");
    }
  }

  return (
    <div className="min-h-screen flex bg-[#060a0f]">

      {/* ── LEFT PANEL ── */}
      <div
        className="hidden lg:flex w-1/2 flex-col items-center justify-center relative overflow-hidden px-14"
        style={{
          background:
            "radial-gradient(ellipse at 35% 50%, rgba(29,158,117,0.13) 0%, #060a0f 70%)",
        }}
      >
        {/* Grid overlay */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(29,158,117,0.05) 1px, transparent 1px),
              linear-gradient(90deg, rgba(29,158,117,0.05) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative z-10 flex flex-col items-center text-center max-w-sm gap-10">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{
                background: "rgba(29,158,117,0.15)",
                border: "1px solid rgba(29,158,117,0.4)",
                boxShadow: "0 0 20px rgba(29,158,117,0.2)",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                  stroke="#1D9E75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                />
                <circle cx="12" cy="12" r="3" stroke="#1D9E75" strokeWidth="2" />
                <circle cx="12" cy="12" r="1" fill="#1D9E75" />
              </svg>
            </div>
            <span className="text-2xl font-extrabold text-white tracking-tight">BlindHat</span>
          </div>

          <RadarViz />

          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Smart Navigation Platform</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Real-time obstacle detection and caregiver monitoring for the visually impaired.
            </p>
          </div>

          {/* Feature bullets */}
          <div className="space-y-3 w-full text-left">
            {[
              "Real-time sensor data via MQTT",
              "GPS tracking & alert management",
              "Velocity-aware obstacle detection",
            ].map((text, i) => (
              <div key={i} className="flex items-center gap-3 text-sm text-slate-300">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1D9E75] flex-shrink-0" style={{ boxShadow: "0 0 6px #1D9E75" }} />
                {text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div
        className="w-full lg:w-1/2 flex items-center justify-center px-6 py-14"
        style={{ background: "#0a0f1a" }}
      >
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-[#1D9E75]/20 border border-[#1D9E75]/40 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="#1D9E75" strokeWidth="2" />
                <circle cx="12" cy="12" r="3" stroke="#1D9E75" strokeWidth="2" />
              </svg>
            </div>
            <span className="text-lg font-bold text-white">BlindHat</span>
          </div>

          <div className="mb-8">
            <h1 className="text-3xl font-extrabold text-white mb-2">Welcome back</h1>
            <p className="text-slate-400 text-sm">Sign in to your admin or caregiver account</p>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2" htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full rounded-xl px-4 py-3 text-white placeholder-slate-500 outline-none transition-all duration-200 focus:ring-2"
                style={{
                  background: "#131c2e",
                  border: "1px solid rgba(100,116,139,0.4)",
                  focusBorderColor: "#1D9E75",
                }}
                onFocus={(e) => {
                  e.target.style.border = "1px solid #1D9E75";
                  e.target.style.boxShadow = "0 0 0 3px rgba(29,158,117,0.15)";
                }}
                onBlur={(e) => {
                  e.target.style.border = "1px solid rgba(100,116,139,0.4)";
                  e.target.style.boxShadow = "none";
                }}
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                    <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full rounded-xl px-4 py-3 text-white placeholder-slate-500 outline-none transition-all duration-200"
                style={{
                  background: "#131c2e",
                  border: "1px solid rgba(100,116,139,0.4)",
                }}
                onFocus={(e) => {
                  e.target.style.border = "1px solid #1D9E75";
                  e.target.style.boxShadow = "0 0 0 3px rgba(29,158,117,0.15)";
                }}
                onBlur={(e) => {
                  e.target.style.border = "1px solid rgba(100,116,139,0.4)";
                  e.target.style.boxShadow = "none";
                }}
                {...form.register("password")}
              />
              {form.formState.errors.password && (
                <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                    <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            {/* Error */}
            {submitError && (
              <div
                className="rounded-xl px-4 py-3 text-sm text-red-300 flex items-center gap-2.5"
                style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                  <path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                {submitError}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="w-full rounded-xl px-4 py-3.5 text-sm font-bold text-white transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, #1D9E75 0%, #0f7a5a 100%)",
                boxShadow: "0 0 24px rgba(29,158,117,0.35), 0 4px 12px rgba(0,0,0,0.3)",
              }}
            >
              {form.formState.isSubmitting ? (
                <>
                  <span
                    className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                    style={{ animation: "spin 0.75s linear infinite" }}
                  />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </>
              )}
            </button>
          </form>

          <div
            className="mt-6 pt-6 flex items-center justify-between text-sm"
            style={{ borderTop: "1px solid rgba(51,65,85,0.6)" }}
          >
            <Link
              href="/"
              className="text-slate-400 hover:text-[#1D9E75] transition-colors flex items-center gap-1.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back to home
            </Link>
            <span className="text-slate-600 text-xs">Admin & Caregiver only</span>
          </div>
        </div>
      </div>
    </div>
  );
}
