// A lesson is an ordered sequence of teaching blocks, designed around its
// topic, rather than one fixed template. This file is the shape of a stored
// lesson, shared by server and browser; lessonDesign.ts holds the writing
// guide and validation.
//
// Storage stays compatible with everything that reads lessons:
// - `questions` still holds the graded knowledge checks (2-4), so server-side
//   grading and course progress work unchanged. A "check" block places one
//   of them inline, at the point in the lesson where it belongs.
// - `activities` still holds the typed interactive activities; an "activity"
//   block places one.
// - Lessons saved before blocks existed have no `blocks`; lessonBlocks()
//   rebuilds their original order (concepts, activities, quiz at the end).

import type { Resources } from "./enrichment";
import type { Activity } from "./activities";
import type { Staging } from "./staging";

export const APPROACHES = {
  mystery: "Mystery first: open with a puzzle or surprising fact, then resolve it",
  discovery: "Guided discovery: the learner works the idea out through questions and experiments",
  visual: "Visual explanation: diagrams, charts and spatial models carry the idea",
  scenario: "Real-world scenario: one realistic situation the learner works through",
  worked_example: "Worked example: solve a problem step by step, then the learner tries one",
  misconception: "Misconception challenge: surface a common wrong belief, then dismantle it",
  simulation: "Interactive simulation: vary a quantity and watch what changes",
  case_study: "Case study: a real event or example examined closely",
  story: "Story: a narrative that carries the idea",
  socratic: "Socratic dialogue: a conversation of questions that leads to the idea",
  compare: "Compare and contrast: understand an idea by setting it against another",
  practice: "Practice-driven: short explanation, then many attempts with feedback",
  reflection: "Reflection and application: connect the idea to the learner's own life or work",
} as const;
export type Approach = keyof typeof APPROACHES;

export const BLOCK_KINDS = [
  "explain",
  "activity",
  "check",
  "worked",
  "code",
  "compare",
  "reflect",
  "dialogue",
  "summary",
  "problem",
] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];

export type CodeOption = { text: string; correct: boolean; feedback: string };
export type TraceStep = { line: number; note: string; state: string };

export type Block =
  | { kind: "explain"; heading: string; body: string; example: string }
  /** Places lesson.activities[ref]. */
  | { kind: "activity"; ref: number }
  /** Places graded question lesson.questions[ref], with progressive hints and another way to explain it. */
  | { kind: "check"; ref: number; hints: string[]; retry: string }
  | { kind: "worked"; heading: string; problem: string; steps: { title: string; text: string; why: string }[]; answer: string }
  | {
      kind: "code";
      heading: string;
      prompt: string;
      language: string;
      code: string;
      /** predict: what does it print? bug: which change fixes it? trace: step through it. */
      mode: "predict" | "bug" | "trace";
      options: CodeOption[];
      trace: TraceStep[];
      explanation: string;
      hints: string[];
    }
  | { kind: "compare"; heading: string; intro: string; columns: [string, string]; rows: { label: string; a: string; b: string }[] }
  | { kind: "reflect"; heading: string; prompt: string; model: string }
  | { kind: "dialogue"; heading: string; turns: { speaker: string; text: string }[] }
  | { kind: "summary"; heading: string; points: string[] }
  /**
   * A problem the learner works out and types the answer to. Checked in the
   * browser (practice, not graded): numbers with a small tolerance, short
   * text exactly. Likely wrong answers ("traps") get feedback aimed at the
   * mistake behind them.
   */
  | {
      kind: "problem";
      heading: string;
      prompt: string;
      answers: string[];
      unit: string;
      traps: { answer: string; feedback: string }[];
      hints: string[];
      solution: string;
    };

/** A graded knowledge check. Graded on the server against the stored lesson. */
export type Question = { question: string; options: string[]; correctAnswer: string; explanation: string };

/**
 * A stored lesson. New lessons have version 2, an approach and blocks; older
 * ones have concepts and (sometimes) activities, rendered via lessonBlocks().
 */
export type Lesson = {
  version?: 2;
  title: string;
  objective: string;
  estimatedMinutes: number;
  approach?: Approach;
  approachReason?: string;
  blocks?: Block[];
  concepts?: { name: string; explanation: string; example: string }[];
  activities?: Activity[];
  questions: Question[];
  /** Scenes with a guide, added after the lesson is written (lib/staging.ts). */
  staging?: Staging;
  /** Web pages that confirmed the lesson's claims (lib/factVerify.ts). */
  sources?: { url: string; title: string }[];
  /** "Go deeper": confirmed videos, articles, books and images (lib/enrichment.ts). */
  resources?: Resources;
};

/**
 * The block sequence for any stored lesson. Lessons written before blocks
 * existed are rebuilt in their original order: activities placed before the
 * first concept, each concept followed by its activities, the quiz at the end.
 */
export function lessonBlocks(lesson: Lesson): Block[] {
  if (Array.isArray(lesson.blocks) && lesson.blocks.length > 0) return lesson.blocks;
  const blocks: Block[] = [];
  const activities = lesson.activities ?? [];
  const activitiesAt = (slot: number) =>
    activities.forEach((a, ref) => {
      if ((a.afterConcept ?? 0) === slot) blocks.push({ kind: "activity", ref });
    });
  activitiesAt(-1);
  (lesson.concepts ?? []).forEach((c, i) => {
    blocks.push({ kind: "explain", heading: c.name, body: c.explanation, example: c.example });
    activitiesAt(i);
  });
  (lesson.questions ?? []).forEach((_, ref) => blocks.push({ kind: "check", ref, hints: [], retry: "" }));
  return blocks;
}

/** Blocks the learner engages with (they count toward the session bar). */
export const isInteractive = (b: Block) => b.kind !== "explain" && b.kind !== "compare" && b.kind !== "summary";

// ---------- checking a typed answer ----------

/** "1,200" → 1200, "3/4" → 0.75, "12 cm" → 12, "$30" → 30, "-0.5" → -0.5; NaN if it doesn't start with a number. */
export function parseNumber(input: string): number {
  const s = input
    .trim()
    .replace(/(\d),(?=\d{3}\b)/g, "$1")
    .replace(/^\+/, "")
    .replace(/^(-?)\s*[$€£¥₹]\s*/, "$1");
  const fraction = s.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  if (fraction) return Number(fraction[2]) === 0 ? NaN : Number(fraction[1]) / Number(fraction[2]);
  const n = s.match(/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?/i);
  return n ? Number(n[0]) : NaN;
}

// Spacing around commas, semicolons and colons doesn't count, nor does one
// pair of brackets around the whole answer: "(2, 0, 14)" = "2,0,14".
const normalizeText = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.!]+$/, "")
    .replace(/^["'`]|["'`]$/g, "")
    .replace(/^[([{]\s*(.*?)\s*[)\]}]$/, "$1")
    .replace(/\s*([,;:])\s*/g, "$1");

/**
 * Whether `input` matches `expected`. Integers must match exactly; other
 * numbers within 1% (so 3.14 accepts 3.1416); text after normalizing case,
 * spacing, enclosing brackets and a trailing full stop.
 */
export function answerMatches(input: string, expected: string): boolean {
  const want = parseNumber(expected);
  const isNumeric = Number.isFinite(want) && normalizeText(expected).replace(/[\d.,\s/eE+-]/g, "").length <= 6;
  if (isNumeric) {
    const got = parseNumber(input);
    if (!Number.isFinite(got)) return false;
    if (Number.isInteger(want) && !/[./]/.test(expected)) return got === want;
    return Math.abs(got - want) <= Math.max(1e-9, Math.abs(want) * 0.01);
  }
  return normalizeText(input) === normalizeText(expected);
}

/** Checks a typed answer against a problem block. */
export function checkProblem(
  b: Extract<Block, { kind: "problem" }>,
  input: string
): { correct: boolean; feedback: string | null } {
  if (b.answers.some((a) => answerMatches(input, a))) return { correct: true, feedback: null };
  const trap = b.traps.find((t) => answerMatches(input, t.answer));
  return { correct: false, feedback: trap?.feedback ?? null };
}
