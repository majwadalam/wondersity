"use client";

import type { ReactNode } from "react";
import type { ActivityType } from "@/lib/activities";
import { rich } from "../lesson/rich";

export const ACTIVITY_META: Record<ActivityType, { label: string; icon: string }> = {
  predict: { label: "Predict first", icon: "?" },
  scenario: { label: "Scenario", icon: "⚑" },
  sort: { label: "Sort it", icon: "⇄" },
  order: { label: "Put it in order", icon: "↕" },
  story: { label: "Story", icon: "❝" },
  timeline: { label: "Timeline", icon: "⟶" },
  chart: { label: "Infographic", icon: "▥" },
  simulation: { label: "Simulation", icon: "◐" },
  diagram: { label: "Interactive diagram", icon: "✳" },
  listen: { label: "Listen", icon: "♪" },
  sound: { label: "Play it", icon: "♫" },
  graph: { label: "Shape the curve", icon: "∿" },
};

/** The shared frame: type badge, title, prompt, the activity, then the insight once done. */
export function ActivityFrame({
  type,
  title,
  prompt,
  reveal,
  done,
  children,
}: {
  type: ActivityType;
  title: string;
  prompt: string;
  reveal: string;
  done: boolean;
  children: ReactNode;
}) {
  const meta = ACTIVITY_META[type];
  return (
    <section className="activity-card relative" data-type={type} data-done={done || undefined}>
      <div className="relative flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-sm text-accent" aria-hidden>
          {meta.icon}
        </span>
        <span className="text-sm font-semibold text-accent">{meta.label}</span>
        {done && (
          <span className="activity-done ml-auto rounded-full bg-[#e9f8ef] px-2.5 py-0.5 text-xs font-semibold text-good">✓ Done</span>
        )}
      </div>
      <h3 className="font-display relative mt-3 text-2xl leading-snug text-fg sm:text-[28px]">{title}</h3>
      {prompt && <p className="relative mt-3 text-[17px] leading-relaxed text-fg/80">{rich(prompt)}</p>}
      <div className="relative mt-6">{children}</div>
      {done && reveal && (
        <div className="activity-reveal relative mt-6 rounded-2xl border border-[#b6e6c8] bg-[#f1fbf5] px-5 py-4">
          <p className="text-xs font-semibold text-good">Key insight</p>
          <p className="mt-1 text-[15px] leading-relaxed text-fg">{rich(reveal)}</p>
        </div>
      )}
    </section>
  );
}

/** Deterministic shuffle (same on server and client), never returning the original order. */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  if (out.length > 1 && out.every((x, i) => x === items[i])) out.push(out.shift()!);
  return out;
}
