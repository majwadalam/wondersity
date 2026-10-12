"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { EASE_OUT, spring } from "../motion/presets";
import type { Activity } from "@/lib/activities";
import { ActivityFrame } from "./ActivityFrame";

type DiagramData = Extract<Activity, { type: "diagram" }>;

/**
 * An interactive concept map. It builds itself as it scrolls into view (nodes,
 * then the links between them); tapping a node lights its links, and a pulse
 * runs along each one in the direction of the relationship.
 */
export function DiagramActivity({ a, onDone }: { a: DiagramData; onDone: () => void }) {
  const reduce = useReducedMotion();
  const [active, setActive] = useState<number | null>(null);
  const [visited, setVisited] = useState<Set<number>>(() => new Set());
  const need = Math.min(a.nodes.length, 3);
  const done = visited.size >= need;

  // Nodes on a circle (the first one in the centre when there are 5+).
  const n = a.nodes.length;
  const centred = n >= 5;
  const pos = a.nodes.map((_, i) => {
    if (centred && i === 0) return { x: 200, y: 150 };
    const k = centred ? i - 1 : i;
    const total = centred ? n - 1 : n;
    const ang = -Math.PI / 2 + (k / total) * Math.PI * 2;
    return { x: 200 + Math.cos(ang) * 145, y: 150 + Math.sin(ang) * 112 };
  });

  function open(i: number) {
    setActive(i);
    const next = new Set(visited).add(i);
    setVisited(next);
    if (next.size >= need) onDone();
  }

  const linked = (e: { from: number; to: number }) => active !== null && (e.from === active || e.to === active);
  const neighbours = active === null ? [] : a.edges.filter(linked);

  return (
    <ActivityFrame type="diagram" title={a.title} prompt={a.prompt} reveal={a.reveal} done={done}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <motion.svg
          viewBox="0 0 400 300"
          className="diagram-svg w-full rounded-2xl bg-canvas"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.4 }}
        >
          <defs>
            <marker id={`arrow-${a.title.length}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10z" fill="var(--accent)" />
            </marker>
          </defs>
          {a.edges.map((e, i) => {
            const p = pos[e.from];
            const q = pos[e.to];
            // Stop the line at the node's edge.
            const dx = q.x - p.x;
            const dy = q.y - p.y;
            const len = Math.hypot(dx, dy) || 1;
            // Captions sit under each node, so lines leaving downward or arriving
            // from below stop further out, clear of the text.
            const r = 20 + 32 * Math.max(0, dy / len);
            const rEnd = 22 + 34 * Math.max(0, -dy / len);
            const on = linked(e);
            return (
              <g key={i} className="diagram-edge" data-on={on || undefined} opacity={active === null || on ? 1 : 0.18}>
                <motion.line
                  x1={p.x + (dx / len) * r}
                  y1={p.y + (dy / len) * r}
                  x2={q.x - (dx / len) * rEnd}
                  y2={q.y - (dy / len) * rEnd}
                  stroke={on ? "var(--accent)" : "#c3cbe0"}
                  strokeWidth={on ? 2.5 : 1.6}
                  markerEnd={`url(#arrow-${a.title.length})`}
                  variants={{
                    hidden: { pathLength: reduce ? 1 : 0, opacity: reduce ? 1 : 0 },
                    show: { pathLength: 1, opacity: 1, transition: { duration: 0.6, ease: EASE_OUT, delay: 0.35 + i * 0.12 } },
                  }}
                />
                {/* Direction of the relationship, while its node is selected. */}
                {on && (
                  <line
                    x1={p.x + (dx / len) * r}
                    y1={p.y + (dy / len) * r}
                    x2={q.x - (dx / len) * rEnd}
                    y2={q.y - (dy / len) * rEnd}
                    pathLength={100}
                    className="diagram-flow"
                  />
                )}
                {/* Relationship labels live in the side panel; on the canvas they collided with node captions. */}
              </g>
            );
          })}
          {a.nodes.map((node, i) => {
            const on = active === i;
            const near = neighbours.some((e) => e.from === i || e.to === i);
            return (
              <motion.g
                key={i}
                variants={{
                  hidden: { opacity: 0, scale: reduce ? 1 : 0.5 },
                  show: { opacity: 1, scale: 1, transition: { ...spring.bouncy, delay: i * 0.07 } },
                }}
                role="button"
                tabIndex={0}
                aria-label={node.label}
                onClick={() => open(i)}
                onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && open(i)}
                className="diagram-node cursor-pointer"
                data-state={on ? "active" : near ? "near" : visited.has(i) ? "seen" : "idle"}
                style={{ transformOrigin: `${pos[i].x}px ${pos[i].y}px` }}
              >
                <circle cx={pos[i].x} cy={pos[i].y} r="16" />
                <text x={pos[i].x} y={pos[i].y + 4} textAnchor="middle" className="diagram-index" pointerEvents="none">
                  {i + 1}
                </text>
                {/* The label sits under its node, so it never spills over the circle. */}
                <foreignObject x={pos[i].x - 55} y={pos[i].y + 19} width="110" height="34" pointerEvents="none">
                  <div className="diagram-caption text-center text-[10.5px] leading-[1.2] font-semibold">{node.label}</div>
                </foreignObject>
              </motion.g>
            );
          })}
        </motion.svg>
        <div className="rounded-2xl border border-line bg-canvas p-4">
          {active === null ? (
            <p className="text-sm text-muted">Tap any node to see what it is and how it connects.</p>
          ) : (
            <div key={active} className="diagram-panel">
              <p className="font-display text-xl text-accent">{a.nodes[active].label}</p>
              <p className="mt-1 text-sm leading-relaxed text-fg/90">{a.nodes[active].detail}</p>
              {neighbours.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {neighbours.map((e, i) => {
                    const other = e.from === active ? e.to : e.from;
                    return (
                      <li key={i}>
                        <button type="button" onClick={() => open(other)} className="text-left text-sm text-fg hover:text-accent">
                          {e.from === active ? "→ " : "← "}
                          <span className="text-muted">{e.label || "links to"}</span> <b>{a.nodes[other].label}</b>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
          <p className="mt-4 text-xs text-muted tabular-nums">
            Explored {visited.size}/{a.nodes.length}
          </p>
        </div>
      </div>
    </ActivityFrame>
  );
}
