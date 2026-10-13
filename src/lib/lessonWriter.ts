// The quality gate. Writes one module lesson, checks its arithmetic in code
// and its factual claims against the web, has a model review it, revises once (or rewrites from scratch if
// the draft is far off) when it falls short, and returns the best *evaluated*
// version with no arithmetic or factual errors. This is deterministic code: the tutor agent decides
// what to write and why, but cannot skip these checks.

import { createHash } from "node:crypto";
import { applyPatch, numbered, patchJsonSchema } from "./lessonPatch";
import { blindCheck } from "./blindCheck";
import { z } from "zod";
import type { Lesson } from "./lessonBlocks";
import { LESSON_GUIDE, lessonJsonSchema, lintLesson, normalizeLesson, toModelFormat, type NormalizeReport } from "./lessonDesign";
import { checkFacts } from "./factCheck";
import { verifyEnabled, verifyFacts, type VerifyReport } from "./factVerify";
import { withStep, callStructured, lessonModel, reviewModel, type Deadline } from "./model";

export type { Lesson } from "./lessonBlocks";

const EvaluationSchema = z.object({
  score: z.number().min(0).max(10),
  approved: z.boolean(),
  problems: z.array(z.string()),
  suggestions: z.array(z.string()),
});

type Evaluation = z.infer<typeof EvaluationSchema>;

export type TraceEntry = { step: string; [key: string]: unknown };

/** What the tutor agent asks the writer for. */
export type LessonBrief = {
  topic: string;
  courseTitle: string;
  moduleIndex: number;
  moduleCount: number;
  module: { title: string; goal: string; description?: string };
  /** Where the module sits in the course's levels; absent for courses planned before levels. */
  level?: { number: number; count: number; title: string; objective: string; moduleNumber: number; moduleCount: number; outcome?: string };
  /** Titles of the modules before this one, for continuity. */
  previousModules: string[];
  /** Teaching approaches earlier modules used, so a course doesn't repeat one shape. */
  previousApproaches?: string[];
  /** Earlier modules' block sequences (lessonShape joined with " > "), most recent last. */
  previousShapes?: string[];
  /** The agent's instructions, e.g. what to recap given past mistakes. */
  focus: string;
  /** Tailored courses: who the lesson is for (goal, purpose, context, starting point; lib/intake.ts). */
  learner?: string;
  /** Tailored courses: the things the learner asked to cover that this module covers. */
  covers?: string[];
  /** Tailored courses: passages from the learner's own materials, framed as data. */
  materials?: string;
};

const evaluationJsonSchema = {
  type: "object",
  properties: {
    score: { type: "number", minimum: 0, maximum: 10 },
    approved: { type: "boolean" },
    problems: { type: "array", items: { type: "string" } },
    suggestions: { type: "array", items: { type: "string" } },
  },
  required: ["score", "approved", "problems", "suggestions"],
  additionalProperties: false,
};

// Shared by generate and revise so a first draft gets the same rules.
const LESSON_REQUIREMENTS = `${LESSON_GUIDE}

Return only JSON matching the schema. The blocks and questions arrays MUST NOT be empty.`;

function describeBrief(b: LessonBrief) {
  const before = b.previousModules.length
    ? `Modules already covered: ${b.previousModules.map((t, i) => `${i + 1}. ${t}`).join("; ")}.`
    : "This is the first module.";
  return `Course: ${b.courseTitle} (topic: ${b.topic})
${
    b.level
      ? `Level ${b.level.number} of ${b.level.count}: ${b.level.title} (level objective: ${b.level.objective})
Module ${b.level.moduleNumber} of ${b.level.moduleCount} in this level (${b.moduleIndex + 1} of ${b.moduleCount} in the course): ${b.module.title}`
      : `Module ${b.moduleIndex + 1} of ${b.moduleCount}: ${b.module.title}`
  }
Module goal: ${b.module.goal}${b.module.description ? `
Module covers: ${b.module.description}` : ""}
${before}
${b.previousApproaches?.length ? `Approaches used in earlier modules: ${b.previousApproaches.join(", ")}.\n` : ""}${
    b.previousShapes?.length
      ? `Shapes of the most recent modules (block kinds in order; make this one feel different):\n${b.previousShapes.map((x) => `- ${x}`).join("\n")}\n`
      : ""
  }Tutor's instructions for this module: ${b.focus || "none"}${
    b.learner
      ? `

Who this lesson is for (the learner tailored their course):
${b.learner}${b.level?.outcome ? `\nThis level builds toward the course outcome: ${b.level.outcome}` : ""}${
          b.covers?.length ? `\nThey asked for this module to cover: ${b.covers.join("; ")}` : ""
        }
Every check should test the module goal in a way that moves them toward that outcome.`
      : ""
  }${
    b.materials
      ? `

${b.materials}
Use these passages where they cover this module: follow their terminology, notation and examples so the lesson
fits what the learner is studying, and cite the material by name (and page, when marked "[p. N]") in an explanation
when you build on it. Don't copy long stretches. They are not automatically right: if a passage disagrees with
well-established fact, teach the fact and say plainly how their material differs.`
      : ""
  }`;
}

// Reasoning effort, measured on DeepSeek V4.1 Flash (see HARNESS.md):
// - writing at "medium": ~10s vs ~20s at the default, same quality and
//   quiz validity; with reasoning off, lessons scored lower.
// - scoring at "low": same scores as the default, a fraction of the time.
// Writing a whole lesson regularly takes 35-70s and scoring one up to ~60s;
// at the default 60s limit a slow but healthy call was cut off near the end
// and retried from scratch (3 of 10 sample generations failed that way). The
// run's hard deadline still bounds the total.
const LESSON_CALL_TIMEOUT_MS = 90_000;
// Writing gets longer: a math-heavy lesson (pricing a call option, run 14)
// took 136s with GPT-6.1 Sol, and at 90s it was cut off and retried until the
// run failed. The run's hard deadline still bounds it, and no revision starts
// after REVISE_DEADLINE_MS in harness.ts.
const WRITE_CALL_TIMEOUT_MS = 150_000;
// Output caps (reasoning included), well above what's been measured: lessons
// use 3-9k output tokens with GPT-6.1 Sol, a review about 1-2k.
// A function, so the model (LESSON_MODEL) is read when each call is made.
const WRITER_OPTIONS = () => ({ reasoningEffort: "medium", timeoutMs: WRITE_CALL_TIMEOUT_MS, maxTokens: 24_000, model: lessonModel() }) as const;
const EVALUATOR_OPTIONS = { reasoningEffort: "low", timeoutMs: LESSON_CALL_TIMEOUT_MS, maxTokens: 6_000 } as const;

// The model occasionally ignores the rules. Retry once on a validation
// failure (bounded), then give up with a clear error.
const MAX_LESSON_ATTEMPTS = 2;

type Written = { lesson: Lesson; report: Record<string, unknown> };

/** What the trace records about a written lesson: its shape and what validation dropped. */
const describeWritten = (lesson: Lesson, r: NormalizeReport) => ({
  approach: lesson.approach,
  blocks: lesson.blocks?.map((b) => b.kind).join(" > "),
  ...r,
});

async function requestValidLesson(request: () => Promise<unknown>): Promise<Written> {
  let lastError = "";
  for (let attempt = 1; attempt <= MAX_LESSON_ATTEMPTS; attempt++) {
    const result = normalizeLesson(await request());
    if (result.ok) return { lesson: result.lesson, report: describeWritten(result.lesson, result.report) };
    lastError = result.error;
  }
  throw new Error(`Model did not return a valid lesson after ${MAX_LESSON_ATTEMPTS} attempts: ${lastError}`);
}

function generateLesson(brief: LessonBrief, deadline: Deadline, avoid?: string): Promise<Written> {
  return requestValidLesson(() =>
    callStructured(
      `You are a great teacher writing one module of an interactive course, in the spirit of
Brilliant: the learner DOES things, not just reads. Design the lesson the way a great teacher of
THIS subject would teach THIS idea: choose the approach first, then the sequence. Write it in plain,
warm, short sentences a newcomer can follow on a phone. Build on earlier modules without repeating
them, and don't teach later modules' material.

${LESSON_REQUIREMENTS}`,
      `${describeBrief(brief)}\n\n${
        avoid ? `An earlier draft of this lesson was rejected. Start over with a fresh design and avoid its problems:\n${avoid}\n\n` : ""
      }Write this module's lesson.`,
      lessonJsonSchema,
      deadline,
      WRITER_OPTIONS()
    )
  );
}

export async function evaluateLesson(brief: LessonBrief, lesson: Lesson, deadline: Deadline): Promise<Evaluation> {
  // Problems code can detect are handed to the evaluator as facts.
  const issues = [...checkFacts(lesson).map((e) => `Arithmetic error (computed in code): ${e}`), ...lintLesson(lesson, brief.previousShapes)];
  const result = await callStructured(
    `You are a strict educational quality evaluator. Evaluate the lesson on a 0-10 scale.
Use the FULL range: 3 = poor, 5 = mediocre, 7 = good, 8-9 = excellent, 10 = perfect.
The lesson is an ordered list of blocks; "activity" and "check" blocks point (by ref) into the
activities and questions arrays. Evaluate for:
- accuracy of every fact and number; for code, the stated output, bug fix and trace must be exactly
  what the code really does; precise claims stated with more certainty than the evidence allows,
  invented quotations or statistics, and disputed interpretations stated as settled fact all count
  as accuracy problems
- fit: does the chosen approach suit this subject and idea? Would a great teacher of it teach it this way?
- structure: a coherent path from exploration to understanding to application, not a generic
  template; knowledge checks right after the ideas they test, getting harder; no filler
- interactivity: hands-on blocks that make the learner think, varied, never decorative
- checks: scenario-based questions set in a new situation, that need the idea to answer: wrong
  options that are plausible because each matches a real misconception, no cue that gives the
  answer away (the right option longest or most careful, the question's words only in it, absolute
  words only in wrong ones), difficulty that rises through the lesson; hints that help without
  giving the answer away, and an alternative explanation that is genuinely different. A check a
  learner could pass without the lesson is a serious problem.
- readability: could a newcomer follow it on a phone, reading once? One idea per step, short plain
  sentences, a concrete case before each new term, few new terms, each step connected to the last,
  claims stated plainly rather than hedged in every sentence, short options and table cells. Correct
  but dense, abstract or heavily qualified prose is a serious problem: a lesson that is hard to follow
  can't score above 7, however good its content.
- variety: does the sequence follow from the approach, or is it the default loop (explain a bit, do
  an activity, answer a check, repeated)? If the brief lists earlier modules' shapes, a lesson that
  opens, closes or moves like them can't score above 7.
- fit to the module goal, and time (5-10 min).
- when the brief says who the lesson is for: fit to that learner (pitched at their starting point,
  examples from their context where it fits, the things they asked to cover actually covered, their
  materials' terms used and not contradicted without saying so). A lesson that ignores the brief
  can't score above 7.
Code-detected issues (structure, variety, readability) are listed with the lesson; each one should
lower the score.
Be critical, but score honestly. Return only JSON.`,
    `${describeBrief(brief)}\n\nLesson:\n${JSON.stringify(lesson, null, 2)}\n\nCode-detected issues:${
      issues.length ? issues.map((i) => `\n- ${i}`).join("") : " none"
    }`,
    evaluationJsonSchema,
    deadline,
    { ...EVALUATOR_OPTIONS, model: reviewModel() }
  );
  return EvaluationSchema.parse(result);
}

/**
 * The reviser's feedback. Errors verified in code come first, one per line:
 * in a long undifferentiated list, the item that matters gets buried.
 */
function feedbackFor(evaluation: Evaluation, factErrors: string[], uncertain: string[] = [], giveaways: string[] = [], codeIssues: string[] = []) {
  // Problems found in code (giveaway cues, structure), listed for the reviser so it doesn't
  // reintroduce them (run 16: a revision added new hint cues the reviewer hadn't named).
  const found = codeIssues.length ? `Problems found in code (fix each one, and don't introduce new ones):\n${codeIssues.map((e) => `- ${e}`).join("\n")}\n\n` : "";
  const blind = giveaways.length
    ? `Questions whose options give the answer away (a reader shown only the options picked the right one; rewrite their options):\n${giveaways.map((e) => `- ${e}`).join("\n")}\n\n`
    : "";
  const verified = factErrors.length
    ? `Verified errors (computed in code or contradicted by a reliable web source; fix every one, or remove the claim):\n${factErrors.map((e) => `- ${e}`).join("\n")}\n\n`
    : "";
  const unconfirmed = uncertain.length
    ? `Claims a web search couldn't confirm (state each more carefully with one plain qualifier, e.g. "about", "historians estimate", or remove it if it isn't needed; don't hedge the sentences around it):\n${uncertain.map((e) => `- ${e}`).join("\n")}\n\n`
    : "";
  return `${verified}${blind}${found}${unconfirmed}Reviewer's feedback:\n${JSON.stringify(evaluation, null, 2)}`;
}

function reviseLesson(
  brief: LessonBrief,
  lesson: Lesson,
  feedback: string,
  deadline: Deadline
): Promise<Written> {
  return requestValidLesson(() =>
    callStructured(
      `You are a great teacher and editor. Revise the lesson to fix the evaluator's feedback.
It is shown in the same format you write: keep what works, fix what the feedback names, and
return the whole lesson.

${LESSON_REQUIREMENTS}`,
      `${describeBrief(brief)}\n\nLesson:\n${JSON.stringify(toModelFormat(lesson), null, 2)}\n\n${feedback}`,
      lessonJsonSchema,
      deadline,
      WRITER_OPTIONS()
    )
  );
}

/**
 * A targeted revision (lib/lessonPatch.ts): the reviser returns only the
 * changes the feedback asks for, and code applies them. One retry if the patch
 * doesn't apply or the result isn't a valid lesson; then the caller falls back
 * to a full revision.
 */
export async function patchLesson(brief: LessonBrief, lesson: Lesson, feedback: string, deadline: Deadline): Promise<Written> {
  let lastError = "";
  for (let attempt = 1; attempt <= MAX_LESSON_ATTEMPTS; attempt++) {
    const data = await callStructured(
      `You are a great teacher and editor revising a lesson. Fix every problem the feedback names
by changing ONLY what needs to change; everything you don't mention is kept exactly as it is.
The lesson is shown in the format you write, with each block, activity and question numbered by "at".
Return a patch:
- blocks: {op, at, block}. "replace" puts a new block in place of block at; "insert_after" adds a block
  after block at (-1 = at the start); "remove" deletes block at (its "block" is ignored; fill it with
  empty fields). Several inserts after the same block keep the order you give.
- questions and activities: "replace" one at its index, or "add" a new one at the end (its "at" is
  ignored). A new one's index, for a block's "ref", is the number of existing ones plus its order among
  the ones you add (the first added is the existing count). To drop a check, replace its question
  instead of removing it.
- summary: one sentence on what you changed.
Every block, question and activity you write must meet the lesson requirements below in full.

${LESSON_REQUIREMENTS}`,
      `${describeBrief(brief)}\n\nLesson:\n${JSON.stringify(numbered(lesson), null, 2)}\n\n${feedback}`,
      patchJsonSchema,
      deadline,
      WRITER_OPTIONS()
    );
    const applied = applyPatch(lesson, data);
    if (!applied.ok) {
      lastError = applied.error;
      continue;
    }
    const result = normalizeLesson(applied.raw);
    if (result.ok) return { lesson: result.lesson, report: { ...describeWritten(result.lesson, result.report), patch: applied.summary, changes: applied.changes } };
    lastError = result.error;
  }
  throw new Error(`The patch didn't give a valid lesson after ${MAX_LESSON_ATTEMPTS} attempts: ${lastError}`);
}

// A lesson must score at least this to count as passing evaluation.
export const PASS_SCORE = 8;

/**
 * A fingerprint of how lessons are written and checked: the guide and the
 * writer and reviewer models. A cached lesson 1 carries it, so changing any
 * of them retires lessons written the old way.
 */
export const lessonVersion = () =>
  createHash("sha256").update(`${LESSON_GUIDE}\n${lessonModel()}\n${reviewModel()}`).digest("hex").slice(0, 12);
// Bounded iteration: at most this many evaluations (so at most one revision).
const MAX_ITERATIONS = 2;
// A draft scored below this is rewritten from scratch instead of patched: its
// errors sit in the reviser's context and tend to carry over.
const REWRITE_BELOW = 5;

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

type Version = { lesson: Lesson; score: number; factErrors: string[]; sources: VerifyReport["sources"] };

/**
 * Checks the lesson's claims online. Returns null when checking is off or the
 * claims couldn't be listed (the trace says which); the lesson is then judged
 * on the other checks alone.
 */
async function checkOnline(brief: LessonBrief, lesson: Lesson, deadline: Deadline, trace: TraceEntry[], iteration: number) {
  if (!verifyEnabled()) return null;
  const t = Date.now();
  try {
    const report = await withStep("verify", () => verifyFacts(brief.topic, lesson, deadline));
    trace.push({
      step: "lesson.verify",
      iteration,
      ms: Date.now() - t,
      claims: report.checks.length,
      supported: report.checks.filter((c) => c.verdict === "supported").length,
      contradicted: report.errors,
      unclear: report.uncertain.length,
      downgraded: report.checks.filter((c) => c.downgraded).map((c) => `${c.claim}: ${c.downgraded}`),
    });
    return report;
  } catch (e) {
    trace.push({ step: "lesson.verify_failed", iteration, ms: Date.now() - t, error: errorMessage(e) });
    return null;
  }
}

/**
 * The blind test (lib/blindCheck.ts): questions whose options alone give the
 * answer away. Returns [] when it can't run; the lesson is then judged on the
 * other checks alone.
 */
async function checkBlind(brief: LessonBrief, lesson: Lesson, deadline: Deadline, trace: TraceEntry[], iteration: number) {
  const t = Date.now();
  try {
    const giveaways = await withStep("blind", () => blindCheck(brief.topic, lesson.questions, deadline));
    trace.push({ step: "lesson.blind", iteration, ms: Date.now() - t, questions: lesson.questions.length, giveaways });
    return giveaways;
  } catch (e) {
    trace.push({ step: "lesson.blind_failed", iteration, ms: Date.now() - t, error: errorMessage(e) });
    return [];
  }
}

/**
 * A question the blind test answered from its options alone can't count as
 * excellent, whatever the reviewer thought: the score is held just under the
 * pass mark so the lesson is revised.
 */
export const GIVEAWAY_CAP = PASS_SCORE - 0.5;

/** A version with no arithmetic errors beats any version with them; then the higher score wins. */
function better(a: Version, b: Version | null) {
  if (!b) return true;
  const aClean = a.factErrors.length === 0;
  const bClean = b.factErrors.length === 0;
  return aClean !== bClean ? aClean : a.score > b.score;
}

/**
 * Writes a lesson for `brief`. Only evaluated versions can be returned; a
 * revision that fails or can't be evaluated is discarded. A version whose
 * arithmetic is wrong is never returned: if no version is free of such errors,
 * this throws. No revision starts after `reviseDeadline`, and no model call
 * runs past `deadline` (epoch ms).
 */
export async function writeLesson(
  brief: LessonBrief,
  { reviseDeadline, deadline, trace }: { reviseDeadline: number; deadline: Deadline; trace: TraceEntry[] }
): Promise<{ lesson: Lesson; score: number; passed: boolean }> {
  let t = Date.now();
  const first = await withStep("write", () => generateLesson(brief, deadline));
  let candidate = first.lesson;
  trace.push({
    step: "lesson.generate",
    module: brief.moduleIndex + 1,
    ms: Date.now() - t,
    ...first.report,
  });

  let best: Version | null = null;

  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
    t = Date.now();
    // The review, the online check and the blind test are independent, so they run together.
    const [reviewed, online, giveaways] = await Promise.all([
      withStep("review", () => evaluateLesson(brief, candidate, deadline)).then(
        (evaluation) => ({ evaluation }),
        (error: unknown) => ({ error })
      ),
      checkOnline(brief, candidate, deadline, trace, iteration),
      checkBlind(brief, candidate, deadline, trace, iteration),
    ]);
    if ("error" in reviewed) {
      // Nothing evaluated yet means nothing we're allowed to show.
      if (!best) throw reviewed.error;
      trace.push({ step: "lesson.evaluate_failed", iteration, error: errorMessage(reviewed.error) });
      break;
    }
    const evaluation = giveaways.length
      ? { ...reviewed.evaluation, score: Math.min(reviewed.evaluation.score, GIVEAWAY_CAP), problems: [...giveaways, ...reviewed.evaluation.problems] }
      : reviewed.evaluation;
    const factErrors = [...checkFacts(candidate), ...(online?.errors ?? [])];

    trace.push({
      step: "lesson.evaluate",
      iteration,
      score: evaluation.score,
      ...(giveaways.length ? { reviewerScore: reviewed.evaluation.score } : {}),
      ms: Date.now() - t,
      problems: evaluation.problems,
      factErrors,
      structureIssues: lintLesson(candidate, brief.previousShapes),
    });
    const version = { lesson: candidate, score: evaluation.score, factErrors, sources: online?.sources ?? [] };
    if (better(version, best)) best = version;

    const passes = evaluation.score >= PASS_SCORE && factErrors.length === 0;
    if (passes || iteration === MAX_ITERATIONS) break;
    if (Date.now() > reviseDeadline) {
      trace.push({ step: "lesson.revise_skipped", iteration, reason: "time budget" });
      break;
    }

    t = Date.now();
    const feedback = feedbackFor(evaluation, factErrors, online?.uncertain, giveaways, lintLesson(candidate, brief.previousShapes));
    const rewrite = evaluation.score < REWRITE_BELOW;
    try {
      // A weak draft is rewritten; otherwise only what the feedback names is changed (a patch),
      // falling back to a full revision if the patch doesn't give a valid lesson.
      const revised = rewrite
        ? await withStep("rewrite", () => generateLesson(brief, deadline, feedback))
        : await withStep("revise", () => patchLesson(brief, candidate, feedback, deadline)).catch(async (e: unknown) => {
            trace.push({ step: "lesson.patch_failed", iteration, error: errorMessage(e) });
            return withStep("revise", () => reviseLesson(brief, candidate, feedback, deadline));
          });
      candidate = revised.lesson;
      trace.push({
        step: rewrite ? "lesson.rewrite" : "lesson.revise",
        iteration,
        ms: Date.now() - t,
        ...revised.report,
      });
    } catch (e) {
      trace.push({ step: "lesson.revise_failed", iteration, error: errorMessage(e) });
      break;
    }
  }

  // The loop always evaluates at least once or throws, so best is set.
  const { lesson, score, factErrors, sources } = best!;
  if (factErrors.length) {
    trace.push({ step: "lesson.rejected", reason: "factual errors", factErrors });
    throw new Error(`Every version of the lesson had factual errors: ${factErrors.join(" ")}`);
  }
  const passed = score >= PASS_SCORE;
  trace.push({ step: "lesson.select", score, passed, sources: sources.length });
  return { lesson: sources.length ? { ...lesson, sources } : lesson, score, passed };
}
