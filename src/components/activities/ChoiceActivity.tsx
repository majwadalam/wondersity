"use client";

import { useState } from "react";
import type { Activity } from "@/lib/activities";
import { ActivityFrame } from "./ActivityFrame";
import { rich } from "../lesson/rich";

type ChoiceActivityData = Extract<Activity, { type: "predict" | "scenario" }>;

/**
 * Predict (ask before you tell): commit to one answer, then see why.
 * Scenario: choose what you'd do and see the consequence; try the other paths too.
 */
export function ChoiceActivity({ a, onDone }: { a: ChoiceActivityData; onDone: () => void }) {
  const [picked, setPicked] = useState<number[]>([]);
  const isPredict = a.type === "predict";
  const locked = isPredict && picked.length > 0;
  const last = picked[picked.length - 1];

  function pick(i: number) {
    if (locked || picked.includes(i)) return;
    setPicked((p) => [...p, i]);
    onDone();
  }

  return (
    <ActivityFrame type={a.type} title={a.title} prompt={a.prompt} reveal={a.reveal} done={picked.length > 0}>
      {isPredict && picked.length === 0 && <p className="mb-3 text-xs text-muted">Make your prediction before reading on.</p>}
      <div className="grid gap-2.5 sm:grid-cols-2">
        {a.options.map((o, i) => {
          const chosen = picked.includes(i);
          const state = !chosen ? (locked ? (o.correct ? "answer" : "idle") : "idle") : o.correct ? "good" : "bad";
          return (
            <button
              key={i}
              type="button"
              onClick={() => pick(i)}
              disabled={locked || chosen}
              data-state={state}
              className="choice-option rounded-2xl border px-4 py-3 text-left text-sm leading-snug"
            >
              <span className="mr-2 font-semibold text-accent">{String.fromCharCode(65 + i)}</span>
              {rich(o.text)}
              {chosen && <span className="ml-1">{o.correct ? " ✓" : " ✗"}</span>}
            </button>
          );
        })}
      </div>
      {last !== undefined && (
        <div key={last} className="activity-feedback mt-4 rounded-2xl border border-line bg-canvas p-4">
          <p className={`text-xs font-semibold tracking-wide uppercase ${a.options[last].correct ? "text-good" : "text-bad"}`}>
            {isPredict
              ? a.options[last].correct
                ? "Good instinct"
                : "Not quite, and that's the interesting part"
              : a.options[last].correct
                ? "Best move"
                : "What happens next"}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-fg/90">{rich(a.options[last].feedback)}</p>
          {!isPredict && picked.length < a.options.length && (
            <p className="mt-2 text-xs text-muted">Curious? Try another choice to see where it leads.</p>
          )}
        </div>
      )}
    </ActivityFrame>
  );
}
