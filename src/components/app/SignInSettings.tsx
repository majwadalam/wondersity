"use client";

import { useState } from "react";
import { browserSupabase } from "@/lib/supabase/browser";

// Settings → Sign-in: change the email or password of an email-and-password
// account. A Google account is managed at Google. Errors are shown as plain
// sentences, never the auth service's raw text.

function plain(message: string) {
  if (/rate limit|too many/i.test(message)) return "Too many tries. Wait a minute and try again.";
  if (/same.*password|different from the old/i.test(message)) return "That's your current password. Choose a new one.";
  if (/weak|short|at least/i.test(message)) return "Choose a longer password: at least 8 characters, harder to guess.";
  if (/already.*(registered|exists|in use)/i.test(message)) return "That email already has an account.";
  if (/reauth|recent|session/i.test(message)) return "For your security, sign out and back in, then try again.";
  if (/invalid.*email|email.*invalid/i.test(message)) return "That doesn't look like an email address.";
  return "Couldn't save that. Try again.";
}

const input =
  "min-w-0 flex-1 rounded-xl border border-line bg-white px-4 py-2.5 text-[15px] text-fg outline-none focus:border-accent focus:ring-4 focus:ring-accent/15";

export function SignInSettings({ email, signIn }: { email: string | null; signIn: string[] }) {
  const google = signIn.includes("google");
  const withPassword = signIn.includes("email");
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<"email" | "password" | null>(null);

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy("email");
    setNote(null);
    const { error } = await browserSupabase().auth.updateUser(
      { email: newEmail.trim() },
      { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/settings")}` }
    );
    setBusy(null);
    if (error) return setNote({ ok: false, text: plain(error.message) });
    setNote({ ok: true, text: `Check ${newEmail.trim()} for a link to confirm it. Your email changes once you open it.` });
    setNewEmail("");
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password !== again) return setNote({ ok: false, text: "The two passwords don't match." });
    setBusy("password");
    setNote(null);
    const { error } = await browserSupabase().auth.updateUser({ password });
    setBusy(null);
    if (error) return setNote({ ok: false, text: plain(error.message) });
    setNote({ ok: true, text: "Password changed." });
    setPassword("");
    setAgain("");
  }

  return (
    <div>
      <p className="text-[15px] text-fg">
        {google && withPassword
          ? "You sign in with Google or with your email and password."
          : google
            ? "You sign in with Google. Your email and password are managed in your Google account."
            : "You sign in with your email and password."}
      </p>
      {email && <p className="mt-1 text-sm text-muted">Email: {email}</p>}
      {withPassword && (
        <>
          <form className="mt-5" onSubmit={changeEmail}>
            <label htmlFor="new-email" className="text-sm font-medium text-fg">
              Change email
            </label>
            <div className="mt-2 flex gap-2">
              <input id="new-email" type="email" autoComplete="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="New email" className={input} />
              <button type="submit" disabled={busy !== null || !newEmail.includes("@") || newEmail.trim() === email} className="btn-secondary rounded-xl px-4 text-sm font-medium">
                {busy === "email" ? "Sending…" : "Change"}
              </button>
            </div>
          </form>
          <form className="mt-5" onSubmit={changePassword}>
            <p className="text-sm font-medium text-fg">
              Change password <span className="font-normal text-muted">(at least 8 characters)</span>
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <label className="sr-only" htmlFor="new-password">
                New password
              </label>
              <input id="new-password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" className={input} />
              <label className="sr-only" htmlFor="new-password-again">
                New password again
              </label>
              <input id="new-password-again" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} placeholder="Again" className={input} />
              <button type="submit" disabled={busy !== null || password.length < 8 || !again} className="btn-secondary rounded-xl px-4 py-2.5 text-sm font-medium">
                {busy === "password" ? "Saving…" : "Change"}
              </button>
            </div>
          </form>
        </>
      )}
      <p className={`mt-3 min-h-5 text-sm ${note?.ok ? "text-good" : "text-bad"}`} aria-live="polite">
        {note?.text}
      </p>
    </div>
  );
}
