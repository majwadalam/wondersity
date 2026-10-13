// Interactive activities inside a lesson: predict-before-you-learn, scenarios,
// drag-and-drop sorting and ordering, stories, timelines, infographics,
// simulations, concept diagrams, narrated snippets, playable sounds and
// graphs whose curve the learner reshapes.
//
// The model fills ONE flat activity shape (structured-output providers handle
// flat schemas far more reliably than unions); unused fields are left empty.
// normalizeActivity() then validates each one for its type and converts it to
// a clean, typed activity. Anything malformed is dropped, never shown.

import { compileExpression, sample, type Fn } from "./expression";

export const ACTIVITY_TYPES = [
  "predict",
  "scenario",
  "sort",
  "order",
  "story",
  "timeline",
  "chart",
  "simulation",
  "diagram",
  "listen",
  "sound",
  "graph",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

type Base = { afterConcept: number; title: string; prompt: string; reveal: string };
type Choice = { text: string; correct: boolean; feedback: string };

export type Activity =
  | (Base & { type: "predict" | "scenario"; options: Choice[] })
  | (Base & { type: "sort"; buckets: string[]; items: { text: string; bucket: string }[] })
  | (Base & { type: "order"; steps: string[] })
  | (Base & { type: "story"; beats: { label: string; text: string }[] })
  | (Base & { type: "timeline"; events: { marker: string; title: string; detail: string }[] })
  | (Base & { type: "chart"; unit: string; bars: { label: string; value: number; note: string }[] })
  | (Base & {
      type: "simulation";
      slider: { label: string; min: number; max: number; step: number; unit: string; initial: number };
      bands: { upTo: number; title: string; detail: string }[];
    })
  | (Base & {
      type: "diagram";
      nodes: { label: string; detail: string }[];
      edges: { from: number; to: number; label: string }[];
    })
  | (Base & { type: "listen"; script: string })
  | (Base & { type: "sound"; clips: { label: string; notes: string[]; detail: string }[] })
  | (Base & {
      type: "graph";
      /** y as a formula in x and k (see expression.ts). */
      expression: string;
      slider: { label: string; min: number; max: number; step: number; unit: string; initial: number };
      bands: { upTo: number; title: string; detail: string }[];
      /** The viewing window, as on a graphing calculator. */
      axis: { xLabel: string; yLabel: string; xMin: number; xMax: number; yMin: number; yMax: number };
    });

// ---------- what the model fills in ----------

const str = { type: "string" };
const num = { type: "number" };

export const activityJsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: [...ACTIVITY_TYPES] },
    title: str,
    prompt: str,
    reveal: str,
    unit: str,
    script: str,
    options: {
      type: "array",
      items: {
        type: "object",
        properties: { text: str, correct: { type: "boolean" }, feedback: str },
        required: ["text", "correct", "feedback"],
        additionalProperties: false,
      },
    },
    buckets: { type: "array", items: str },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: { text: str, group: str, detail: str, value: num },
        required: ["text", "group", "detail", "value"],
        additionalProperties: false,
      },
    },
    edges: {
      type: "array",
      items: {
        type: "object",
        properties: { from: { type: "integer" }, to: { type: "integer" }, label: str },
        required: ["from", "to", "label"],
        additionalProperties: false,
      },
    },
    slider: {
      type: "object",
      properties: { label: str, min: num, max: num, step: num, unit: str, initial: num },
      required: ["label", "min", "max", "step", "unit", "initial"],
      additionalProperties: false,
    },
    bands: {
      type: "array",
      items: {
        type: "object",
        properties: { upTo: num, title: str, detail: str },
        required: ["upTo", "title", "detail"],
        additionalProperties: false,
      },
    },
    axis: {
      type: "object",
      properties: { xLabel: str, yLabel: str, xMin: num, xMax: num, yMin: num, yMax: num },
      required: ["xLabel", "yLabel", "xMin", "xMax", "yMin", "yMax"],
      additionalProperties: false,
    },
  },
  required: [
    "type",
    "title",
    "prompt",
    "reveal",
    "unit",
    "script",
    "options",
    "buckets",
    "items",
    "edges",
    "slider",
    "bands",
    "axis",
  ],
  additionalProperties: false,
};

// Placement is decided by the lesson's blocks (see lessonBlocks.ts), so this
// guide only says how to fill each type. `afterConcept` survives on lessons
// saved before blocks existed, where it still places the activity.
export const ACTIVITY_GUIDE = `Every activity has: type, title, prompt, reveal, and the fields its type uses.
Leave unused fields empty: "" for strings, [] for arrays, 0 for numbers, and
slider = {"label":"","min":0,"max":0,"step":0,"unit":"","initial":0} unless it's a simulation or graph,
and axis = {"xLabel":"","yLabel":"","xMin":0,"xMax":0,"yMin":0,"yMax":0} unless it's a graph.
reveal: the 1-2 sentence takeaway shown after the learner interacts.

- predict (ask before you tell): prompt = a question the learner can't quite answer yet; options =
  3-4 choices with EXACTLY one correct=true; feedback = why each choice is right or wrong; reveal =
  the surprising insight. Use it only where a prediction genuinely sets up what comes next.
- scenario: prompt = a realistic situation (2-3 sentences, second person); options = 3-4 things you
  could do; correct=true for the best one; feedback = what happens next if you choose it.
- sort (drag and drop into groups): buckets = 2-3 short category names; items = 4-8 with text and
  group = EXACTLY one bucket name.
- order (drag into sequence): items = 3-6 steps IN THE CORRECT ORDER, using text only. They are shuffled for the learner.
- story (narrative arc): items = 3-5 beats; group = beat label (e.g. Setup, Tension, Turn, Resolution);
  text = 1-3 sentences following one character through the idea.
- timeline: items = 3-7 events in order; text = marker (a date, era or "Step 1"); group = event title;
  detail = 1-2 sentences.
- chart (infographic, the learner guesses the biggest first): unit = unit label; items = 3-6 bars with
  text = label, value = a real, accurate number >= 0, detail = a short note. Only use well-established figures.
- simulation (cause and effect): slider = one quantity to vary (min < max, step > 0, initial in range);
  bands = 2-5 outcomes sorted by upTo ascending, the last upTo >= slider.max; title + detail say what
  happens in that range.
- diagram (interactive concept map): items = 3-7 nodes (text = short label, detail = 1-2 sentences);
  edges = 2-10 links using 0-based node indexes, label = the relationship. The learner explores by
  TAPPING nodes (no dragging), so the prompt should invite them to tap and trace the connections.
- listen (narrated audio snippet, read aloud): script = 25-80 words, a vivid narration, quote or
  thought experiment worth hearing.
- sound (playable music): for music or sound topics ALWAYS include one, and never use it otherwise.
  items = 1-4 clips; text = label; group = space-separated notes like "C4 E4 G4 B4" (played together as
  a chord, or one after another); detail = what to listen for.
- graph (interactive plot, for maths and physics): a curve the learner reshapes by dragging one parameter.
  script = y as a formula in x and k, using only numbers, x, k, pi, e, + - * / ^ ( ) and sin cos tan asin
  acos atan sqrt abs exp ln log (log is base 10), e.g. "k*x^2", "sin(k*x)", "x*tan(k*pi/180) - 9.8*x^2/(2*20^2*cos(k*pi/180)^2)"
  (a projectile launched at k degrees); slider = k (label, min < max, step > 0, initial in range); axis =
  {xLabel, yLabel, xMin < xMax, yMin < yMax} = the window to look through (e.g. heights 0 to 25 m), chosen so
  the curve is clearly visible across the slider's range; anything outside is clipped. The learner never
  sees "k": name the parameter in words in the prompt (e.g. "drag the launch angle"); bands = 2-5 captions sorted by upTo ascending over k, the last upTo >= slider.max,
  title + detail say what the curve shows at those settings. Use it only when watching a curve change explains
  the idea (graph transformations, trajectories, growth and decay, waves); the formula must be correct.
Choose by fit: timeline for history and processes, simulation for quantities, diagram for systems,
sort for classifying, order for procedures, story and scenario for judgment, chart for comparisons.
Sort and scenario are the easiest to reach for and end up in every lesson; use them only when
classifying or judging IS the skill being learned, and prefer the type that fits this content best.`;

// ---------- validation ----------

type Raw = Record<string, unknown>;
const text = (v: unknown, max = 600) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const arr = (v: unknown): Raw[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Raw[]) : []);
const finite = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : NaN);
const NOTE = /^[A-G](#|b)?[1-7]$/;

/**
 * The formula compiles and draws a real curve at each k: mostly defined, not
 * flat, and actually visible in the window (a fifth of its points inside).
 */
function plottable(expression: string, ks: number[], w: { xMin: number; xMax: number; yMin: number; yMax: number }) {
  let f: Fn;
  try {
    f = compileExpression(expression);
  } catch {
    return false;
  }
  return ks.every((k) => {
    const ys = sample(f, k, w.xMin, w.xMax, 60)
      .map((p) => p.y)
      .filter((y): y is number => y !== null);
    const inside = ys.filter((y) => y >= w.yMin && y <= w.yMax).length;
    return ys.length >= 40 && Math.max(...ys) - Math.min(...ys) > 1e-9 && inside >= 12;
  });
}

/** Returns a clean typed activity, or null if it isn't usable for its type. */
export function normalizeActivity(raw: unknown, conceptCount: number): Activity | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Raw;
  const type = r.type as ActivityType;
  if (!ACTIVITY_TYPES.includes(type)) return null;

  const base: Base = {
    afterConcept: Math.max(-1, Math.min(conceptCount - 1, Math.trunc(finite(r.afterConcept) || 0))),
    title: text(r.title, 120),
    prompt: text(r.prompt),
    reveal: text(r.reveal),
  };
  if (!base.title) return null;
  const items = arr(r.items).map((i) => ({
    text: text(i.text, 300),
    group: text(i.group, 120),
    detail: text(i.detail, 400),
    value: finite(i.value),
  }));

  switch (type) {
    case "predict":
    case "scenario": {
      const options = arr(r.options).map((o) => ({ text: text(o.text, 300), correct: o.correct === true, feedback: text(o.feedback, 400) }));
      const right = options.filter((o) => o.correct).length;
      if (!base.prompt || options.length < 3 || options.length > 4) return null;
      if (options.some((o) => !o.text || !o.feedback)) return null;
      if (type === "predict" ? right !== 1 : right < 1) return null;
      return { ...base, type, options };
    }
    case "sort": {
      const buckets = [...new Set((Array.isArray(r.buckets) ? r.buckets : []).map((b) => text(b, 60)).filter(Boolean))];
      const placed = items.filter((i) => i.text).map((i) => ({ text: i.text, bucket: i.group }));
      if (buckets.length < 2 || buckets.length > 3 || placed.length < 4 || placed.length > 8) return null;
      if (placed.some((i) => !buckets.includes(i.bucket))) return null;
      if (buckets.some((b) => !placed.some((i) => i.bucket === b))) return null;
      return { ...base, type, buckets, items: placed };
    }
    case "order": {
      const steps = items.map((i) => i.text).filter(Boolean);
      if (steps.length < 3 || steps.length > 6 || new Set(steps).size !== steps.length) return null;
      return { ...base, type, steps };
    }
    case "story": {
      const beats = items.filter((i) => i.text).map((i) => ({ label: i.group || "", text: i.text }));
      if (beats.length < 2 || beats.length > 5) return null;
      return { ...base, type, beats };
    }
    case "timeline": {
      const events = items.filter((i) => i.text && i.group).map((i) => ({ marker: i.text, title: i.group, detail: i.detail }));
      if (events.length < 3 || events.length > 7) return null;
      return { ...base, type, events };
    }
    case "chart": {
      const bars = items.filter((i) => i.text).map((i) => ({ label: i.text, value: i.value, note: i.detail }));
      if (bars.length < 3 || bars.length > 6 || bars.some((b) => !(b.value >= 0))) return null;
      if (bars.every((b) => b.value === bars[0].value)) return null;
      return { ...base, type, unit: text(r.unit, 40), bars };
    }
    case "simulation": {
      const s = (r.slider ?? {}) as Raw;
      const slider = {
        label: text(s.label, 80),
        min: finite(s.min),
        max: finite(s.max),
        step: finite(s.step),
        unit: text(s.unit, 30),
        initial: finite(s.initial),
      };
      if (!slider.label || !(slider.max > slider.min) || !(slider.step > 0)) return null;
      if (!(slider.initial >= slider.min && slider.initial <= slider.max)) slider.initial = slider.min;
      const bands = arr(r.bands)
        .map((b) => ({ upTo: finite(b.upTo), title: text(b.title, 100), detail: text(b.detail, 400) }))
        .filter((b) => Number.isFinite(b.upTo) && b.title);
      if (bands.length < 2 || bands.length > 5) return null;
      if (bands.some((b, i) => i > 0 && b.upTo <= bands[i - 1].upTo)) return null;
      bands[bands.length - 1].upTo = Math.max(bands[bands.length - 1].upTo, slider.max);
      return { ...base, type, slider, bands };
    }
    case "diagram": {
      const nodes = items.filter((i) => i.text).map((i) => ({ label: i.text.slice(0, 40), detail: i.detail }));
      const edges = arr(r.edges)
        .map((e) => ({ from: Math.trunc(finite(e.from)), to: Math.trunc(finite(e.to)), label: text(e.label, 60) }))
        .filter((e) => e.from >= 0 && e.to >= 0 && e.from < nodes.length && e.to < nodes.length && e.from !== e.to);
      if (nodes.length < 3 || nodes.length > 7 || edges.length < 2 || edges.length > 12) return null;
      return { ...base, type, nodes, edges };
    }
    case "listen": {
      const script = text(r.script, 900);
      const words = script.split(/\s+/).filter(Boolean).length;
      if (words < 12 || words > 140) return null;
      return { ...base, type, script };
    }
    case "graph": {
      const expression = text(r.script, 200);
      const s = (r.slider ?? {}) as Raw;
      const slider = {
        label: text(s.label, 80),
        min: finite(s.min),
        max: finite(s.max),
        step: finite(s.step),
        unit: text(s.unit, 30),
        initial: finite(s.initial),
      };
      const ax = (r.axis ?? {}) as Raw;
      const axis = {
        xLabel: text(ax.xLabel, 40),
        yLabel: text(ax.yLabel, 40),
        xMin: finite(ax.xMin),
        xMax: finite(ax.xMax),
        yMin: finite(ax.yMin),
        yMax: finite(ax.yMax),
      };
      if (!slider.label || !(slider.max > slider.min) || !(slider.step > 0)) return null;
      if (!(axis.xMax > axis.xMin) || !(axis.yMax > axis.yMin)) return null;
      if (!(slider.initial >= slider.min && slider.initial <= slider.max)) slider.initial = slider.min;
      if (!plottable(expression, [slider.min, slider.initial, slider.max], axis)) return null;
      const bands = arr(r.bands)
        .map((b) => ({ upTo: finite(b.upTo), title: text(b.title, 100), detail: text(b.detail, 400) }))
        .filter((b) => Number.isFinite(b.upTo) && b.title);
      if (bands.length < 2 || bands.length > 5) return null;
      if (bands.some((b, i) => i > 0 && b.upTo <= bands[i - 1].upTo)) return null;
      bands[bands.length - 1].upTo = Math.max(bands[bands.length - 1].upTo, slider.max);
      return { ...base, type, expression, slider, bands, axis };
    }
    case "sound": {
      const clips = items
        .map((i) => ({ label: i.text, notes: i.group.split(/[\s,]+/).filter(Boolean), detail: i.detail }))
        .filter((c) => c.label && c.notes.length > 0 && c.notes.length <= 8 && c.notes.every((n) => NOTE.test(n)));
      if (clips.length < 1 || clips.length > 4) return null;
      return { ...base, type, clips };
    }
  }
}
