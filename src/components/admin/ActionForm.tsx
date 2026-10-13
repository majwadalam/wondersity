"use client";

import { useActionState, useState, type ReactNode } from "react";
import type { ActionResult } from "@/app/admin/actions";

// A form that runs one admin action and says how it went, under the button.
// With `confirm`, the button asks once more in place ("Yes, delete it") instead
// of a browser dialog. `hidden` carries the ids the action needs.

type Action = (prev: ActionResult, form: FormData) => Promise<ActionResult>;

export function ActionForm({
  action,
  hidden,
  submit,
  confirm,
  tone = "default",
  children,
  className = "",
}: {
  action: Action;
  hidden: Record<string, string | number>;
  submit: string;
  confirm?: string;
  tone?: "default" | "danger" | "quiet";
  children?: ReactNode;
  className?: string;
}) {
  const [result, formAction, pending] = useActionState(action, null);
  const [asking, setAsking] = useState(false);
  const button =
    tone === "danger"
      ? "bg-bad text-white hover:bg-bad/90"
      : tone === "quiet"
        ? "bg-surface text-fg ring-1 ring-line hover:ring-line-strong"
        : "bg-accent text-white hover:bg-accent-strong";
  return (
    <form action={formAction} className={className} onSubmit={() => setAsking(false)}>
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {children}
      <div className="flex flex-wrap items-center gap-2">
        {confirm && !asking ? (
          <button type="button" onClick={() => setAsking(true)} className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${button}`}>
            {submit}
          </button>
        ) : (
          <>
            <button type="submit" disabled={pending} className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors disabled:opacity-60 ${button}`}>
              {pending ? "Working…" : confirm ? confirm : submit}
            </button>
            {confirm && (
              <button type="button" onClick={() => setAsking(false)} className="rounded-full px-3 py-1.5 text-[13px] text-muted hover:text-fg">
                Cancel
              </button>
            )}
          </>
        )}
        {result && !pending && (
          <span role="status" className={`text-[13px] ${result.ok ? "text-[#0e7a36]" : "text-bad"}`}>
            {result.message}
          </span>
        )}
      </div>
    </form>
  );
}

/** A labelled text field for admin forms. */
export function Field({ label, name, defaultValue, textarea, hint, rows = 3 }: { label: string; name: string; defaultValue?: string; textarea?: boolean; hint?: string; rows?: number }) {
  const cls = "mt-1 w-full rounded-xl bg-surface px-3 py-2 text-[14px] text-fg ring-1 ring-line outline-none focus:ring-2 focus:ring-accent";
  return (
    <label className="mb-3 block">
      <span className="text-[13px] font-medium text-fg">{label}</span>
      {textarea ? <textarea name={name} defaultValue={defaultValue} rows={rows} className={cls} /> : <input name={name} defaultValue={defaultValue} className={cls} />}
      {hint && <span className="mt-1 block text-[12px] text-muted">{hint}</span>}
    </label>
  );
}
