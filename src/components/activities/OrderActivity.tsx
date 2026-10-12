"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Activity } from "@/lib/activities";
import { ActivityFrame, seededShuffle } from "./ActivityFrame";

type OrderData = Extract<Activity, { type: "order" }>;

/** Drag steps into the right sequence (or use the arrows), then check. */
export function OrderActivity({ a, onDone }: { a: OrderData; onDone: () => void }) {
  const [order, setOrder] = useState(() => seededShuffle(a.steps.map((_, i) => i), a.title));
  const [checked, setChecked] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);
  const list = useRef<HTMLOListElement>(null);

  const rightCount = order.filter((step, pos) => step === pos).length;
  const solved = checked && rightCount === order.length;

  function move(from: number, to: number) {
    if (to < 0 || to >= order.length || from === to) return;
    setChecked(false);
    setOrder((o) => {
      const next = [...o];
      const [x] = next.splice(from, 1);
      next.splice(to, 0, x);
      return next;
    });
  }

  function onPointerDown(e: ReactPointerEvent, pos: number) {
    if (solved) return;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* not a capturable pointer (e.g. synthetic) */
    }
    setDragging(pos);
  }
  function onPointerMove(e: ReactPointerEvent) {
    if (dragging === null || !list.current) return;
    // Find the slot whose middle the pointer has passed.
    const rows = [...list.current.children] as HTMLElement[];
    let target = rows.findIndex((row) => {
      const r = row.getBoundingClientRect();
      return e.clientY < r.top + r.height / 2;
    });
    if (target === -1) target = rows.length - 1;
    if (target !== dragging) {
      move(dragging, target);
      setDragging(target);
    }
  }

  function check() {
    setChecked(true);
    if (rightCount === order.length) onDone();
  }

  return (
    <ActivityFrame type="order" title={a.title} prompt={a.prompt} reveal={a.reveal} done={solved}>
      <p className="mb-3 text-xs text-muted">Drag the handle (⋮⋮) or use the arrows to reorder.</p>
      <ol ref={list} className="space-y-2">
        {order.map((step, pos) => {
          const state = checked ? (step === pos ? "good" : "bad") : dragging === pos ? "dragging" : "idle";
          return (
            <li key={step} data-state={state} className="order-row flex items-center gap-3 rounded-2xl border px-3 py-2.5">
              <span
                onPointerDown={(e) => onPointerDown(e, pos)}
                onPointerMove={onPointerMove}
                onPointerUp={() => setDragging(null)}
                // A touch the browser turns into a scroll ends the drag too.
                onPointerCancel={() => setDragging(null)}
                className="order-handle cursor-grab touch-none px-1 text-lg text-muted select-none active:cursor-grabbing"
                aria-hidden
              >
                ⋮⋮
              </span>
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent">{pos + 1}</span>
              <span className="flex-1 text-sm leading-snug text-fg">{a.steps[step]}</span>
              <span className="flex flex-col">
                <button type="button" aria-label="Move up" disabled={pos === 0 || solved} onClick={() => move(pos, pos - 1)} className="px-2 text-muted hover:text-accent disabled:opacity-30">
                  ▲
                </button>
                <button type="button" aria-label="Move down" disabled={pos === order.length - 1 || solved} onClick={() => move(pos, pos + 1)} className="px-2 text-muted hover:text-accent disabled:opacity-30">
                  ▼
                </button>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {!solved && (
          <button type="button" onClick={check} className="btn-primary rounded-xl px-5 py-2 text-sm font-semibold">
            Check order
          </button>
        )}
        {checked && !solved && (
          <>
            <span className="text-sm text-fg">
              {rightCount} of {order.length} in the right place.
            </span>
            <button
              type="button"
              onClick={() => {
                setOrder(a.steps.map((_, i) => i));
                setChecked(true);
                onDone();
              }}
              className="text-sm text-accent underline"
            >
              Show me
            </button>
          </>
        )}
        {solved && <span className="text-sm font-semibold text-good">Perfect sequence!</span>}
      </div>
    </ActivityFrame>
  );
}
