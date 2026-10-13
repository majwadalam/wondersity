"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useAppState } from "@/components/app/AppState";

const KINDS = [
  ["question", "A question"],
  ["problem", "Something isn't working"],
  ["idea", "An idea"],
  ["billing", "Billing"],
  ["other", "Something else"],
] as const;

const field = "w-full rounded-xl border border-line bg-white px-4 py-2.5 text-[15px] text-fg outline-none focus:border-accent focus:ring-4 focus:ring-accent/15";

export function HelpForm() {
  const { signedIn, profile } = useAppState();
  // ?from=/courses/12 when linked from a page, so "this lesson" makes sense.
  const from = useSearchParams().get("from");
  const [kind, setKind] = useState<(typeof KINDS)[number][0]>("question");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError("");
    const res = await fetch("/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, message, ...(signedIn ? {} : { email }), ...(from?.startsWith("/") ? { page: from.slice(0, 300) } : {}) }),
    }).catch(() => null);
    if (res?.ok) return setState("sent");
    setState("idle");
    setError((await res?.json().catch(() => null))?.error ?? "Couldn't send it. Check your connection and try again.");
  }

  if (state === "sent") {
    return (
      <p className="mt-3 rounded-xl bg-[#e9f8ef] p-4 text-[15px] text-fg" role="status">
        Thanks, it&rsquo;s with us. We&rsquo;ll answer at {signedIn ? (profile?.email ?? "your account's email") : email}.
      </p>
    );
  }

  return (
    <form className="mt-4 space-y-3" onSubmit={send}>
      <div>
        <label htmlFor="help-kind" className="text-sm font-medium text-fg">
          What&rsquo;s it about?
        </label>
        <select id="help-kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={`mt-1.5 ${field}`}>
          {KINDS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="help-message" className="text-sm font-medium text-fg">
          Your message
        </label>
        <textarea
          id="help-message"
          required
          minLength={5}
          maxLength={4000}
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What happened, or what you'd like to know"
          className={`mt-1.5 ${field}`}
        />
      </div>
      {signedIn === false && (
        <div>
          <label htmlFor="help-email" className="text-sm font-medium text-fg">
            Your email, so we can answer
          </label>
          <input id="help-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`mt-1.5 ${field}`} />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={state === "sending" || message.trim().length < 5 || (signedIn === false && !email.includes("@"))} className="btn-primary rounded-xl px-5 py-2.5 text-sm font-semibold">
          {state === "sending" ? "Sending…" : "Send"}
        </button>
        {signedIn && profile?.email && <span className="text-sm text-muted">We&rsquo;ll answer at {profile.email}.</span>}
      </div>
      {error && <p className="text-sm text-bad">{error}</p>}
    </form>
  );
}
