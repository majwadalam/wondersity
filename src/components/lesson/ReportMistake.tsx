"use client";

import { Flag } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// "Report a mistake" in the lesson's top bar. Getting facts right matters
// most, and learners find what the checks miss; each report is saved with the
// lesson and the step it was made on (see supabase/queries/metrics.sql).

const KINDS = [
  ["wrong_fact", "Something is wrong"],
  ["confusing", "It's confusing"],
  ["broken", "Something doesn't work"],
  ["other", "Something else"],
] as const;

export function ReportMistake({ lessonId, step }: { lessonId: number; step: number }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<(typeof KINDS)[number][0]>("wrong_fact");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !panel.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const send = async () => {
    setState("sending");
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId, step, kind, message }),
    }).catch(() => null);
    setState(res?.ok ? "sent" : "failed");
    if (res?.ok) {
      setMessage("");
      setTimeout(() => {
        setOpen(false);
        setState("idle");
      }, 1600);
    }
  };

  return (
    <div ref={panel} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Report a mistake"
        title="Report a mistake"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-canvas hover:text-fg"
      >
        <Flag size={15} aria-hidden />
      </button>
      {open && (
        <div role="dialog" aria-label="Report a mistake" className="absolute right-0 top-11 z-30 w-[min(20rem,calc(100vw-2rem))] rounded-2xl bg-white p-4 shadow-[var(--shadow-lg)] ring-1 ring-line">
          {state === "sent" ? (
            <p className="py-2 text-sm text-good">Thanks. We&rsquo;ll look at this step.</p>
          ) : (
            <>
              <p className="text-sm font-semibold text-fg">Report a mistake on this step</p>
              <fieldset className="mt-3 space-y-1.5">
                <legend className="sr-only">What&rsquo;s wrong?</legend>
                {KINDS.map(([value, label]) => (
                  <label key={value} className="flex cursor-pointer items-center gap-2 text-sm text-fg">
                    <input type="radio" name="report-kind" value={value} checked={kind === value} onChange={() => setKind(value)} className="accent-[var(--accent)]" />
                    {label}
                  </label>
                ))}
              </fieldset>
              <label htmlFor="report-message" className="sr-only">
                Details
              </label>
              <textarea
                id="report-message"
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
                rows={3}
                placeholder={kind === "wrong_fact" ? "What's wrong, and what's right? A link helps." : "Tell us a little more (optional)"}
                className="mt-3 w-full resize-none rounded-xl border border-line bg-white px-3 py-2 text-sm text-fg outline-none focus:border-accent focus:ring-4 focus:ring-accent/15"
              />
              {state === "failed" && <p className="mt-1 text-xs text-bad">Couldn&rsquo;t send it. Try again.</p>}
              <button type="button" onClick={send} disabled={state === "sending"} className="btn-primary mt-3 w-full rounded-xl py-2 text-sm font-semibold">
                {state === "sending" ? "Sending…" : "Send report"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
