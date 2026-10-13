"use client";

import { useId, useMemo, useState } from "react";
import type { InlineGraph as Graph } from "@/lib/embeds";
import { compileExpression, sample, type Fn } from "@/lib/expression";
import { rich } from "./rich";

const W = 400;
const H = 220;
const PAD = { l: 40, r: 12, t: 10, b: 26 };
const tick = (n: number) => String(Number(n.toPrecision(3)));
const fmt = (n: number) => String(Math.round(n * 1000) / 1000);

/**
 * A graph written inside lesson text (lib/embeds.ts): its curves, and a
 * slider for k if it has one. The first curve is the one the slider moves;
 * the others are dashed, for comparison. Practice: nothing is recorded.
 */
export function InlineGraph({ graph }: { graph: Graph }) {
  const clipId = useId();
  const fns = useMemo(() => graph.curves.map((c) => compileExpression(c)), [graph.curves]);
  const [k, setK] = useState(graph.slider?.start ?? 1);
  const { x, y } = graph;
  const px = (v: number) => PAD.l + ((v - x.min) / (x.max - x.min)) * (W - PAD.l - PAD.r);
  const py = (v: number) => PAD.t + (1 - (v - y.min) / (y.max - y.min)) * (H - PAD.t - PAD.b);
  const span = y.max - y.min;
  const path = (f: Fn) => {
    let d = "";
    let pen = false;
    for (const p of sample(f, k, x.min, x.max, 200)) {
      if (p.y === null || p.y < y.min - span * 2 || p.y > y.max + span * 2) {
        pen = false;
        continue;
      }
      d += `${pen ? "L" : "M"}${px(p.x).toFixed(1)} ${py(p.y).toFixed(1)} `;
      pen = true;
    }
    return d.trim();
  };
  const zeroY = y.min < 0 && y.max > 0 ? py(0) : H - PAD.b;
  const zeroX = x.min < 0 && x.max > 0 ? px(0) : PAD.l;

  return (
    <figure className="my-2 rounded-2xl border border-line bg-surface p-3 sm:p-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="graph-svg w-full rounded-xl bg-canvas" role="img" aria-label={`Graph of ${graph.curves.map((c) => `y = ${c}`).join(" and ")}${graph.slider ? ` with ${graph.slider.label} at ${fmt(k)}` : ""}`}>
        <defs>
          <clipPath id={clipId}>
            <rect x={PAD.l} y={PAD.t} width={W - PAD.l - PAD.r} height={H - PAD.t - PAD.b} />
          </clipPath>
        </defs>
        <line x1={PAD.l} x2={W - PAD.r} y1={zeroY} y2={zeroY} className="graph-axis" />
        <line x1={zeroX} x2={zeroX} y1={PAD.t} y2={H - PAD.b} className="graph-axis" />
        <text x={PAD.l} y={H - 8} className="graph-tick">{tick(x.min)}</text>
        <text x={W - PAD.r} y={H - 8} textAnchor="end" className="graph-tick">{tick(x.max)}</text>
        <text x={PAD.l - 5} y={PAD.t + 8} textAnchor="end" className="graph-tick">{tick(y.max)}</text>
        <text x={PAD.l - 5} y={H - PAD.b} textAnchor="end" className="graph-tick">{tick(y.min)}</text>
        <text x={(W + PAD.l) / 2} y={H - 8} textAnchor="middle" className="graph-label">{x.label}</text>
        <text x={12} y={(H - PAD.b) / 2} className="graph-label" transform={`rotate(-90 12 ${(H - PAD.b) / 2})`} textAnchor="middle">
          {y.label}
        </text>
        <g clipPath={`url(#${clipId})`}>
          {fns.slice(1).map((f, i) => (
            <path key={i} d={path(f)} className="graph-ghost" />
          ))}
          <path d={path(fns[0])} className="graph-curve" />
        </g>
      </svg>
      {graph.slider && (
        <label className="mt-3 block">
          <span className="flex items-baseline justify-between text-sm text-fg">
            <span>{graph.slider.label}</span>
            <span className="font-mono tabular-nums text-accent">{fmt(k)}</span>
          </span>
          <input
            type="range"
            min={graph.slider.min}
            max={graph.slider.max}
            step={graph.slider.step}
            value={k}
            onChange={(e) => setK(Number(e.target.value))}
            className="sim-range mt-2 w-full"
          />
        </label>
      )}
      {graph.caption && <figcaption className="mt-2 text-sm leading-relaxed text-muted">{rich(graph.caption)}</figcaption>}
    </figure>
  );
}
