"use client";

import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  defaultDropAnimationSideEffects,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type DropAnimation,
} from "@dnd-kit/core";
import { motion } from "motion/react";
import { useId, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Activity } from "@/lib/activities";
import { ActivityFrame, seededShuffle } from "./ActivityFrame";

type SortData = Extract<Activity, { type: "sort" }>;

/**
 * Drag items into the right group, with dnd-kit (mouse, touch, edge
 * auto-scroll, drop detection), or tap an item and then tap a group.
 *
 * The card under the pointer is dnd-kit's DragOverlay, rendered in a portal on
 * <body>: inside the lesson an ancestor's slide-in animation keeps a
 * transform, which makes position: fixed relative to it, so an overlay inside
 * the activity would float away from the pointer.
 *
 * If any group is off-screen when a drag starts (many cards push the groups
 * below the fold, under the lesson's fixed bottom bar), a row of compact drop
 * targets docks just above that bar for the length of the drag, so there is
 * always a visible place to drop, on any screen and with touch, where a held
 * finger can't scroll the page.
 */

const DOCK = "dock:";

const TRAY = "tray";

// True once in the browser (false while rendering on the server and hydrating), for the portal.
const noSubscribe = () => () => {};
const useInBrowser = () => useSyncExternalStore(noSubscribe, () => true, () => false);

// The group under the pointer wins; if the pointer is between zones, the most overlapped one.
const collision: CollisionDetection = (args) => {
  const under = pointerWithin(args);
  return under.length ? under : rectIntersection(args);
};

// The dropped card glides into its new place; the real card stays hidden until it lands.
const dropAnimation: DropAnimation = {
  duration: 220,
  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0" } } }),
};

export function SortActivity({ a, onDone }: { a: SortData; onDone: () => void }) {
  const [order] = useState(() => seededShuffle(a.items.map((_, i) => i), a.title));
  const [placed, setPlaced] = useState<Record<number, string>>({});
  const [selected, setSelected] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  // Whether the docked targets are shown for this drag (some group is off-screen).
  const [docked, setDocked] = useState(false);
  // A drag ends with a click on the card it started from; that click isn't a tap.
  const justDragged = useRef(false);
  const inBrowser = useInBrowser();
  // dnd-kit numbers its accessibility ids with a counter; a stable id keeps the
  // server and browser renders the same (otherwise a hydration mismatch).
  const dndId = useId();

  // Mouse and touch each have their own sensor (dnd-kit's advice for touch
  // screens). A press becomes a drag after 6px, so a tap still selects the card;
  // cards are touch-action: none, so a finger on a card drags instead of scrolling.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 6 } })
  );

  const allPlaced = a.items.every((_, i) => placed[i]);
  const correct = a.items.filter((it, i) => placed[i] === it.bucket).length;
  const solved = checked && correct === a.items.length;

  function place(index: number, bucket: string | null) {
    setChecked(false);
    setPlaced((p) => {
      const next = { ...p };
      if (bucket) next[index] = bucket;
      else delete next[index];
      return next;
    });
    setSelected(null);
  }

  function onDragStart(e: DragStartEvent) {
    setActive(Number(e.active.id));
    const bottom = window.innerHeight - bottomBarHeight();
    const groups = [...document.querySelectorAll<HTMLElement>(`[data-sort="${CSS.escape(String(e.active.data.current?.activity ?? ""))}"] .sort-bucket`)];
    // Dock unless every group is fully in view: a sliver above the bar isn't a usable target.
    setDocked(groups.some((g) => {
      const r = g.getBoundingClientRect();
      return r.top < 0 || r.bottom > bottom;
    }));
    setSelected(null);
    justDragged.current = true;
  }
  function onDragEnd(e: DragEndEvent) {
    setActive(null);
    setDocked(false);
    const target = e.over?.id === undefined ? undefined : String(e.over.id);
    if (target !== undefined) place(Number(e.active.id), target === TRAY ? null : target.startsWith(DOCK) ? target.slice(DOCK.length) : target);
    // Let the click that follows a drag pass, then accept taps again.
    setTimeout(() => (justDragged.current = false), 0);
  }

  function tap(index: number) {
    if (justDragged.current || solved) return;
    setSelected((s) => (s === index ? null : index));
  }

  function check() {
    setChecked(true);
    if (correct === a.items.length) onDone();
  }
  function retry() {
    // Send only the wrong ones back to the tray.
    setPlaced((p) => Object.fromEntries(Object.entries(p).filter(([i, b]) => a.items[Number(i)].bucket === b)));
    setChecked(false);
  }

  const chip = (index: number) => {
    const where = placed[index];
    const state = checked && where ? (a.items[index].bucket === where ? "good" : "bad") : selected === index ? "selected" : "idle";
    return (
      <Card key={index} index={index} activity={a.title} state={state} disabled={solved} selected={selected === index} onTap={() => tap(index)}>
        {a.items[index].text}
      </Card>
    );
  };

  const tray = order.filter((i) => !placed[i]);

  return (
    <ActivityFrame type="sort" title={a.title} prompt={a.prompt} reveal={a.reveal} done={solved}>
      <div data-sort={a.title}>
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={collision}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => (setActive(null), setDocked(false))}
        // Re-measure drop zones during the drag: the docked targets appear after it starts.
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      >
        <p className="mb-3 text-xs text-muted">Drag each card into a group, or tap a card and then tap a group.</p>
        <Zone
          id={TRAY}
          onTap={() => selected !== null && place(selected, null)}
          className="sort-tray flex min-h-[56px] flex-wrap gap-2 rounded-2xl border border-dashed border-line p-3"
        >
          {tray.length ? tray.map(chip) : <span className="self-center text-xs text-muted">All placed. Check your sorting.</span>}
        </Zone>
        <div className={`mt-3 grid gap-3 ${a.buckets.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          {a.buckets.map((b) => (
            <Zone
              key={b}
              id={b}
              group
              onTap={() => selected !== null && place(selected, b)}
              className={`sort-bucket min-h-[120px] rounded-2xl border-2 p-3 ${selected !== null || active !== null ? "border-accent/60 bg-accent/5" : "border-line bg-canvas"}`}
            >
              <p className="mb-2 text-xs font-semibold tracking-[0.12em] text-accent uppercase">{b}</p>
              <div className="flex flex-wrap gap-2">{order.filter((i) => placed[i] === b).map(chip)}</div>
            </Zone>
          ))}
        </div>
        {inBrowser &&
          createPortal(
            <>
            {docked && active !== null && (
              <div className="fixed inset-x-0 z-50 flex justify-center px-4" style={{ bottom: bottomBarHeight() + 12 }}>
                <div className="flex w-full max-w-xl gap-2 rounded-2xl bg-surface/95 p-2 shadow-[var(--shadow-lg)] ring-1 ring-line backdrop-blur">
                  {a.buckets.map((b) => (
                    <DockTarget key={b} id={b} />
                  ))}
                </div>
              </div>
            )}
            <DragOverlay dropAnimation={dropAnimation} zIndex={60}>
              {active !== null ? (
                <div className="sort-ghost rounded-xl border border-accent bg-surface px-3 py-2 text-left text-sm text-fg">{a.items[active].text}</div>
              ) : null}
            </DragOverlay>
            </>,
            document.body
          )}
      </DndContext>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {!solved && (
          <button type="button" disabled={!allPlaced} onClick={check} className="btn-primary rounded-xl px-5 py-2 text-sm font-semibold disabled:opacity-40">
            Check
          </button>
        )}
        {checked && !solved && (
          <>
            <span className="text-sm text-fg">
              {correct} of {a.items.length} right.
            </span>
            <button type="button" onClick={retry} className="text-sm text-accent underline">
              Send the wrong ones back
            </button>
          </>
        )}
        {solved && <span className="text-sm font-semibold text-good">All sorted correctly!</span>}
      </div>
    </ActivityFrame>
  );
}

/** A card that can be dragged (dnd-kit) or tapped to select. */
function Card({
  index,
  activity,
  state,
  selected,
  disabled,
  onTap,
  children,
}: {
  index: number;
  activity: string;
  state: string;
  selected: boolean;
  disabled: boolean;
  onTap: () => void;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: String(index), disabled, data: { activity } });
  return (
    <motion.button
      ref={setNodeRef}
      // The other cards slide to their new places when one leaves or arrives.
      layout="position"
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
      type="button"
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // A tap on a card is about that card, not the group around it.
        e.stopPropagation();
        onTap();
      }}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onTap())}
      data-state={state}
      aria-pressed={selected}
      className={`sort-chip touch-none rounded-xl border px-3 py-2 text-left text-sm select-none ${isDragging ? "opacity-30" : ""}`}
    >
      {children}
    </motion.button>
  );
}

/** The pile or a group: a drop zone (dnd-kit) that can also be tapped to place the selected card. */
function Zone({ id, group, onTap, className, children }: { id: string; group?: boolean; onTap: () => void; className: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      data-bucket={id === TRAY ? "" : id}
      data-over={group && isOver ? "" : undefined}
      onClick={onTap}
      {...(group ? { role: "button", tabIndex: 0, onKeyDown: (e: KeyboardEvent) => (e.key === "Enter" || e.key === " ") && onTap() } : {})}
      className={className}
    >
      {children}
    </div>
  );
}

/** The lesson's fixed bottom bar height (0 outside a lesson). */
function bottomBarHeight() {
  return [...document.querySelectorAll<HTMLElement>("[data-fixed-bottom]")].reduce(
    (h, el) => Math.max(h, window.innerHeight - el.getBoundingClientRect().top),
    0
  );
}

/** A compact drop target for a group, docked above the bottom bar while dragging. */
function DockTarget({ id }: { id: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${DOCK}${id}` });
  return (
    <div
      ref={setNodeRef}
      data-dock={id}
      className={`flex min-h-12 flex-1 items-center justify-center rounded-xl border-2 border-dashed px-3 text-center text-xs font-semibold tracking-[0.1em] uppercase transition-colors ${
        isOver ? "border-accent bg-accent-soft text-accent-strong" : "border-accent/40 text-accent"
      }`}
    >
      {id}
    </div>
  );
}
