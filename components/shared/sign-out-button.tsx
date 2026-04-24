"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm font-semibold text-slate-200 hover:border-slate-700 hover:bg-slate-900/60"
    >
      Sign out
    </button>
  );
}

