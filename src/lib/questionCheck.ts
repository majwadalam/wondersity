// Checks that a lesson's graded questions can't be answered without knowing
// the idea: the "testwise" cues item writers are trained to avoid (Haladyna,
// Downing & Rodriguez 2002; the NBME item-writing guide), which models keep
// producing even when told not to. See research/question-quality.md.
//
// The model-based check is in lib/blindCheck.ts. Pure functions only.
//
// 1. lintQuestions: cues code can detect, handed to the reviewer and the
//    reviser with the structural issues. Rule-based checks catch item flaws
//    more reliably than a model reviewer does (Moore et al. 2023).
// 2. shuffleOptions: the options' order is set in code, since writers favour
//    some positions for the right answer (Attali & Bar-Hillel 2003).

import { lessonBlocks, type Lesson, type Question } from "./lessonBlocks";

const STOP = new Set(
  "a an the and or but if then than that this these those of to in on at by for with from into onto over under about as is are was were be been being it its it's they them their there here what which who whom whose when where why how do does did done not no can could would should will may might must have has had more most less least very so such each every any some one two three four you your we our he she his her i me my".split(
    " "
  )
);

/** Content words of a text: lowercase, without stopwords, short words or a plural "s". */
export function contentWords(text: string) {
  return new Set(
    text
      .toLowerCase()
      .replace(/\\\(|\\\)|\\\[|\\\]/g, " ")
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length > 3 && !STOP.has(w))
      .map((w) => (w.length > 4 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w))
  );
}

const ABSOLUTE = /\b(always|never|only|all|none|every|completely|entirely|guaranteed|impossible|cannot ever)\b/i;
const ABOVE = /\b(all|none|both) of the (above|options|answers)\b|\bboth [a-d] and [a-d]\b/i;
const WHICH_TRUE = /\bwhich (of the following|statement|option|one)( \w+)? (is|are|best describes) (true|correct|false|accurate|right)\b/i;

const short = (s: string) => (s.length > 60 ? `${s.slice(0, 57)}…` : s);

/** Testwise cues in one question, as messages for the reviewer and reviser. */
function questionCues(q: Question, hints: string[]): string[] {
  const issues: string[] = [];
  const wrong = q.options.filter((o) => o !== q.correctAnswer);
  const key = q.correctAnswer;

  // The right answer stands out by length: the most persistent cue in model-written questions.
  const meanWrong = wrong.reduce((n, o) => n + o.length, 0) / wrong.length;
  if (wrong.every((o) => o.length < key.length) && key.length > meanWrong * 1.3)
    issues.push("the right answer is clearly the longest option; make the options similar in length and detail");

  // "Clang": the right answer repeats the question's words and no wrong option does.
  const stem = contentWords(q.question);
  const keyWords = contentWords(key);
  const wrongWords = wrong.map((o) => contentWords(o));
  const echoed = [...keyWords].filter((w) => stem.has(w) && wrongWords.every((ws) => !ws.has(w)));
  const echoCount = (ws: Set<string>) => [...ws].filter((w) => stem.has(w)).length;
  if (echoed.length && wrongWords.every((ws) => echoCount(ws) < echoCount(keyWords)))
    issues.push(`only the right answer repeats the question's wording (${echoed.slice(0, 3).map((w) => `"${w}"`).join(", ")}); use those words in wrong options too, or in none`);

  // Absolute words mark wrong options; hedges mark the right one.
  const absoluteWrong = wrong.filter((o) => ABSOLUTE.test(o)).length;
  if (absoluteWrong >= 2 && !ABSOLUTE.test(key)) issues.push('absolute words ("always", "never", "only") appear only in wrong options');

  if (q.options.some((o) => ABOVE.test(o))) issues.push('uses "all/none of the above" or "both A and B"; write four separate answers');
  if (WHICH_TRUE.test(q.question)) issues.push('asks "which of the following is true": pose a question that can be answered before reading the options');

  // A hint that hands over the answer's distinctive words gives it away.
  const leaked = hints.flatMap((h) => [...contentWords(h)].filter((w) => keyWords.has(w) && !stem.has(w) && wrongWords.every((ws) => !ws.has(w))));
  if (leaked.length) issues.push(`a hint uses words found only in the right answer (${[...new Set(leaked)].slice(0, 3).map((w) => `"${w}"`).join(", ")}); hint at the reasoning, not the answer`);

  return issues;
}

/** Testwise cues in a lesson's questions and typed problems. */
export function lintQuestions(lesson: Lesson): string[] {
  const blocks = lessonBlocks(lesson);
  const hintsFor = new Map<number, string[]>();
  for (const b of blocks) if (b.kind === "check") hintsFor.set(b.ref, b.hints);
  const issues: string[] = [];
  lesson.questions.forEach((q, i) => {
    for (const cue of questionCues(q, hintsFor.get(i) ?? [])) issues.push(`Question ${i + 1} ("${short(q.question)}"): ${cue}.`);
  });
  // Across the lesson: a pattern a learner can learn.
  const longest = lesson.questions.filter((q) => q.options.every((o) => o === q.correctAnswer || o.length < q.correctAnswer.length)).length;
  if (lesson.questions.length >= 3 && longest / lesson.questions.length > 0.6)
    issues.push(`In ${longest} of ${lesson.questions.length} questions the right answer is the longest option, a pattern learners pick up.`);
  for (const b of blocks) {
    if (b.kind !== "problem") continue;
    const stated = b.answers.find((a) => a.length >= 2 && new RegExp(`(^|[^\\d.])${a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\d]|$)`).test(b.prompt));
    if (stated) issues.push(`Problem "${short(b.heading || b.prompt)}": its answer (${stated}) already appears in the problem text.`);
  }
  return issues;
}

/**
 * A fixed shuffle of each question's options: sorted, then shuffled with a
 * seed from the question, so the order doesn't depend on the writer's and
 * validating a lesson twice gives the same order.
 */
export function shuffleOptions(questions: Question[]): Question[] {
  return questions.map((q) => {
    let h = 2166136261;
    for (const ch of q.question) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    const options = [...q.options].sort();
    for (let i = options.length - 1; i > 0; i--) {
      h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
      const j = h % (i + 1);
      [options[i], options[j]] = [options[j], options[i]];
    }
    return { ...q, options };
  });
}
