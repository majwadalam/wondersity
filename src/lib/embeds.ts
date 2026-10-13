// Interactive pieces written inside lesson text. Today one kind: a graph,
// written as a fenced block the writer can drop into any explanation, worked
// example or problem:
//
//   ```graph
//   y = k*x^2
//   y = x^2
//   x: -5 to 5, distance (m)
//   y: 0 to 25, height (m)
//   k: 0.5 to 3, steepness, start 1
//   caption: The dashed curve is y = x²; drag to compare.
//   ```
//
// 1-3 curves in x (and k, if there's a slider), compiled by the safe parser in
// lib/expression.ts. The server checks every block when a lesson is saved
// (cleanEmbeds) and drops any that doesn't draw a visible curve, the same test
// graph activities pass; the browser parses the block again to draw it.

import { compileExpression, sample, type Fn } from "./expression";

export type InlineGraph = {
  curves: string[];
  x: { min: number; max: number; label: string };
  y: { min: number; max: number; label: string };
  slider: { min: number; max: number; label: string; start: number; step: number } | null;
  caption: string;
};

/** A fenced graph block in lesson text; group 1 is its body. */
export const GRAPH_FENCE = /```graph[ \t]*\n([\s\S]*?)\n?```/g;

const NUM = String.raw`(-?\d+(?:\.\d+)?)`;
const RANGE = new RegExp(String.raw`^${NUM}\s*(?:to|\.\.|–|-)\s*${NUM}\s*(?:,\s*(.*))?$`);

function range(rest: string) {
  const m = rest.trim().match(RANGE);
  if (!m) return null;
  const min = Number(m[1]);
  const max = Number(m[2]);
  return max > min ? { min, max, label: (m[3] ?? "").trim().slice(0, 50) } : null;
}

/** Parses one graph block's body; null if it isn't a well-formed graph. */
export function parseGraph(body: string): InlineGraph | null {
  const curves: string[] = [];
  let x: InlineGraph["x"] | null = null;
  let y: InlineGraph["y"] | null = null;
  let slider: InlineGraph["slider"] = null;
  let caption = "";
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const curve = line.match(/^y\s*=\s*(.+)$/);
    const field = line.match(/^(x|y|k|caption)\s*:\s*(.*)$/i);
    if (curve) curves.push(curve[1].trim());
    else if (field?.[1].toLowerCase() === "x") x = range(field[2]);
    else if (field?.[1].toLowerCase() === "y") y = range(field[2]);
    else if (field?.[1].toLowerCase() === "caption") caption = field[2].trim().slice(0, 200);
    else if (field?.[1].toLowerCase() === "k") {
      const start = field[2].match(/,\s*start\s+(-?\d+(?:\.\d+)?)\s*$/i);
      const r = range(field[2].replace(/,\s*start\s+-?\d+(?:\.\d+)?\s*$/i, ""));
      if (!r || !r.label) return null;
      const s = start ? Number(start[1]) : r.min;
      slider = { min: r.min, max: r.max, label: r.label, start: s >= r.min && s <= r.max ? s : r.min, step: niceStep(r.max - r.min) };
    } else return null;
  }
  if (!x || !y || curves.length < 1 || curves.length > 3) return null;
  return { curves, x, y, slider, caption };
}

/** About 100 slider positions, rounded to 1, 2 or 5 times a power of ten. */
function niceStep(span: number) {
  const raw = span / 100;
  const p = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((m) => m * p).find((s) => s >= raw)!;
}

/** Every curve compiles and is visibly drawn in the window, at each end of the slider. */
export function graphDraws(g: InlineGraph) {
  const ks = g.slider ? [g.slider.min, g.slider.start, g.slider.max] : [1];
  return g.curves.every((src) => {
    if (!g.slider && /\bk\b/.test(src)) return false;
    let f: Fn;
    try {
      f = compileExpression(src);
    } catch {
      return false;
    }
    return ks.every((k) => {
      const ys = sample(f, k, g.x.min, g.x.max, 60)
        .map((p) => p.y)
        .filter((v): v is number => v !== null);
      return ys.length >= 40 && ys.filter((v) => v >= g.y.min && v <= g.y.max).length >= 12;
    });
  });
}

/** Lesson text with graph blocks that don't parse or draw removed (run on every lesson saved). */
export function cleanEmbeds(text: string) {
  if (!text.includes("```")) return text;
  // Good blocks are set aside while a fence cut off before it closes is dropped.
  const kept: string[] = [];
  return text
    .replace(GRAPH_FENCE, (block, body: string) => {
      const g = parseGraph(body);
      return g && graphDraws(g) ? `\u0000${kept.push(block) - 1}\u0000` : "";
    })
    .replace(/```graph[\s\S]*$/, "")
    .replace(/\u0000(\d+)\u0000/g, (_, i: string) => kept[Number(i)])
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Splits text into plain stretches and graphs, in order (the browser's side). */
export function splitEmbeds(text: string): ({ kind: "text"; text: string } | { kind: "graph"; graph: InlineGraph })[] {
  const out: ({ kind: "text"; text: string } | { kind: "graph"; graph: InlineGraph })[] = [];
  let last = 0;
  for (const m of text.matchAll(GRAPH_FENCE)) {
    if (m.index! > last) out.push({ kind: "text", text: text.slice(last, m.index) });
    const g = parseGraph(m[1]);
    if (g) out.push({ kind: "graph", graph: g });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}
