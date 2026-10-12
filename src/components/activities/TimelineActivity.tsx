"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { spring } from "../motion/presets";
import type { Activity } from "@/lib/activities";
import { ActivityFrame } from "./ActivityFrame";

type TimelineData = Extract<Activity, { type: "timeline" }>;

/** A visual timeline: tap markers or press play to walk through the events. */
export function TimelineActivity({ a, onDone }: { a: TimelineData; onDone: () => void }) {
  const [active, setActive] = useState(0);
  // +1 moving forward in time, -1 back: the detail slides the same way.
  const [direction, setDirection] = useState(1);
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0]));
  const [playing, setPlaying] = useState(false);
  const allSeen = seen.size === a.events.length;

  const last = a.events.length - 1;

  function go(i: number) {
    setDirection(i >= active ? 1 : -1);
    setActive(i);
    const next = new Set(seen).add(i);
    setSeen(next);
    if (next.size === a.events.length) onDone();
    if (i >= last) setPlaying(false);
  }

  // While playing, step forward every 2.2s until the last event.
  useEffect(() => {
    if (!playing || active >= last) return;
    const t = setTimeout(() => go(active + 1), 2200);
    return () => clearTimeout(t);
  });

  const e = a.events[active];
  const progress = a.events.length > 1 ? (active / (a.events.length - 1)) * 100 : 0;

  return (
    <ActivityFrame type="timeline" title={a.title} prompt={a.prompt} reveal={a.reveal} done={allSeen}>
      <div className="overflow-x-auto pb-2">
        <div className="relative min-w-[480px] px-4 pt-2">
          <div className="absolute top-[26px] right-6 left-6 h-1 rounded-full bg-fg/15" />
          <motion.div
            className="timeline-fill absolute top-[26px] right-6 left-6 h-1 origin-left rounded-full bg-accent"
            initial={false}
            animate={{ scaleX: progress / 100 }}
            transition={spring.gentle}
          />
          <ol className="relative flex justify-between">
            {a.events.map((ev, i) => (
              <li key={i} className="flex w-0 flex-1 flex-col items-center">
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`${ev.marker}: ${ev.title}`}
                  aria-current={i === active}
                  data-state={i === active ? "active" : seen.has(i) ? "seen" : "idle"}
                  className="timeline-dot h-10 w-10 rounded-full border-2"
                >
                  <span className="sr-only">{ev.title}</span>
                </button>
                <span className={`mt-2 text-center text-xs font-semibold ${i === active ? "text-accent" : "text-muted"}`}>{ev.marker}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div className="relative mt-4 overflow-hidden" aria-live="polite">
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.div
            key={active}
            custom={direction}
            className="rounded-2xl border border-line bg-canvas p-5"
            variants={{
              enter: (d: number) => ({ x: d * 48, opacity: 0 }),
              center: { x: 0, opacity: 1 },
              leave: (d: number) => ({ x: d * -48, opacity: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="leave"
            transition={spring.gentle}
          >
            <p className="text-xs font-semibold tracking-wide text-accent uppercase">{e.marker}</p>
            <p className="font-display mt-1 text-xl text-fg">{e.title}</p>
            {e.detail && <p className="mt-2 text-sm leading-relaxed text-fg/85">{e.detail}</p>}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button type="button" onClick={() => go(Math.max(0, active - 1))} disabled={active === 0} className="rounded-xl border border-line px-3 py-2 text-sm text-fg disabled:opacity-30">
          ←
        </button>
        <button type="button" onClick={() => (active === a.events.length - 1 ? go(0) : setPlaying((p) => !p))} className="btn-primary rounded-xl px-5 py-2 text-sm font-semibold">
          {playing ? "Pause" : active === a.events.length - 1 ? "Replay" : "▶ Play"}
        </button>
        <button type="button" onClick={() => go(Math.min(a.events.length - 1, active + 1))} disabled={active === a.events.length - 1} className="rounded-xl border border-line px-3 py-2 text-sm text-fg disabled:opacity-30">
          →
        </button>
        <span className="ml-auto text-xs text-muted tabular-nums">
          {seen.size}/{a.events.length} explored
        </span>
      </div>
    </ActivityFrame>
  );
}
