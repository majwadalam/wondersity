"use client";

import { useEffect, useId, useState } from "react";
import { copyText } from "./copyText";
import type { TraceStep } from "./types";

export function HarnessTrace({ trace }: { trace: TraceStep[] }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [popping, setPopping] = useState(false);
  const panelId = useId();
  const json = JSON.stringify(trace, null, 2);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  async function copy() {
    setPopping(true);
    if (await copyText(json)) setCopied(true);
  }

  return (
    <div className="mt-16 rounded-2xl border border-dashed border-line text-sm">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="trace-toggle flex w-full items-center gap-2 px-5 py-3 text-left text-xs text-muted hover:text-accent"
      >
        <span className="chevron inline-block" aria-hidden>
          ›
        </span>
        <span className="uppercase tracking-[0.16em]">Harness trace</span>
        <span className="ml-auto font-mono text-[11px]">
          {trace.length} step{trace.length === 1 ? "" : "s"}
        </span>
      </button>

      <div id={panelId} className="trace-collapse" data-open={open} inert={!open}>
        <div className="min-h-0 overflow-hidden">
          <div className="trace-body border-t border-dashed border-line px-5 pt-4 pb-5">
            <ol className="flex flex-wrap gap-1.5">
              {trace.map((t, i) => (
                <li
                  key={i}
                  className="rounded-md border border-line bg-surface px-2 py-1 font-mono text-[11px] text-accent"
                >
                  {t?.step ?? "step"}
                  {typeof t?.score === "number" && <span className="text-muted"> · {t.score}</span>}
                </li>
              ))}
            </ol>
            <div className="relative mt-4">
              <pre className="max-h-96 overflow-auto rounded-xl border border-line bg-canvas p-4 pr-20 font-mono text-xs leading-relaxed text-fg">
                {json}
              </pre>
              <button
                type="button"
                onClick={copy}
                onAnimationEnd={() => setPopping(false)}
                data-pop={popping || undefined}
                className="copy-btn absolute top-2.5 right-2.5 rounded-md bg-accent px-2.5 py-1 text-[11px] font-medium text-white"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
