// Designing and validating a lesson's block sequence (see lessonBlocks.ts for
// the stored shape). The model fills ONE flat block shape, unused fields left
// empty, as with activities; normalizeLesson() converts it to clean typed
// blocks. A malformed block is dropped; a lesson missing the essentials is
// rejected so the writer retries. lintStructure() finds problems that don't
// make a lesson unusable and hands them to the evaluator.
//
// Pure functions only (no model or database calls), so it can be unit tested.

import { z } from "zod";
import { cleanEmbeds } from "./embeds";
import { lintQuestions, shuffleOptions } from "./questionCheck";
import { lintReadability } from "./readability";
import { ACTIVITY_GUIDE, activityJsonSchema, normalizeActivity, type Activity } from "./activities";
import {
  APPROACHES,
  BLOCK_KINDS,
  EXPLAIN_LAYOUTS,
  checkProblem,
  lessonBlocks,
  modelAnswerText,
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

export const blockJsonSchema = {
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

export const questionJsonSchema = {
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

WRITING. Learners read this on a phone, one step per screen. Write the way a good teacher talks to one
person, not the way a textbook or a report reads. Every field the learner reads follows these rules:
- One idea per step. An explain body is 2-4 short sentences, about 40-80 words. If it needs more, it
  is two steps, or something the learner should do instead of read.
- Short sentences: most under 15 words, none over 30. One clause each where you can. No chains of
  semicolons, dashes or parentheses.
- Plain words. Show the idea with a concrete case first, then name it: "The model got a shortcut it
  won't have in real use. That's called **data leakage**." At most one new term per step, bolded
  once, and only terms the module goal needs; say everything else in everyday words.
- Keep the thread. Each step opens by connecting to what the learner just did or saw ("You just
  sorted… Notice that…", "So far… Now…"), so they always know why they are looking at it. Vary
  how you do it: never start two steps with the same words.
- Say it plainly. Accuracy comes from choosing claims you are sure of, not from qualifying every
  sentence. Add a caveat only where the caveat is the point, and then say it once, plainly.
- Never ask the learner to use a term or distinction before the lesson has shown it, unless the step
  is openly a guess ("Predict first: …").
- Headings say what the step is about in under 8 plain words, not a slogan.
- Things to choose between are short: check options, activity choices and sort items are phrases the
  learner can compare at a glance (aim for under 12 words). Put shared detail in the question once.

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
   If it lists their shapes, this lesson must not feel the same: open differently, end differently,
   use different activity types and a different rhythm.

2. BLOCKS. Write "blocks": 5-12 blocks in teaching order, moving from exploration to understanding
   to application. Use only the kinds this lesson needs; never pad with filler. Every block has all
   fields; leave unused ones empty ("" / [] / 0, and "correct": false, "line": 0 in items).
   Every block includes "answers" and "unit"; leave them [] and "" except in problem blocks.
   - explain: heading, body = the explanation (2-4 short sentences, one idea; a blank line between
     paragraphs), aside = an optional concrete example in 1-2 sentences. Define a term only when the
     learner needs it.
     mode = its layout; vary it across the lesson to fit what each step says:
       "" = standard; "split" = the explanation beside its example (needs an aside), for an idea and a
       case side by side; "spotlight" = heading is ONE short, striking statement or number the learner
       should remember, set large, with a short body; "steps" = numbered points after the body,
       items = 2-5 (label = a short title, text = one sentence), for a process or a list of reasons.
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
   - compare: two things side by side, once the learner knows what is being compared and why.
     heading, body = one sentence saying what to look for, columns = exactly 2 short names (1-3
     words), items = 3-5 rows (label = the aspect, 1-3 words; text = first column; detail = second
     column). Cells are short, parallel phrases of 3-12 words, never full paragraphs: the row should
     be readable at a glance. aside = the one point the contrast makes, in one sentence.
   - reflect: an open question the learner answers in their own words. heading, body = the question,
     aside = a strong model answer they compare against afterwards: the answer itself, as the learner
     would write it. No lead-in ("One possible answer:", "A sample caption:"), no quotes around it,
     nothing after it; it is shown under the heading "A model answer".
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
   - Avoid the default loop. "Explain a bit, do an activity, answer a check", repeated two or three
     times, is how every lesson comes out when nobody designs it, and learners notice. Let the
     approach set the rhythm instead: a stretch of exploring with no check, a dialogue that teaches,
     a worked example then practice that builds, one scenario that deepens, a check after two ideas
     instead of after each.
   - At least 2 hands-on blocks (activity, code, worked, problem, reflect) besides the checks.
   - End with a final check or problem only when the lesson builds to applying everything; otherwise
     end where the approach lands.
   - Every block earns its place: if an activity only repeats what the text just said, cut one of them.
   - Never use the same activity type twice, and don't put two blocks of the same kind back to back
     unless the sequence genuinely needs it. No more than 2 explain blocks in a row.

QUESTIONS (the graded checks): 2-4, each placed by exactly one check block. Each is scenario-based
(a short realistic situation that asks the learner to apply the idea, never a definition to recall),
has EXACTLY 4 distinct options, a correctAnswer that is an EXACT copy of one option, and a 1-2 sentence
explanation of why it is right. Keep the question to 1-3 short sentences and the options short.
A check must make the learner think; someone who skimmed the lesson
or knows how tests work should not be able to pass it. Every question is tested for giveaways:
- New situation: different names, numbers and context from the lesson's own examples, so it tests
  transfer, not recognition. The question must be answerable before reading the options; never
  "which of the following is true".
- Wrong options come from real misconceptions: each is what a learner who holds one specific,
  common wrong idea (or makes one specific slip, e.g. a sign or unit error) would choose. Never pad
  with silly or obviously off-topic options.
- No cues: all four options the same kind of thing, similar in length, detail and tone; the right
  one not the longest or most careful; the question's key words used in wrong options too (or in
  none); no "always/never/only" just in wrong options; no "all/none of the above".
  The order of options doesn't matter; it is shuffled.
- Hard enough: aim for most learners who followed the lesson to get it right on a first try, not
  all of them; later checks combine ideas.
- Hints help the learner reason (which idea applies? what changes if…?) and never name, paraphrase
  or rule out options.

ACTIVITIES: 1-4, each placed by one activity block, each a different type that fits the topic.
${ACTIVITY_GUIDE}

FORMATTING inside text fields: plain sentences, plus where they help:
- math in TeX: \\( inline \\) and \\[ on its own line \\] (in JSON, write \\\\( ); chemistry as
  \\ce{H2O}. Never use $ for math: a single $ is a price.
- **bold** for a key term, a list with "- " or "1. " lines, or a small table with | pipes |
  (header row, then a |---| row), when a table really is clearer.
- an interactive graph in an explain, worked or problem body, when seeing a curve helps (a
  function, a relationship, a rate), as a fenced block on its own lines:
    \`\`\`graph
    y = k*x^2
    y = x^2
    x: -5 to 5, distance (m)
    y: 0 to 25, height (m)
    k: 0.5 to 3, steepness, start 1
    caption: The dashed curve is y = x^2 for comparison.
    \`\`\`
  1-3 "y =" curves in x, using numbers, + - * / ^ ( ), pi, e, sin cos tan sqrt abs exp ln log; the
  first curve may use k, set by the optional "k:" slider (min to max, what it means, start value);
  "x:" and "y:" are the window. A graph that doesn't draw a visible curve is removed. Use it at most
  twice per lesson, and not when a graph activity already shows the same thing.

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
  // Room for a graph or two written in the text; ones that don't draw are dropped (lib/embeds.ts).
  const body = cleanEmbeds(text(r.body, 2400));
  const aside = text(r.aside, 900);
  const items = normItems(r.items);

  switch (kind) {
    case "explain": {
      if (!body) return null;
      const block: Extract<Block, { kind: "explain" }> = { kind, heading, body, example: aside };
      // A layout is kept only when the block has what it needs; otherwise it's a standard step.
      const layout = EXPLAIN_LAYOUTS.find((l) => l === text(r.mode, 20).toLowerCase());
      const points = items.filter((i) => i.text).map((i) => ({ title: i.label, text: i.text })).slice(0, 5);
      if (layout === "split" && aside) block.layout = layout;
      if (layout === "spotlight" && heading && body.length <= 600) block.layout = layout;
      if (layout === "steps" && points.length >= 2) Object.assign(block, { layout, points });
      return block;
    }
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
      const block: Extract<Block, { kind: "compare" }> = { kind, heading, intro: body, columns: [columns[0], columns[1]], rows };
      if (aside) block.takeaway = aside;
      return block;
    }
    case "reflect":
      if (!body || !aside) return null;
      return { kind, heading, prompt: body, model: modelAnswerText(aside) };
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
      // The order of options is set here, not by the writer (lib/questionCheck.ts).
      questions: shuffleOptions(questions),
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
  // Questions answerable without knowing the idea.
  issues.push(...lintQuestions(lesson));
  return issues;
}


// ---------- variety ----------

/**
 * A lesson's shape as tokens, e.g. ["act:sort", "explain", "check"]: the kind
 * of each block, with the activity type or code mode. Earlier modules' shapes
 * go into the next brief, so a course doesn't repeat one rhythm.
 */
export function lessonShape(lesson: Lesson): string[] {
  return lessonBlocks(lesson).map((b) =>
    b.kind === "activity" ? `act:${lesson.activities?.[b.ref]?.type ?? "unknown"}` : b.kind === "code" ? `code:${b.mode}` : b.kind
  );
}

const rhythm = (token: string) => (token === "check" ? "C" : ["explain", "compare", "dialogue", "summary"].includes(token) ? "E" : "H");

/**
 * The runs of blocks before each check, in rhythm letters: H something to
 * do, E something to read. "EH" is an explanation then an activity.
 */
const unitsBeforeChecks = (shape: string[]) => shape.map(rhythm).join("").split("C").slice(0, -1);
const isLoopUnit = (u: string) => u.length >= 2 && u.length <= 3 && u.includes("H") && u.includes("E");

/**
 * How many times the lesson runs the loop "read a bit, do a bit, check":
 * short runs of explanation and activity, each closed by a check. Nearly
 * every saved lesson was 2-3 of these, whatever its approach (2026-10-13).
 */
export function loopCount(shape: string[]): number {
  return unitsBeforeChecks(shape).filter(isLoopUnit).length;
}

type Signs = { has: (shape: string[]) => boolean; need: string };
const any = (shape: string[], tokens: string[]) => shape.some((t) => tokens.includes(t));
const count = (shape: string[], test: (t: string) => boolean) => shape.filter(test).length;

/**
 * What code can see of each approach. The labels drifted from the lessons:
 * "socratic" with no dialogue, "practice" with one problem, every approach
 * the same loop (26 saved lessons, 2026-10-13). Approaches whose shape code
 * can't see (mystery, scenario, case study, misconception) are left to the
 * reviewer.
 */
const APPROACH_SIGNS: Partial<Record<Approach, Signs>> = {
  discovery: { has: (s) => rhythm(s[0] ?? "") === "H", need: "the learner tries something (an activity, code, a problem) before anything is explained" },
  visual: {
    has: (s) => count(s, (t) => ["act:diagram", "act:chart", "act:timeline", "act:graph", "act:simulation", "compare"].includes(t)) >= 2,
    need: "at least two visual blocks (diagram, chart, timeline, graph, simulation or compare) carrying the explanation",
  },
  worked_example: {
    has: (s) => s.includes("worked") && s.slice(s.indexOf("worked") + 1).some((t) => t === "problem" || t.startsWith("code:")),
    need: "a worked example first, then a problem (or code) the learner solves alone",
  },
  simulation: { has: (s) => any(s.slice(0, 3), ["act:simulation", "act:graph"]), need: "a simulation or graph the learner varies within the first three blocks" },
  story: { has: (s) => any(s, ["act:story", "dialogue"]), need: "a story activity or a dialogue that carries the idea" },
  socratic: { has: (s) => s.includes("dialogue"), need: "a dialogue block doing the teaching" },
  compare: { has: (s) => s.includes("compare") || s.includes("act:sort"), need: "a compare table or a sort the learner classifies with" },
  practice: {
    has: (s) => count(s, (t) => t === "problem" || t === "worked" || t.startsWith("code:")) >= 3,
    need: "at least three problems, worked examples or code exercises, each a little harder",
  },
  reflection: { has: (s) => s.includes("reflect"), need: "a reflection where the learner applies the idea to their own life or work" },
};

/**
 * Problems with the lesson's shape: the same loop repeated, an approach the
 * sequence doesn't show, and repeating how the previous module opened, closed
 * or what it had the learner do. `previousShapes` are earlier modules' shapes
 * (lessonShape joined with " > "), most recent last.
 */
export function lintVariety(lesson: Lesson, previousShapes: string[] = []): string[] {
  const shape = lessonShape(lesson);
  const issues: string[] = [];
  const loops = loopCount(shape);
  if (loops >= 3) {
    issues.push(
      `The lesson runs the same loop ${loops} times: read a bit, do a bit, answer a check (${shape.join(" > ")}). It feels like a template. Change the rhythm: let a stretch run without a check, teach through the activity itself, put two ideas before one harder check, or build to one larger task.`
    );
  }
  const signs = lesson.approach ? APPROACH_SIGNS[lesson.approach] : undefined;
  if (signs && !signs.has(shape)) {
    issues.push(`The approach is "${lesson.approach}", but the sequence doesn't show it. A ${lesson.approach} lesson needs ${signs.need}. Make the shape match, or pick the approach that fits what you wrote.`);
  }
  const previous = previousShapes.at(-1)?.split(" > ").filter(Boolean);
  if (previous?.length) {
    if (shape[0] === previous[0]) issues.push(`The previous module also opened with "${shape[0]}". Open this one differently.`);
    if (shape.at(-1) === previous.at(-1) && shape.at(-1) !== "check") {
      issues.push(`The previous module also ended with "${shape.at(-1)}". End this one where its approach lands, not the same way.`);
    }
    if (loops >= 2 && loopCount(previous) >= 2) {
      issues.push(
        `The previous module had the same rhythm (read a bit, do a bit, check, repeated). Give this one a different shape, e.g. a longer stretch of exploring before any check, a worked example then practice, a dialogue, or one problem built up step by step.`
      );
    }
    const repeated = [...new Set(shape.filter((t) => t.startsWith("act:") && previous.includes(t)))];
    if (repeated.length >= 2) {
      issues.push(`The previous module used the same activities (${repeated.map((t) => t.slice(4)).join(", ")}). Use different kinds of activity this time.`);
    }
  }
  return issues;
}

/** Everything code finds wrong with a lesson's design and reading, for the reviewer and reviser. */
export function lintLesson(lesson: Lesson, previousShapes: string[] = []): string[] {
  return [...lintStructure(lesson), ...lintVariety(lesson, previousShapes), ...lintReadability(lesson)];
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
      return {
        ...base,
        heading: b.heading,
        body: b.body,
        aside: b.example,
        mode: b.layout ?? "",
        items: (b.points ?? []).map((p) => flatItem({ label: p.title, text: p.text })),
      };
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
      return {
        ...base,
        heading: b.heading,
        body: b.intro,
        aside: b.takeaway ?? "",
        columns: [...b.columns],
        items: b.rows.map((r) => flatItem({ label: r.label, text: r.a, detail: r.b })),
      };
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
