// Targeted revisions: instead of rewriting the whole lesson, the reviser
// returns only the changes the review asked for, and code applies them. A
// rewrite of a lesson costs as much as writing it (run 15: $0.060 for a
// revision against $0.041 for the draft); a patch is a few blocks.
//
// The patched lesson goes through the same validation (normalizeLesson) and
// the same review as any other version, so the quality gate is unchanged. A
// patch that doesn't apply is reported as an error and the caller falls back to
// a full revision.
//
// Indices always refer to the lesson AS SENT (blocks, questions and
// activities numbered with "at"). Blocks can be replaced, inserted after a
// block (-1 = at the start) or removed. Questions and activities can be
// replaced or added; added ones go to the end, so existing references keep
// their meaning and a new one's index is (number sent) + (its order among the
// added). Pure functions only.

import { activityJsonSchema } from "./activities";
import { blockJsonSchema, questionJsonSchema, toModelFormat } from "./lessonDesign";
import type { Lesson } from "./lessonBlocks";

type ModelLesson = ReturnType<typeof toModelFormat>;
type FlatBlock = ModelLesson["blocks"][number];

export const patchJsonSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    blocks: {
      type: "array",
      items: {
        type: "object",
        properties: { op: { type: "string", enum: ["replace", "insert_after", "remove"] }, at: { type: "integer" }, block: blockJsonSchema },
        required: ["op", "at", "block"],
        additionalProperties: false,
      },
    },
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: { op: { type: "string", enum: ["replace", "add"] }, at: { type: "integer" }, question: questionJsonSchema },
        required: ["op", "at", "question"],
        additionalProperties: false,
      },
    },
    activities: {
      type: "array",
      items: {
        type: "object",
        properties: { op: { type: "string", enum: ["replace", "add"] }, at: { type: "integer" }, activity: activityJsonSchema },
        required: ["op", "at", "activity"],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "blocks", "questions", "activities"],
  additionalProperties: false,
};

type Patch = {
  summary: string;
  blocks: { op: "replace" | "insert_after" | "remove"; at: number; block: FlatBlock }[];
  questions: { op: "replace" | "add"; at: number; question: ModelLesson["questions"][number] }[];
  activities: { op: "replace" | "add"; at: number; activity: unknown }[];
};

/** The lesson as the reviser sees it: the model format, with each item's index as "at". */
export function numbered(lesson: Lesson) {
  const m = toModelFormat(lesson);
  return {
    ...m,
    blocks: m.blocks.map((b, at) => ({ at, ...b })),
    activities: m.activities.map((a, at) => ({ at, ...a })),
    questions: m.questions.map((q, at) => ({ at, ...q })),
  };
}

/**
 * Applies a patch to a lesson. Returns the lesson in the model's format (to be
 * validated by normalizeLesson), or an error if the patch can't apply: an
 * index out of range, two changes to the same item, or no changes at all.
 */
export function applyPatch(lesson: Lesson, raw: unknown): { ok: true; raw: ModelLesson; changes: number; summary: string } | { ok: false; error: string } {
  const p = raw as Patch;
  if (!p || !Array.isArray(p.blocks) || !Array.isArray(p.questions) || !Array.isArray(p.activities)) return { ok: false, error: "malformed patch" };
  const base = toModelFormat(lesson);
  const changes = p.blocks.length + p.questions.length + p.activities.length;
  if (!changes) return { ok: false, error: "the patch changes nothing" };

  // Blocks: each original block is kept, replaced or removed, with any inserts after it.
  const fate = new Map<number, { op: "replace" | "remove"; block: FlatBlock }>();
  const inserts = new Map<number, FlatBlock[]>();
  for (const c of p.blocks) {
    if (!Number.isInteger(c.at)) return { ok: false, error: "a block change has no index" };
    if (c.op === "insert_after") {
      if (c.at < -1 || c.at >= base.blocks.length) return { ok: false, error: `no block ${c.at} to insert after` };
      inserts.set(c.at, [...(inserts.get(c.at) ?? []), c.block]);
    } else {
      if (c.at < 0 || c.at >= base.blocks.length) return { ok: false, error: `no block ${c.at}` };
      if (fate.has(c.at)) return { ok: false, error: `block ${c.at} is changed twice` };
      fate.set(c.at, { op: c.op, block: c.block });
    }
  }
  const blocks: FlatBlock[] = [...(inserts.get(-1) ?? [])];
  base.blocks.forEach((b, i) => {
    const f = fate.get(i);
    if (!f) blocks.push(b);
    else if (f.op === "replace") blocks.push(f.block);
    blocks.push(...(inserts.get(i) ?? []));
  });

  // Questions and activities: replaced in place, or added at the end.
  const replaceOrAdd = <T,>(items: T[], ops: { op: "replace" | "add"; at: number; item: T }[], what: string) => {
    const out = [...items];
    const seen = new Set<number>();
    for (const c of ops) {
      if (c.op === "add") out.push(c.item);
      else if (!Number.isInteger(c.at) || c.at < 0 || c.at >= items.length || seen.has(c.at)) return `bad ${what} change at ${c.at}`;
      else {
        seen.add(c.at);
        out[c.at] = c.item;
      }
    }
    return out;
  };
  const questions = replaceOrAdd(base.questions, p.questions.map((c) => ({ op: c.op, at: c.at, item: c.question })), "question");
  if (typeof questions === "string") return { ok: false, error: questions };
  const activities = replaceOrAdd(base.activities as unknown[], p.activities.map((c) => ({ op: c.op, at: c.at, item: c.activity })), "activity");
  if (typeof activities === "string") return { ok: false, error: activities };

  return { ok: true, raw: { ...base, blocks, questions, activities: activities as ModelLesson["activities"] }, changes, summary: String(p.summary ?? "").slice(0, 300) };
}
