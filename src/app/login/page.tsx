"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { LogoMark } from "@/components/app/Brand";
import { browserSupabase } from "@/lib/supabase/browser";

// Sign in or create an account: Google, or email and password (with a reset
// link by email). New accounts go to onboarding.

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}

type Mode = "signin" | "signup" | "forgot";

function Login() {
  const params = useSearchParams();
  const router = useRouter();
  const topic = params.get("topic");
  const [mode, setMode] = useState<Mode>(params.get("mode") === "signup" ? "signup" : "signin");
  // Where to go after signing in: onboarding decides whether it's needed.
  const next = `/welcome${topic ? `?topic=${encodeURIComponent(topic)}` : ""}`;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState(
    params.get("error") === "browser"
      ? "Your email is confirmed. Sign in with your password."
      : params.get("error") === "link"
        ? "That link has expired or was already used."
        : ""
  );

  const callback = (to: string) => `${window.location.origin}/auth/callback?next=${encodeURIComponent(to)}`;
  const switchTo = (m: Mode) => {
    setMode(m);
    setError("");
    setNotice(null);
  };

  async function google() {
    setBusy(true);
    setError("");
    const { error } = await browserSupabase().auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback(next) } });
    if (error) {
      setError(/not enabled|unsupported provider/i.test(error.message) ? "Google sign-in isn't switched on yet. Use your email for now." : error.message);
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice(null);
    const auth = browserSupabase().auth;
    const address = email.trim();
    if (mode === "signin") {
      const { error } = await auth.signInWithPassword({ email: address, password });
      setBusy(false);
      if (error) return setError(/confirm/i.test(error.message) ? "Confirm your email first: open the link we sent you, then sign in." : "That email and password don't match.");
      return router.replace(next);
    }
    if (mode === "signup") {
      const { data, error } = await auth.signUp({ email: address, password, options: { emailRedirectTo: callback(next) } });
      setBusy(false);
      if (error) return setError(error.status === 429 ? "Too many attempts just now. Wait a minute and try again." : error.message);
      // Signed straight in when email confirmation is off; otherwise they confirm first.
      if (data.session) return router.replace(next);
      return setNotice(`We sent a confirmation link to ${address}. Open it (in any browser), then sign in here.`);
    }
    const { error } = await auth.resetPasswordForEmail(address, { redirectTo: callback("/reset-password") });
    setBusy(false);
    if (error) return setError(error.status === 429 ? "Too many emails just now. Wait a minute and try again." : error.message);
    setNotice(`If ${address} has an account, a link to set a new password is on its way. Open it in this browser.`);
  }

  const title = mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset your password" : "Welcome back";
  const sub = topic ? (
    <>
      {mode === "signup" ? "Create an account" : "Sign in"} to start your course on <span className="font-medium text-fg">{topic}</span>. It&rsquo;s free.
    </>
  ) : mode === "signup" ? (
    "Free while Wondersity is in beta. No card needed."
  ) : mode === "forgot" ? (
    "We'll email you a link to set a new one."
  ) : (
    "Sign in to pick up where you left off."
  );

  return (
    <main className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden bg-canvas px-4 py-16">
      <div className="relative w-full max-w-[400px]">
        <div className="flex flex-col items-center text-center">
          <LogoMark size={40} />
          <h1 className="display-xl mt-5 text-[28px] text-fg">{title}</h1>
          <p className="mt-2 text-[15px] text-muted">{sub}</p>
        </div>

        <div className="mt-8 rounded-2xl border border-line bg-white p-6 shadow-[var(--shadow-sm)]">
          {mode !== "forgot" && (
            <>
              <button
                type="button"
                onClick={google}
                disabled={busy}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-line bg-white py-2.5 text-[15px] font-medium text-fg transition-colors hover:bg-canvas disabled:opacity-60"
              >
                <GoogleIcon /> Continue with Google
              </button>
              <div className="my-5 flex items-center gap-3 text-xs text-muted">
                <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
              </div>
            </>
          )}
          <form onSubmit={submit} className="space-y-4">
            <Field label="Email">
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="field"
              />
            </Field>
            {mode !== "forgot" && (
              <Field
                label="Password"
                aside={
                  mode === "signin" && (
                    <button type="button" onClick={() => switchTo("forgot")} className="text-[13px] text-muted hover:text-fg">
                      Forgot?
                    </button>
                  )
                }
              >
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "signup" ? "At least 8 characters" : ""}
                  className="field"
                />
              </Field>
            )}
            <button
              type="submit"
              disabled={busy || !email.includes("@") || (mode !== "forgot" && password.length < 8)}
              className="btn-pill btn-pill-dark w-full justify-center py-2.5 text-[15px]"
            >
              {busy ? "One moment…" : mode === "signup" ? "Create account" : mode === "forgot" ? "Email me a link" : "Sign in"}
            </button>
          </form>
          {notice && (
            <p role="status" className="mt-4 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent-strong">
              {notice}
            </p>
          )}
          {error && (
            <p role="alert" className="mt-4 rounded-lg bg-[#fdeeee] px-3 py-2 text-sm text-[#9b1c20]">
              {error}
            </p>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-muted">
          {mode === "signup" ? (
            <>
              Already have an account?{" "}
              <button type="button" onClick={() => switchTo("signin")} className="font-medium text-fg hover:underline">
                Sign in
              </button>
            </>
          ) : mode === "forgot" ? (
            <button type="button" onClick={() => switchTo("signin")} className="font-medium text-fg hover:underline">
              Back to sign in
            </button>
          ) : (
            <>
              New to Wondersity?{" "}
              <button type="button" onClick={() => switchTo("signup")} className="font-medium text-fg hover:underline">
                Create an account
              </button>
            </>
          )}
        </p>
        <p className="mt-3 text-center text-xs leading-relaxed text-muted">
          By continuing you agree to our{" "}
          <Link href="/terms" className="underline hover:text-fg">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:text-fg">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
}

function Field({ label, aside, children }: { label: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-sm font-medium text-fg">
        {label}
        {aside}
      </span>
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
