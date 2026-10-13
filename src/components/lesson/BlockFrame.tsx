"use client";

import type { ReactNode } from "react";
import { splitEmbeds } from "@/lib/embeds";
import { InlineGraph } from "./InlineGraph";
import { Chunk, chunks, rich } from "./rich";

/** The frame for hands-on blocks: label, title, prompt, then the block, then the takeaway once done. */
export function BlockFrame({
  icon,
  label,
  title,
  prompt,
  done,
  takeaway,
  takeawayLabel = "Key insight",
  kind,
  children,
}: {
  icon: string;
  label: string;
  title: string;
  prompt?: string;
  done: boolean;
  takeaway?: ReactNode;
  takeawayLabel?: string;
  kind: string;
  children: ReactNode;
}) {
  return (
    <section className="activity-card relative" data-type={kind} data-done={done || undefined}>
      <div className="relative flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-sm text-accent" aria-hidden>
          {icon}
        </span>
        <span className="text-sm font-semibold text-accent">{label}</span>
        {done && (
          <span className="activity-done ml-auto rounded-full bg-[#e9f8ef] px-2.5 py-0.5 text-xs font-semibold text-good">✓ Done</span>
        )}
      </div>
      {title && <h3 className="font-display relative mt-3 text-2xl leading-snug text-fg sm:text-[28px]">{title}</h3>}
      {prompt && <p className="relative mt-3 text-[17px] leading-relaxed whitespace-pre-line text-fg/80">{rich(prompt)}</p>}
      <div className="relative mt-6">{children}</div>
      {done && takeaway && (
        <div className="activity-reveal relative mt-6 rounded-2xl border border-[#b6e6c8] bg-[#f1fbf5] px-5 py-4">
          <p className="text-xs font-semibold text-good">{takeawayLabel}</p>
          <div className="mt-1 text-[15px] leading-relaxed whitespace-pre-line text-fg">{takeaway}</div>
        </div>
      )}
    </section>
  );
}

/** Splits text on blank lines into paragraphs, with tables, lists and graphs drawn as such. */
export function Paragraphs({ text, className = "" }: { text: string; className?: string }) {
  let n = 0;
  return (
    <>
      {splitEmbeds(text).flatMap((part, pi) =>
        part.kind === "graph"
          ? [<div key={`g${pi}`} className={n++ > 0 ? "mt-3" : ""}><InlineGraph graph={part.graph} /></div>]
          : part.text
              .split(/\n\s*\n/)
              .flatMap((p) => chunks(p))
              .map((c, i) => <Chunk key={`${pi}-${i}`} chunk={c} className={`${n++ > 0 ? "mt-3" : ""} ${className}`} />)
      )}
    </>
  );
}
