"use client";

import type { Block } from "@/lib/lessonBlocks";
import { Paragraphs } from "./BlockFrame";
import { rich } from "./rich";

type Of<K extends Block["kind"]> = Extract<Block, { kind: K }>;

export function ExplainBlock({ b }: { b: Of<"explain"> }) {
  return (
    <section className="concept-card">
      {b.heading && <h3 className="font-display text-2xl text-fg sm:text-[28px]">{b.heading}</h3>}
      <div className={`text-[17px] leading-[1.75] text-fg/90 ${b.heading ? "mt-4" : ""}`}>
        <Paragraphs text={b.body} />
      </div>
      {b.example && (
        <div className="mt-6 rounded-2xl border-l-[3px] border-accent bg-accent-soft px-5 py-4 text-[16px] leading-relaxed">
          <span className="mb-1 block text-xs font-semibold text-accent">For example</span>
          <span className="text-fg">{rich(b.example)}</span>
        </div>
      )}
    </section>
  );
}

/** Two things side by side. A table on wide screens; paired cards on phones. */
export function CompareBlock({ b }: { b: Of<"compare"> }) {
  const [left, right] = b.columns;
  return (
    <section>
      <p className="flex items-center gap-2 text-sm font-semibold text-accent">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-sm" aria-hidden>
          ⇆
        </span>
        Compare
      </p>
      {b.heading && <h3 className="font-display mt-2 text-2xl text-fg sm:text-[28px]">{b.heading}</h3>}
      {b.intro && <p className="mt-2 text-[15px] leading-relaxed text-fg/85">{rich(b.intro)}</p>}
      <div className="compare-grid mt-5" role="table" aria-label={b.heading || `${left} compared with ${right}`}>
        <div className="compare-head" role="row">
          <span role="columnheader" />
          <span role="columnheader" className="compare-col-a">{left}</span>
          <span role="columnheader" className="compare-col-b">{right}</span>
        </div>
        {b.rows.map((r, i) => (
          <div key={i} className="compare-row" role="row">
            <span role="rowheader" className="compare-label">{r.label}</span>
            <span role="cell" className="compare-cell" data-col={left}>{rich(r.a)}</span>
            <span role="cell" className="compare-cell" data-col={right}>{rich(r.b)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SummaryBlock({ b }: { b: Of<"summary"> }) {
  return (
    <section className="rounded-2xl border border-[#b6e6c8] bg-[#f1fbf5] p-6 sm:p-7">
      <p className="text-sm font-semibold text-good">{b.heading || "What to take away"}</p>
      <ul className="mt-3 space-y-2.5">
        {b.points.map((p, i) => (
          <li key={i} className="flex gap-3 text-[16px] leading-relaxed text-fg">
            <span aria-hidden className="mt-0.5 text-good">✓</span>
            <span>{rich(p)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
