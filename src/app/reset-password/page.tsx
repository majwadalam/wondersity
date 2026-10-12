"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogoMark } from "@/components/app/Brand";
import { browserSupabase } from "@/lib/supabase/browser";

// Reached from the reset email (signed in by the link): choose a new password.
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await browserSupabase().auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(/session/i.test(error.message) ? "This link has expired. Ask for a new one from the sign-in page." : error.message);
    router.replace("/home");
  }

  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-canvas px-4 py-16">
      <div className="w-full max-w-[400px]">
        <div className="flex flex-col items-center text-center">
          <LogoMark size={40} />
          <h1 className="display-xl mt-5 text-[28px] text-fg">Choose a new password</h1>
        </div>
        <form onSubmit={save} className="mt-8 rounded-2xl border border-line bg-white p-6 shadow-[var(--shadow-sm)]">
          <label className="block">
            <span className="text-sm font-medium text-fg">New password</span>
            <input
              type="password"
              required
              minLength={8}
              autoFocus
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="field mt-1.5"
            />
          </label>
          <button type="submit" disabled={busy || password.length < 8} className="btn-pill btn-pill-dark mt-4 w-full justify-center py-2.5 text-[15px]">
            {busy ? "Saving…" : "Save and continue"}
          </button>
          {error && (
            <p role="alert" className="mt-4 rounded-lg bg-[#fdeeee] px-3 py-2 text-sm text-[#9b1c20]">
              {error}
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
