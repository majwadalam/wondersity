"use client";

import { useState } from "react";
import type { Activity } from "@/lib/activities";
import { ActivityFrame } from "./ActivityFrame";

type SimData = Extract<Activity, { type: "simulation" }>;

const fmt = (n: number) => String(Math.round(n * 1000) / 1000);

/** Move the slider; the gauge and the outcome change as you cross each range. */
export function SimulationActivity({ a, onDone }: { a: SimData; onDone: () => void }) {
  const { slider, bands } = a;
  const [value, setValue] = useState(slider.initial);
  const [visited, setVisited] = useState<Set<number>>(() => new Set([bandIndex(slider.initial)]));

  function bandIndex(v: number) {
    const i = bands.findIndex((b) => v <= b.upTo);
    return i === -1 ? bands.length - 1 : i;
  }
  const current = bandIndex(value);
  const done = visited.size >= Math.min(2, bands.length);

  function change(v: number) {
    setValue(v);
    const next = new Set(visited).add(bandIndex(v));
    setVisited(next);
    if (next.size >= Math.min(2, bands.length)) onDone();
  }

  // Gauge: a 180° arc split into one segment per band, with a needle.
  const t = (value - slider.min) / (slider.max - slider.min);
  const angle = -90 + t * 180;
  const segments = bands.map((b, i) => {
    const start = i === 0 ? 0 : (Math.min(bands[i - 1].upTo, slider.max) - slider.min) / (slider.max - slider.min);
    const end = (Math.min(b.upTo, slider.max) - slider.min) / (slider.max - slider.min);
    return { start: Math.max(0, start), end: Math.min(1, end) };
  });
  const point = (f: number, r: number) => {
    const rad = Math.PI * (1 - f);
    return [100 + r * Math.cos(rad), 100 - r * Math.sin(rad)];
  };
  const colors = ["#cfccff", "#a9a4ff", "#635bff", "#6ec3f4", "#15be53"];

  return (
    <ActivityFrame type="simulation" title={a.title} prompt={a.prompt} reveal={a.reveal} done={done}>
      <div className="grid items-center gap-6 sm:grid-cols-[220px_minmax(0,1fr)]">
        <svg viewBox="0 0 200 115" className="mx-auto w-full max-w-[240px]" aria-hidden>
          {segments.map((s, i) => {
            const [x1, y1] = point(s.start, 80);
            const [x2, y2] = point(s.end, 80);
            return (
              <path
                key={i}
                d={`M${x1} ${y1} A80 80 0 0 1 ${x2} ${y2}`}
                fill="none"
                stroke={colors[i % colors.length]}
                strokeWidth={i === current ? 16 : 11}
                strokeLinecap="butt"
                opacity={i === current ? 1 : 0.45}
                className="sim-segment"
              />
            );
          })}
          <g className="sim-needle" style={{ transform: `rotate(${angle}deg)`, transformOrigin: "100px 100px" }}>
            <line x1="100" y1="100" x2="100" y2="34" stroke="#0f1729" strokeWidth="3" strokeLinecap="round" />
          </g>
          <circle cx="100" cy="100" r="7" fill="var(--accent)" />
        </svg>
        <div>
          <label className="block">
            <span className="flex items-baseline justify-between text-sm">
              <span className="text-fg">{slider.label}</span>
              <span className="font-display text-2xl text-accent tabular-nums">
                {fmt(value)} <span className="text-sm text-muted">{slider.unit}</span>
              </span>
            </span>
            <input
              type="range"
              min={slider.min}
              max={slider.max}
              step={slider.step}
              value={value}
              onChange={(e) => change(Number(e.target.value))}
              className="sim-range mt-3 w-full"
            />
            <span className="mt-1 flex justify-between text-[11px] text-muted">
              <span>
                {fmt(slider.min)} {slider.unit}
              </span>
              <span>
                {fmt(slider.max)} {slider.unit}
              </span>
            </span>
          </label>
          <div key={current} className="sim-outcome mt-4 rounded-2xl border p-4" style={{ borderColor: colors[current % colors.length] }}>
            <p className="font-display text-lg text-fg">{bands[current].title}</p>
            {bands[current].detail && <p className="mt-1 text-sm leading-relaxed text-fg/85">{bands[current].detail}</p>}
          </div>
          {!done && <p className="mt-2 text-xs text-muted">Drag the slider to see what changes.</p>}
        </div>
      </div>
    </ActivityFrame>
  );
}
