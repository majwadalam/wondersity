// Designing and validating a lesson's block sequence (see lessonBlocks.ts for
// the stored shape). The model fills ONE flat block shape, unused fields left
// empty, as with activities; normalizeLesson() converts it to clean typed
// blocks. A malformed block is dropped; a lesson missing the essentials is
// rejected so the writer retries. lintStructure() finds problems that don't
// make a lesson unusable and hands them to the evaluator.
//
// Pure functions only (no model or database calls), so it can be unit tested.

import { z } from "zod";
import { ACTIVITY_GUIDE, activityJsonSchema, normalizeActivity, type Activity } from "./activities";
import {
  APPROACHES,
  BLOCK_KINDS,
  checkProblem,
  lessonBlocks,
  type Approach,
  type Block,
  type BlockKind,
  type CodeOption,
  type Lesson,
  type Question,
} from "./lessonBlocks";

const APPROACH_KEYS = Object.keys(APPROACHES) as Approach[];

// What each approach does to a lesson's shape. Moves, not sequences: the
// writer still decides the order, but an approach should be recognisable.
const APPROACH_MOVES: Record<Approach, string> = {
  mystery: "the puzzle is posed up front and each section resolves part of it; the last block answers it",
  discovery: "the learner experiments or predicts BEFORE each idea is named; explanation comes after evidence",
  visual: "diagrams, charts and timelines carry the explanation; text is short captions between them",
  scenario: "one realistic situation runs through the whole lesson; every block moves it forward",
  worked_example: "a fully worked problem first, then faded examples, then the learner solves one alone",
  misconception: "the wrong belief is stated and tested first; evidence breaks it; the right model replaces it",
  simulation: "the learner varies a quantity early and often; explanation interprets what they saw",
  case_study: "one real case examined closely: what happened, why, and what it teaches; no generic examples",
  story: "a narrative with characters carries the idea; concepts are named inside the story",
  socratic: "a dialogue of questions does most of the teaching; the learner answers before each reply",
  compare: "two things side by side throughout; the learner classifies and contrasts",
  practice: "minimal explanation, then many short attempts with feedback, each slightly harder",
  reflection: "the learner connects the idea to their own life or work; ends with applying it to a choice of theirs",
};

export const QuestionSchema = z
  .object({
    question: z.string().min(1),
    options: z.array(z.string().min(1)).length(4),
    correctAnswer: z.string(),
    explanation: z.string(),
  })
  .refine((q) => q.options.includes(q.correctAnswer), {
    message: "correctAnswer must exactly match one of the options",
  })
  .refine((q) => new Set(q.options).size === 4, { message: "options must be distinct" });

// ---------- what the model fills in ----------

const str = { type: "string" };
const strings = { type: "array", items: str };

const blockJsonSchema = {
  type: "object",
  properties: {
    kind: { type: "string", enum: [...BLOCK_KINDS] },
    heading: str,
    body: str,
    aside: str,
    ref: { type: "integer" },
    language: str,
    code: str,
    mode: str,
    columns: strings,
    items: {
      type: "array",
      items: {
        type: "object",
        properties: { label: str, text: str, detail: str, correct: { type: "boolean" }, line: { type: "integer" } },
        required: ["label", "text", "detail", "correct", "line"],
        additionalProperties: false,
      },
    },
    hints: strings,
    answers: strings,
    unit: str,
  },
  required: ["kind", "heading", "body", "aside", "ref", "language", "code", "mode", "columns", "items", "hints", "answers", "unit"],
  additionalProperties: false,
};

const questionJsonSchema = {
  type: "object",
  properties: {
    question: str,
    options: strings,
    correctAnswer: str,
    explanation: str,
  },
  required: ["question", "options", "correctAnswer", "explanation"],
  additionalProperties: false,
};

export const lessonJsonSchema = {
  type: "object",
  properties: {
    title: str,
    objective: str,
    approach: { type: "string", enum: APPROACH_KEYS },
    approachReason: str,
    estimatedMinutes: { type: "number" },
    blocks: { type: "array", items: blockJsonSchema },
    activities: { type: "array", items: activityJsonSchema },
    questions: { type: "array", items: questionJsonSchema },
  },
  required: ["title", "objective", "approach", "approachReason", "estimatedMinutes", "blocks", "activities", "questions"],
  additionalProperties: false,
};

export const LESSON_GUIDE = `DESIGN THIS LESSON AROUND ITS TOPIC. There is no fixed template.

1. APPROACH. Pick the ONE teaching approach that best fits THIS module's content and set "approach"
   (and a one-sentence "approachReason"). The approach must visibly shape the lesson: a learner
   should be able to tell which one you chose from the sequence alone. Options and what each does:
${APPROACH_KEYS.map((k) => `   - ${k}: ${APPROACHES[k]}. Shape: ${APPROACH_MOVES[k]}.`).join("\n")}
   Choose from the content, not habit: a procedure suits worked_example or practice; a widely
   misunderstood idea suits misconception; a pivotal event suits case_study or story; a trade-off
   suits compare or scenario; a quantity that changes suits simulation; an abstract argument suits
   socratic. Fit the subject: programming is learned by reading, predicting, tracing and fixing real
   code; history through causes, sources, perspectives and chronology; science through phenomena,
   models and quantities; mathematics through a problem or picture first, reasoning the learner does
   themselves, steps revealed progressively and a fresh problem to solve; strategy through decisions,
   incentives and payoffs.
   Pitch difficulty to where the module sits: early in a course (level 1), concrete examples, more
   scaffolding and hints; in later levels, less scaffolding, harder transfer and combined ideas.
   If the tutor lists approaches used in earlier modules, choose a different one unless it truly fits better.

2. BLOCKS. Write "blocks": 5-12 blocks in teaching order, moving from exploration to understanding
   to application. Use only the kinds this lesson needs; never pad with filler. Every block has all
   fields; leave unused ones empty ("" / [] / 0, and "correct": false, "line": 0 in items).
   Every block includes "answers" and "unit"; leave them [] and "" except in problem blocks.
   - explain: heading, body = the explanation (2-6 sentences; separate paragraphs with a blank line),
     aside = an optional concrete example. Define a term only when the learner needs it.
   - activity: ref = index into "activities" (0-based). Each activity is placed by exactly one block.
   - check: a graded knowledge check placed right after the idea it tests. ref = index into
     "questions"; hints = 1-2 progressive hints that nudge without giving the answer away;
     aside = a different way to explain the idea, shown if the learner gets it wrong.
   - worked: a worked example revealed step by step. heading, body = the problem, items = 2-5 steps
     (label = step title, text = what to do, detail = why), aside = the final answer.
   - code: real, correct code in a small window. language (e.g. "python"), code = 3-15 lines,
     body = the task, mode = one of:
       "predict": what does it output? items = 3-4 options (text = an exact output, correct = true for
         exactly one, detail = feedback on that choice).
       "bug": the code has one bug; items = 3-4 candidate fixes (text), exactly one correct, detail = feedback.
       "trace": step through execution; items = 3-8 steps, line = 1-based line number being run,
         text = what happens, detail = variable state after it, like "i = 2, total = 3".
     aside = the explanation shown at the end; hints = 0-2 hints. Outputs and traces must be exactly
     what the code really does. Use code blocks for programming topics, not for others.
   - compare: heading, body = one-line intro, columns = exactly 2 column names, items = 3-6 rows
     (label = the aspect, text = first column, detail = second column).
   - reflect: an open question the learner answers in their own words. heading, body = the question,
     aside = a strong model answer they compare against afterwards.
   - dialogue: a short Socratic exchange. heading, items = 3-8 turns (label = speaker, text = line).
   - summary: heading, items = 2-4 takeaways (text). Only if it adds something; never just repeat.
   - problem: the learner works something out and TYPES the answer (a number, or a word or short
     phrase with one right form). Use it when the answer can be computed or derived rather than picked:
     calculations, results of a procedure, a predicted value. heading, body = the problem (all the
     information needed), answers = 1-3 accepted forms (e.g. ["0.75", "3/4"]; numbers without units),
     unit = the unit if any (e.g. "cm", or ""), items = 0-3 traps for likely mistakes (text = that
     wrong answer, detail = feedback that names the mistake), hints = 1-2 progressive hints,
     aside = the worked solution. Answers must be exactly right; do the calculation carefully.

3. RULES FOR THE SEQUENCE
   - Don't open or close every lesson the same way. Open with whatever this approach needs: a puzzle,
     a story, a scenario, code to read, a claim to challenge, a problem to solve, a short explanation.
     End where the approach lands: the mystery's answer, the learner's own solution, the last turn of
     the story, a hard final check, a reflection. A summary is optional, not a habit.
   - Length follows the content: a tight idea may need 5 blocks, a rich one 11. Use 2, 3 or 4 checks
     as the idea needs. Only use a block kind if this lesson is better for it.
   - Spread the knowledge checks through the lesson at natural points. At least one check must come
     before the last teaching block; never stack them all at the end. They get harder as the lesson goes:
     early ones apply one idea, later ones combine ideas or transfer them to a new situation.
   - At least 2 hands-on blocks (activity, code, worked, problem, reflect) besides the checks.
   - End with a final check or problem only when the lesson builds to applying everything; otherwise
     end where the approach lands.
   - Never use the same activity type twice, and don't put two blocks of the same kind back to back
     unless the sequence genuinely needs it. No more than 2 explain blocks in a row.

QUESTIONS (the graded checks): 2-4, each placed by exactly one check block. Each is scenario-based
(a short realistic situation that asks the learner to apply the idea, never a definition to recall),
has EXACTLY 4 distinct options, a correctAnswer that is an EXACT copy of one option, and a 1-2 sentence
explanation of why it is right.

ACTIVITIES: 1-4, each placed by one activity block, each a different type that fits the topic.
${ACTIVITY_GUIDE}

ACCURACY. Every factual claim is checked against the web before the lesson is shown, and a wrong
one sends the lesson back. Teach only what is well established:
- State a precise date, number, name or quotation only when you are sure of it. Otherwise round it
  and say so ("about 1.4 million km", "in the 1780s"), or leave it out; the lesson rarely needs it.
- Never invent studies, statistics, quotations or sources. Quote a real person only with words they
  are documented to have said or written; otherwise describe the idea in your own words.
- Where experts disagree, say so and attribute the view ("many historians argue", "one common
  explanation") instead of stating it as settled fact.
- Made-up examples (a shopping list, a fictional student, invented prices) are fine, but make it
  obvious they are illustrations, and keep real figures (historical prices, physical constants)
  real.
- Do the arithmetic before writing a result, and write sums in full ("3.50 + 2.00 = 5.50") so they
  can be checked.

Total time: 5-10 minutes; set estimatedMinutes honestly.`;

// ---------- validation ----------

type Raw = Record<string, unknown>;
const text = (v: unknown, max = 1200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const arr = (v: unknown): Raw[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Raw[]) : []);
const int = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : -1);
const strs = (v: unknown, max = 300) => (Array.isArray(v) ? v.map((s) => text(s, max)).filter(Boolean) : []);

/** Non-check blocks: enough to teach something, few enough for 5-10 minutes. */
export const MIN_BLOCKS = 3;
export const MAX_BLOCKS = 12;
export const MIN_QUESTIONS = 2;
export const MAX_QUESTIONS = 4;
const MAX_ACTIVITIES = 4;
const HANDS_ON: BlockKind[] = ["activity", "code", "worked", "reflect", "problem"];
const TEACHING: BlockKind[] = ["explain", "worked", "dialogue", "compare", "code"];

function choiceOptions(items: ReturnType<typeof normItems>): CodeOption[] | null {
  const options = items.filter((i) => i.text).map((i) => ({ text: i.text, correct: i.correct, feedback: i.detail }));
  if (options.length < 3 || options.length > 4) return null;
  if (options.filter((o) => o.correct).length !== 1) return null;
  if (options.some((o) => !o.feedback) || new Set(options.map((o) => o.text)).size !== options.length) return null;
  return options;
}

const normItems = (v: unknown) =>
  arr(v).map((i) => ({
    label: text(i.label, 120),
    text: text(i.text, 600),
    detail: text(i.detail, 600),
    correct: i.correct === true,
    line: int(i.line),
  }));

/**
 * One raw block → a typed block, or null if unusable. `ref` is returned as
 * written by the model; normalizeLesson() remaps and checks it.
 */
export function normalizeBlock(raw: unknown): Block | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Raw;
  const kind = r.kind as BlockKind;
  if (!BLOCK_KINDS.includes(kind)) return null;
  const heading = text(r.heading, 140);
  const body = text(r.body, 1600);
  const aside = text(r.aside, 900);
  const items = normItems(r.items);

  switch (kind) {
    case "explain":
      if (!body) return null;
      return { kind, heading, body, example: aside };
    case "activity":
      return int(r.ref) >= 0 ? { kind, ref: int(r.ref) } : null;
    case "check":
      if (int(r.ref) < 0) return null;
      return { kind, ref: int(r.ref), hints: strs(r.hints).slice(0, 2), retry: aside };
    case "worked": {
      const steps = items.filter((i) => i.text).map((i) => ({ title: i.label, text: i.text, why: i.detail }));
      if (!body || steps.length < 2 || steps.length > 6) return null;
      return { kind, heading, problem: body, steps, answer: aside };
    }
    case "code": {
      const code = typeof r.code === "string" ? r.code.replace(/\s+$/, "").slice(0, 1500) : "";
      const lines = code.split("\n").length;
      const mode = r.mode as string;
      if (!code.trim() || lines > 25 || !["predict", "bug", "trace"].includes(mode)) return null;
      const base = {
        kind,
        heading,
        prompt: body,
        language: text(r.language, 20).toLowerCase() || "code",
        code,
        explanation: aside,
        hints: strs(r.hints).slice(0, 2),
      } as const;
      if (mode === "trace") {
        const trace = items
          .filter((i) => i.text)
          .map((i) => ({ line: i.line, note: i.text, state: i.detail }));
        if (trace.length < 2 || trace.length > 10 || trace.some((s) => s.line < 1 || s.line > lines)) return null;
        return { ...base, mode, options: [], trace };
      }
      const options = choiceOptions(items);
      if (!options) return null;
      return { ...base, mode: mode as "predict" | "bug", options, trace: [] };
    }
    case "compare": {
      const columns = strs(r.columns, 60);
      const rows = items.filter((i) => i.label && i.text && i.detail).map((i) => ({ label: i.label, a: i.text, b: i.detail }));
      if (columns.length !== 2 || rows.length < 2 || rows.length > 8) return null;
      return { kind, heading, intro: body, columns: [columns[0], columns[1]], rows };
    }
    case "reflect":
      if (!body || !aside) return null;
      return { kind, heading, prompt: body, model: aside };
    case "dialogue": {
      const turns = items.filter((i) => i.label && i.text).map((i) => ({ speaker: i.label, text: i.text }));
      if (turns.length < 2 || turns.length > 10) return null;
      return { kind, heading, turns };
    }
    case "problem": {
      const answers = strs(r.answers, 40).slice(0, 3);
      const solution = aside;
      if (!body || answers.length === 0 || !solution) return null;
      const block = {
        kind,
        heading,
        prompt: body,
        answers,
        unit: text(r.unit, 20),
        traps: [] as { answer: string; feedback: string }[],
        hints: strs(r.hints).slice(0, 2),
        solution,
      };
      // A trap that is actually an accepted answer would contradict itself: drop it.
      block.traps = items
        .filter((i) => i.text && i.detail)
        .map((i) => ({ answer: i.text.slice(0, 40), feedback: i.detail }))
        .filter((t) => !checkProblem(block, t.answer).correct)
        .slice(0, 3);
      return block;
    }
    case "summary": {
      const points = items.map((i) => i.text).filter(Boolean);
      if (points.length < 1 || points.length > 5) return null;
      return { kind, heading, points };
    }
  }
}

export type NormalizeReport = {
  droppedBlocks: number;
  droppedActivities: number;
  droppedQuestions: number;
  /** Valid questions no check block placed; appended so they can still be answered. */
  placedChecks: number;
};

export type NormalizeResult = { ok: true; lesson: Lesson; report: NormalizeReport } | { ok: false; error: string };

/**
 * Validates a raw model lesson and converts it to the stored shape. Blocks,
 * activities and questions are checked one by one; references are remapped
 * after anything is dropped. The lesson is rejected (so the writer retries)
 * only when the essentials are missing.
 */
export function normalizeLesson(raw: unknown): NormalizeResult {
  if (!raw || typeof raw !== "object") return { ok: false, error: "lesson is not an object" };
  const r = raw as Raw;
  const title = text(r.title, 160);
  const objective = text(r.objective, 500);
  if (!title || !objective) return { ok: false, error: "missing title or objective" };
  const approach = APPROACH_KEYS.includes(r.approach as Approach) ? (r.approach as Approach) : undefined;
  if (!approach) return { ok: false, error: `unknown approach "${String(r.approach)}"` };
  const minutes = typeof r.estimatedMinutes === "number" && Number.isFinite(r.estimatedMinutes) ? r.estimatedMinutes : 8;

  // Questions: keep the valid ones, remembering where each came from.
  const rawQuestions = Array.isArray(r.questions) ? r.questions : [];
  const questionMap = new Map<number, number>();
  const questions: Question[] = [];
  rawQuestions.forEach((q, i) => {
    const parsed = QuestionSchema.safeParse(q);
    if (parsed.success && questions.length < MAX_QUESTIONS) {
      questionMap.set(i, questions.length);
      questions.push(parsed.data);
    }
  });
  if (questions.length < MIN_QUESTIONS) {
    return { ok: false, error: `only ${questions.length} valid questions (need ${MIN_QUESTIONS})` };
  }

  // Activities: normalize each; a block's ref follows its activity.
  const rawActivities = Array.isArray(r.activities) ? r.activities : [];
  const activityMap = new Map<number, Activity>();
  rawActivities.forEach((a, i) => {
    const clean = normalizeActivity(a, 0);
    if (clean) activityMap.set(i, { ...clean, afterConcept: 0 });
  });

  const rawBlocks = Array.isArray(r.blocks) ? r.blocks : [];
  const blocks: Block[] = [];
  const activities: Activity[] = [];
  const usedActivities = new Set<number>();
  const usedTypes = new Set<string>();
  const placedQuestions = new Set<number>();
  for (const rb of rawBlocks) {
    const b = normalizeBlock(rb);
    if (!b) continue;
    if (b.kind === "activity") {
      const a = activityMap.get(b.ref);
      if (!a || usedActivities.has(b.ref) || usedTypes.has(a.type) || activities.length >= MAX_ACTIVITIES) continue;
      usedActivities.add(b.ref);
      usedTypes.add(a.type);
      blocks.push({ kind: "activity", ref: activities.length });
      activities.push(a);
    } else if (b.kind === "check") {
      const q = questionMap.get(b.ref);
      if (q === undefined || placedQuestions.has(q)) continue;
      placedQuestions.add(q);
      blocks.push({ ...b, ref: q });
    } else {
      blocks.push(b);
    }
  }

  // A valid question no block placed still has to be answerable (grading
  // needs every question). Put it before a closing summary, else at the end.
  let placedChecks = 0;
  for (let q = 0; q < questions.length; q++) {
    if (placedQuestions.has(q)) continue;
    const at = blocks.length > 0 && blocks[blocks.length - 1].kind === "summary" ? blocks.length - 1 : blocks.length;
    blocks.splice(at, 0, { kind: "check", ref: q, hints: [], retry: "" });
    placedChecks++;
  }

  if (blocks.length > MAX_BLOCKS + MAX_QUESTIONS) blocks.length = MAX_BLOCKS + MAX_QUESTIONS;
  const nonCheck = blocks.filter((b) => b.kind !== "check");
  if (nonCheck.length < MIN_BLOCKS) return { ok: false, error: `only ${nonCheck.length} usable teaching blocks` };
  if (!nonCheck.some((b) => TEACHING.includes(b.kind))) return { ok: false, error: "no block teaches the idea" };
  if (nonCheck.filter((b) => HANDS_ON.includes(b.kind)).length < 2) {
    return { ok: false, error: "fewer than 2 hands-on blocks (activity, code, worked, reflect)" };
  }
  // Grading needs every question reachable: make sure none got cut off.
  if (blocks.filter((b) => b.kind === "check").length !== questions.length) {
    return { ok: false, error: "too many blocks to fit every check" };
  }

  return {
    ok: true,
    lesson: {
      version: 2,
      title,
      objective,
      estimatedMinutes: Math.min(15, Math.max(3, Math.round(minutes))),
      approach,
      approachReason: text(r.approachReason, 300),
      blocks,
      activities,
      questions,
    },
    report: {
      droppedBlocks: rawBlocks.length - (blocks.length - placedChecks),
      droppedActivities: rawActivities.length - activities.length,
      droppedQuestions: rawQuestions.length - questions.length,
      placedChecks,
    },
  };
}

/**
 * Structural issues code can see but that don't make a lesson unusable. They
 * are handed to the evaluator, which lowers its score for them, so a revision
 * fixes them.
 */
export function lintStructure(lesson: Lesson): string[] {
  const blocks = lessonBlocks(lesson);
  const issues: string[] = [];
  const firstCheck = blocks.findIndex((b) => b.kind === "check");
  const lastTeaching = blocks.reduce((at, b, i) => (TEACHING.includes(b.kind) || b.kind === "activity" ? i : at), -1);
  if (firstCheck > lastTeaching) {
    issues.push("All knowledge checks are stacked at the end; place checks right after the ideas they test.");
  }
  for (let i = 2; i < blocks.length; i++) {
    if (blocks[i].kind === "explain" && blocks[i - 1].kind === "explain" && blocks[i - 2].kind === "explain") {
      issues.push("Three explain blocks in a row: a wall of text. Break it up with something the learner does.");
      break;
    }
  }
  for (let i = 1; i < blocks.length; i++) {
    const a = blocks[i - 1];
    const b = blocks[i];
    if (a.kind === b.kind && a.kind !== "explain" && a.kind !== "check") {
      issues.push(`Two "${a.kind}" blocks back to back; vary the interaction.`);
      break;
    }
  }
  // The same interaction three times feels like a drill, not a lesson.
  const signature = (b: Block) =>
    b.kind === "code" ? `code (${b.mode})` : b.kind === "activity" ? `${lesson.activities?.[b.ref]?.type} activity` : b.kind;
  const counts = new Map<string, number>();
  for (const b of blocks) if (b.kind !== "explain" && b.kind !== "check") counts.set(signature(b), (counts.get(signature(b)) ?? 0) + 1);
  // Several problems in a row is what practice looks like; other interactions repeat sooner.
  for (const [sig, n] of counts) if (n >= (sig === "problem" ? 4 : 3)) issues.push(`The same interaction (${sig}) is used ${n} times; vary how the learner engages.`);
  const first = blocks[0];
  const second = blocks[1];
  if (
    first?.kind === "activity" &&
    lesson.activities?.[first.ref]?.type === "predict" &&
    second?.kind === "explain" &&
    firstCheck > lastTeaching
  ) {
    issues.push("Follows the old fixed template (predict, explain, activities, quiz at the end). Design for this topic.");
  }
  if ((lesson.estimatedMinutes ?? 0) > 12) issues.push("Longer than a 5-10 minute module.");
  return issues;
}


// ---------- back to the model's format ----------

const flatItem = (o: Partial<{ label: string; text: string; detail: string; correct: boolean; line: number }>) => ({
  label: "",
  text: "",
  detail: "",
  correct: false,
  line: 0,
  ...o,
});

const emptySlider = { label: "", min: 0, max: 0, step: 0, unit: "", initial: 0 };
const emptyAxis = { xLabel: "", yLabel: "", xMin: 0, xMax: 0, yMin: 0, yMax: 0 };
const actItem = (o: Partial<{ text: string; group: string; detail: string; value: number }>) => ({
  text: "",
  group: "",
  detail: "",
  value: 0,
  ...o,
});

/** A stored activity in the flat shape the model writes. */
export function flatActivity(a: Activity) {
  const base = {
    type: a.type,
    title: a.title,
    prompt: a.prompt,
    reveal: a.reveal,
    unit: "",
    script: "",
    options: [] as { text: string; correct: boolean; feedback: string }[],
    buckets: [] as string[],
    items: [] as ReturnType<typeof actItem>[],
    edges: [] as { from: number; to: number; label: string }[],
    slider: emptySlider,
    bands: [] as { upTo: number; title: string; detail: string }[],
    axis: emptyAxis,
  };
  switch (a.type) {
    case "predict":
    case "scenario":
      return { ...base, options: a.options };
    case "sort":
      return { ...base, buckets: a.buckets, items: a.items.map((i) => actItem({ text: i.text, group: i.bucket })) };
    case "order":
      return { ...base, items: a.steps.map((text) => actItem({ text })) };
    case "story":
      return { ...base, items: a.beats.map((b) => actItem({ text: b.text, group: b.label })) };
    case "timeline":
      return { ...base, items: a.events.map((e) => actItem({ text: e.marker, group: e.title, detail: e.detail })) };
    case "chart":
      return { ...base, unit: a.unit, items: a.bars.map((b) => actItem({ text: b.label, value: b.value, detail: b.note })) };
    case "simulation":
      return { ...base, slider: a.slider, bands: a.bands };
    case "diagram":
      return { ...base, items: a.nodes.map((n) => actItem({ text: n.label, detail: n.detail })), edges: a.edges };
    case "listen":
      return { ...base, script: a.script };
    case "sound":
      return { ...base, items: a.clips.map((c) => actItem({ text: c.label, group: c.notes.join(" "), detail: c.detail })) };
    case "graph":
      return { ...base, script: a.expression, slider: a.slider, bands: a.bands, axis: a.axis };
  }
}

/** A stored block in the flat shape the model writes. */
export function flatBlock(b: Block) {
  const base = {
    kind: b.kind,
    heading: "",
    body: "",
    aside: "",
    ref: 0,
    language: "",
    code: "",
    mode: "",
    columns: [] as string[],
    items: [] as ReturnType<typeof flatItem>[],
    hints: [] as string[],
    answers: [] as string[],
    unit: "",
  };
  switch (b.kind) {
    case "explain":
      return { ...base, heading: b.heading, body: b.body, aside: b.example };
    case "activity":
      return { ...base, ref: b.ref };
    case "check":
      return { ...base, ref: b.ref, hints: b.hints, aside: b.retry };
    case "worked":
      return {
        ...base,
        heading: b.heading,
        body: b.problem,
        aside: b.answer,
        items: b.steps.map((s) => flatItem({ label: s.title, text: s.text, detail: s.why })),
      };
    case "code":
      return {
        ...base,
        heading: b.heading,
        body: b.prompt,
        language: b.language,
        code: b.code,
        mode: b.mode,
        aside: b.explanation,
        hints: b.hints,
        items:
          b.mode === "trace"
            ? b.trace.map((s) => flatItem({ line: s.line, text: s.note, detail: s.state }))
            : b.options.map((o) => flatItem({ text: o.text, correct: o.correct, detail: o.feedback })),
      };
    case "compare":
      return { ...base, heading: b.heading, body: b.intro, columns: [...b.columns], items: b.rows.map((r) => flatItem({ label: r.label, text: r.a, detail: r.b })) };
    case "reflect":
      return { ...base, heading: b.heading, body: b.prompt, aside: b.model };
    case "dialogue":
      return { ...base, heading: b.heading, items: b.turns.map((t) => flatItem({ label: t.speaker, text: t.text })) };
    case "problem":
      return {
        ...base,
        heading: b.heading,
        body: b.prompt,
        aside: b.solution,
        answers: b.answers,
        unit: b.unit,
        hints: b.hints,
        items: b.traps.map((t) => flatItem({ text: t.answer, detail: t.feedback })),
      };
    case "summary":
      return { ...base, heading: b.heading, items: b.points.map((text) => flatItem({ text })) };
  }
}

/**
 * A stored lesson in exactly the shape the model writes, so a reviser edits
 * the format it returns instead of translating (and losing) activities.
 */
export function toModelFormat(lesson: Lesson) {
  return {
    title: lesson.title,
    objective: lesson.objective,
    approach: lesson.approach ?? "",
    approachReason: lesson.approachReason ?? "",
    estimatedMinutes: lesson.estimatedMinutes,
    blocks: lessonBlocks(lesson).map(flatBlock),
    activities: (lesson.activities ?? []).map(flatActivity),
    questions: lesson.questions,
  };
}
