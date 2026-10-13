"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  defaultDropAnimationSideEffects,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DropAnimation,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useId, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Activity } from "@/lib/activities";
import { ActivityFrame, seededShuffle } from "./ActivityFrame";
import { rich } from "../lesson/rich";

type OrderData = Extract<Activity, { type: "order" }>;

/*
 * Drag steps into the right sequence with dnd-kit's sortable list (mouse,
 * touch, keyboard, edge auto-scroll), the same library as "Sort it", or use
 * the arrows. As in "Sort it", the row under the pointer is a DragOverlay
 * portalled to <body>: a lesson step's animation leaves a transform that
 * breaks position: fixed inside it.
 */

// True once in the browser (false while rendering on the server and hydrating), for the portal.
const noSubscribe = () => () => {};
const useInBrowser = () => useSyncExternalStore(noSubscribe, () => true, () => false);

// The dropped row glides into its new place; the real row stays hidden until it lands.
const dropAnimation: DropAnimation = {
  duration: 220,
  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0" } } }),
};

/** Drag steps into the right sequence (or use the arrows), then check. */
export function OrderActivity({ a, onDone }: { a: OrderData; onDone: () => void }) {
  const [order, setOrder] = useState(() => seededShuffle(a.steps.map((_, i) => i), a.title));
  const [checked, setChecked] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const inBrowser = useInBrowser();
  // dnd-kit numbers its accessibility ids with a counter; a stable id keeps the
  // server and browser renders the same (otherwise a hydration mismatch).
  const dndId = useId();

  // Mouse and touch each have their own sensor (dnd-kit's advice for touch
  // screens); handles are touch-action: none, so a finger on one drags instead of scrolling.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const rightCount = order.filter((step, pos) => step === pos).length;
  const solved = checked && rightCount === order.length;
  const ids = order.map(String);

  function move(from: number, to: number) {
    if (to < 0 || to >= order.length || from === to) return;
    setChecked(false);
    setOrder((o) => arrayMove(o, from, to));
  }

  function onDragStart(e: DragStartEvent) {
    setActive(Number(e.active.id));
  }
  function onDragEnd(e: DragEndEvent) {
    setActive(null);
    if (!e.over) return;
    move(ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id)));
  }

  function check() {
    setChecked(true);
    if (rightCount === order.length) onDone();
  }

  return (
    <ActivityFrame type="order" title={a.title} prompt={a.prompt} reveal={a.reveal} done={solved}>
      <p className="mb-3 text-xs text-muted">Drag the handle (⋮⋮) or use the arrows to reorder.</p>
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActive(null)}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ol className="space-y-2">
            {order.map((step, pos) => (
              <Row
                key={step}
                id={String(step)}
                pos={pos}
                count={order.length}
                state={checked ? (step === pos ? "good" : "bad") : "idle"}
                disabled={solved}
                onMove={(to) => move(pos, to)}
              >
                {rich(a.steps[step])}
              </Row>
            ))}
          </ol>
        </SortableContext>
        {inBrowser &&
          createPortal(
            <DragOverlay dropAnimation={dropAnimation} zIndex={60}>
              {active !== null ? (
                <div data-state="dragging" className="order-row flex items-center gap-3 rounded-2xl border px-3 py-2.5">
                  <span className="cursor-grabbing px-1 text-lg text-muted select-none">⋮⋮</span>
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent">
                    {order.indexOf(active) + 1}
                  </span>
                  <span className="flex-1 text-sm leading-snug text-fg">{rich(a.steps[active])}</span>
                </div>
              ) : null}
            </DragOverlay>,
            document.body
          )}
      </DndContext>
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

/** One step: dragged by its handle (dnd-kit sortable), or moved with the arrows. */
function Row({
  id,
  pos,
  count,
  state,
  disabled,
  onMove,
  children,
}: {
  id: string;
  pos: number;
  count: number;
  state: string;
  disabled: boolean;
  onMove: (to: number) => void;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      data-state={state}
      className={`order-row flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${isDragging ? "opacity-30" : ""}`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Drag step ${pos + 1}`}
        className="order-handle cursor-grab touch-none px-1 text-lg text-muted select-none active:cursor-grabbing disabled:cursor-default"
      >
        ⋮⋮
      </button>
      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent">{pos + 1}</span>
      <span className="flex-1 text-sm leading-snug text-fg">{children}</span>
      <span className="flex flex-col">
        <button type="button" aria-label="Move up" disabled={pos === 0 || disabled} onClick={() => onMove(pos - 1)} className="px-2 text-muted hover:text-accent disabled:opacity-30">
          ▲
        </button>
        <button type="button" aria-label="Move down" disabled={pos === count - 1 || disabled} onClick={() => onMove(pos + 1)} className="px-2 text-muted hover:text-accent disabled:opacity-30">
          ▼
        </button>
      </span>
    </li>
  );
}
