"use client";

import { motion, useMotionValueEvent, useReducedMotion, useSpring } from "motion/react";
import { useId, useMemo, useState } from "react";
import type { Activity } from "@/lib/activities";
import { compileExpression, sample, type Fn } from "@/lib/expression";
import { EASE_OUT, spring } from "../motion/presets";
import { ActivityFrame } from "./ActivityFrame";

type GraphData = Extract<Activity, { type: "graph" }>;

const W = 400;
const H = 240;
const PAD = { l: 44, r: 12, t: 12, b: 28 };

const fmt = (n: number) => String(Math.round(n * 1000) / 1000);
/** Axis labels: at most 3 significant figures, so they fit beside the axis. */
const tick = (n: number) => String(Number(n.toPrecision(3)));

/** An SVG path through the samples, broken wherever the function is undefined or off the chart. */
function pathFor(f: Fn, k: number, xMin: number, xMax: number, y0: number, y1: number) {
  const px = (x: number) => PAD.l + ((x - xMin) / (xMax - xMin)) * (W - PAD.l - PAD.r);
  const py = (y: number) => PAD.t + (1 - (y - y0) / (y1 - y0)) * (H - PAD.t - PAD.b);
  const span = y1 - y0;
  let d = "";
  let pen = false;
  for (const p of sample(f, k, xMin, xMax, 160)) {
    if (p.y === null || p.y < y0 - span * 2 || p.y > y1 + span * 2) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${px(p.x).toFixed(1)} ${py(p.y).toFixed(1)} `;
    pen = true;
  }
  return { d: d.trim() || `M${PAD.l} ${H - PAD.b}`, px, py };
}

/**
 * Drag the parameter and watch the curve reshape. The curve follows the
 * slider on a spring, a faint copy shows where it started, and the caption
 * for the current range of the parameter explains what you're seeing.
 */
export function GraphActivity({ a, onDone }: { a: GraphData; onDone: () => void }) {
  const { slider, bands, axis } = a;
  const reduce = useReducedMotion();
  const f = useMemo(() => compileExpression(a.expression), [a.expression]);
  // A fixed window (chosen by the lesson, checked on validation), so the
  // transformation is visible; the curve is clipped to it.
  const y0 = axis.yMin;
  const y1 = axis.yMax;
  const clipId = useId();
  const [value, setValue] = useState(slider.initial);
  // The drawn k eases toward the slider value (no lag with reduced motion).
  const kSpring = useSpring(slider.initial, reduce ? { duration: 0 } : spring.follow);
  const [drawnK, setDrawnK] = useState(slider.initial);
  useMotionValueEvent(kSpring, "change", setDrawnK);

  const bandIndex = (v: number) => {
    const i = bands.findIndex((b) => v <= b.upTo);
    return i === -1 ? bands.length - 1 : i;
  };
  const [visited, setVisited] = useState<Set<number>>(() => new Set([bandIndex(slider.initial)]));
  const need = Math.min(2, bands.length);
  const done = visited.size >= need;
  const current = bands[bandIndex(value)];

  function change(v: number) {
    setValue(v);
    kSpring.set(v);
    const next = new Set(visited).add(bandIndex(v));
    setVisited(next);
    if (next.size >= need) onDone();
  }

  const curve = pathFor(f, drawnK, axis.xMin, axis.xMax, y0, y1);
  const ghost = useMemo(() => pathFor(f, slider.initial, axis.xMin, axis.xMax, y0, y1).d, [f, slider.initial, axis, y0, y1]);
  const zeroY = y0 < 0 && y1 > 0 ? curve.py(0) : null;
  const zeroX = axis.xMin < 0 && axis.xMax > 0 ? curve.px(0) : null;

  return (
    <ActivityFrame type="graph" title={a.title} prompt={a.prompt} reveal={a.reveal} done={done}>
      <figure>
        <svg viewBox={`0 0 ${W} ${H}`} className="graph-svg w-full rounded-2xl bg-canvas" role="img" aria-label={`Graph of ${axis.yLabel || "y"} against ${axis.xLabel || "x"} with ${slider.label} at ${fmt(value)}${slider.unit}`}>
          {/* axes */}
          <line x1={PAD.l} x2={W - PAD.r} y1={zeroY ?? H - PAD.b} y2={zeroY ?? H - PAD.b} className="graph-axis" />
          <line x1={zeroX ?? PAD.l} x2={zeroX ?? PAD.l} y1={PAD.t} y2={H - PAD.b} className="graph-axis" />
          <defs>
            <clipPath id={clipId}>
              <rect x={PAD.l} y={PAD.t} width={W - PAD.l - PAD.r} height={H - PAD.t - PAD.b} />
            </clipPath>
          </defs>
          <text x={PAD.l} y={H - 8} className="graph-tick">{tick(axis.xMin)}</text>
          <text x={W - PAD.r} y={H - 8} textAnchor="end" className="graph-tick">{tick(axis.xMax)}</text>
          <text x={PAD.l - 5} y={PAD.t + 8} textAnchor="end" className="graph-tick">{tick(y1)}</text>
          <text x={PAD.l - 5} y={H - PAD.b} textAnchor="end" className="graph-tick">{tick(y0)}</text>
          <text x={(W + PAD.l) / 2} y={H - 8} textAnchor="middle" className="graph-label">{axis.xLabel}</text>
          <text x={12} y={(H - PAD.b) / 2} className="graph-label" transform={`rotate(-90 12 ${(H - PAD.b) / 2})`} textAnchor="middle">
            {axis.yLabel}
          </text>
          {/* where the curve started, and where it is now */}
          <g clipPath={`url(#${clipId})`}>
          {drawnK !== slider.initial && <path d={ghost} className="graph-ghost" />}
          <motion.path
            d={curve.d}
            className="graph-curve"
            initial={{ pathLength: reduce ? 1 : 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 1.1, ease: EASE_OUT }}
          />
          </g>
        </svg>
        <figcaption className="sr-only">
          {current.title}. {current.detail}
        </figcaption>
      </figure>

      <label className="mt-4 block">
        <span className="flex items-baseline justify-between text-sm text-fg">
          <span>{slider.label}</span>
          <span className="font-mono tabular-nums text-accent">
            {fmt(value)}
            {slider.unit}
          </span>
        </span>
        <input
          type="range"
          min={slider.min}
          max={slider.max}
          step={slider.step}
          value={value}
          onChange={(e) => change(Number(e.target.value))}
          className="sim-range mt-2 w-full"
        />
      </label>
      <motion.div
        key={current.title}
        className="mt-3 rounded-2xl border border-accent/30 bg-accent-soft px-4 py-3"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring.gentle}
        aria-live="polite"
      >
        <p className="text-sm font-semibold text-accent">{current.title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-fg/90">{current.detail}</p>
      </motion.div>
    </ActivityFrame>
  );
}
