"use client";

import { useState } from "react";
import type { Activity } from "@/lib/activities";
import { ActivityFrame } from "./ActivityFrame";

type StoryData = Extract<Activity, { type: "story" }>;

/** A narrative arc revealed beat by beat. */
export function StoryActivity({ a, onDone }: { a: StoryData; onDone: () => void }) {
  const [shown, setShown] = useState(1);
  const finished = shown >= a.beats.length;

  function next() {
    const n = Math.min(shown + 1, a.beats.length);
    setShown(n);
    if (n >= a.beats.length) onDone();
  }

  return (
    <ActivityFrame type="story" title={a.title} prompt={a.prompt} reveal={a.reveal} done={finished}>
      <div className="mb-4 flex gap-1.5" aria-hidden>
        {a.beats.map((_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${i < shown ? "bg-accent" : "bg-fg/15"}`} />
        ))}
      </div>
      <ol className="space-y-3">
        {a.beats.slice(0, shown).map((b, i) => (
          <li key={i} className="story-beat flex gap-4">
            <span className="flex flex-col items-center">
              <span className="font-display flex h-9 w-9 items-center justify-center rounded-full border border-accent/50 text-sm text-accent">{i + 1}</span>
              {i < shown - 1 && <span className="mt-1 w-px flex-1 bg-accent/30" />}
            </span>
            <div className="flex-1 pb-2">
              {b.label && <p className="text-[11px] font-semibold tracking-wide text-accent uppercase">{b.label}</p>}
              <p className="font-display mt-1 text-lg leading-relaxed text-fg italic">{b.text}</p>
            </div>
          </li>
        ))}
      </ol>
      {!finished && (
        <button type="button" onClick={next} className="btn-primary mt-3 rounded-xl px-5 py-2 text-sm font-semibold">
          What happens next? →
        </button>
      )}
    </ActivityFrame>
  );
}
