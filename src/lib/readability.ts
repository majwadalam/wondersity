// How hard a lesson is to read, measured in code. Early learners said the
// content was good but hard to follow (2026-10-13): steps that packed several
// ideas into long, qualified sentences, a new bold term in every line, check
// options that were full sentences, table cells that were paragraphs. These
// findings go to the reviewer and reviser like the structure lint, so a draft
// that reads heavily is scored down and rewritten more plainly.
//
// Pure functions only, so it can be unit tested.

import { lessonBlocks, type Block, type Lesson } from "./lessonBlocks";

/** Words of reading in one step before it is too much for one idea. */
export const MAX_STEP_WORDS = 90;
/** A sentence longer than this is hard to follow on first read. */
export const MAX_SENTENCE_WORDS = 30;
/** The lesson's average sentence length, past which it reads as dense. */
export const MAX_AVERAGE_SENTENCE = 20;
/** Bold (new) terms one step may introduce. */
const MAX_TERMS_PER_STEP = 2;
const MAX_OPTION_WORDS = 18;
const MAX_CELL_WORDS = 15;

/** Text as it reads: no graphs, tables, math or markdown marks. */
export function plainText(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .split("\n")
    .filter((l) => !/^\s*\|.*\|\s*$/.test(l))
    .join("\n")
    .replace(/\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$/g, " ")
    .replace(/\\\([\s\S]*?\\\)/g, "x")
    .replace(/\\ce\{[^}]*\}/g, "x")
    .replace(/\*\*|`/g, "")
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, "");
}

export const words = (text: string) => plainText(text).split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));

/** Sentences of a text; list items and lines count as their own sentences. */
export function sentences(text: string): string[] {
  return plainText(text)
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])["”’)]?\s+(?=["“(]?[\p{Lu}\p{N}])/u))
    .map((s) => s.trim())
    .filter((s) => words(s).length > 0);
}

/** Bold terms, not bold labels ("**Typography:** serif headings") or bold phrases. */
const boldTerms = (text: string) =>
  [...text.matchAll(/\*\*([^*\n]+)\*\*(:?)/g)]
    .filter((m) => !m[2] && !m[1].trim().endsWith(":") && m[1].trim().split(/\s+/).length <= 4)
    .map((m) => m[1].trim().toLowerCase());

/** Every piece of text a learner reads in a block, as prose (not labels). */
function blockProse(b: Block, lesson: Lesson): string[] {
  switch (b.kind) {
    case "explain":
      return [b.body, b.example, ...(b.points ?? []).map((p) => p.text)];
    case "worked":
      return [b.problem, ...b.steps.flatMap((s) => [s.text, s.why]), b.answer];
    case "code":
      return [b.prompt, b.explanation];
    case "compare":
      return [b.intro, b.takeaway ?? ""];
    case "reflect":
      return [b.prompt];
    case "dialogue":
      return b.turns.map((t) => t.text);
    case "problem":
      return [b.prompt, b.solution];
    case "summary":
      return b.points;
    case "activity": {
      const a = lesson.activities?.[b.ref];
      return a ? [a.prompt, a.reveal] : [];
    }
    case "check": {
      const q = lesson.questions[b.ref];
      return q ? [q.question, q.explanation] : [];
    }
  }
}

const quoteStart = (s: string, n = 8) => {
  const w = s.split(/\s+/);
  return `"${w.slice(0, n).join(" ")}${w.length > n ? "…" : ""}"`;
};

const stepName = (b: Block, i: number) => ("heading" in b && b.heading ? `"${b.heading}"` : `${i + 1} (${b.kind})`);

/**
 * What makes the lesson hard to read, as findings for the reviewer and
 * reviser. Empty when it reads plainly.
 */
export function lintReadability(lesson: Lesson): string[] {
  const blocks = lessonBlocks(lesson);
  const issues: string[] = [];
  const all: string[] = [];
  const long: { s: string; n: number }[] = [];
  const terms = new Set<string>();

  blocks.forEach((b, i) => {
    const prose = blockProse(b, lesson).filter(Boolean);
    for (const text of prose) {
      for (const s of sentences(text)) {
        all.push(s);
        const n = words(s).length;
        if (n > MAX_SENTENCE_WORDS) long.push({ s, n });
      }
    }
    if (b.kind === "explain") {
      const n = words([b.body, b.example, ...(b.points ?? []).map((p) => p.text)].join("\n")).length;
      if (n > MAX_STEP_WORDS) {
        issues.push(`Step ${stepName(b, i)} is ${n} words of reading. Keep a step to one idea in about 40-80 words; split it or cut it.`);
      }
      const bold = new Set(boldTerms(`${b.body}\n${b.example}`));
      if (bold.size > MAX_TERMS_PER_STEP) {
        issues.push(`Step ${stepName(b, i)} introduces ${bold.size} new terms at once (${[...bold].join(", ")}). Introduce one new term per step, after the learner has the idea it names.`);
      }
    }
    for (const text of prose) for (const t of boldTerms(text)) terms.add(t);
    if (b.kind === "check") {
      const q = lesson.questions[b.ref];
      if (q) {
        const lengths = q.options.map((o) => words(o).length);
        const avg = lengths.reduce((s, n) => s + n, 0) / lengths.length;
        if (Math.max(...lengths) > MAX_OPTION_WORDS || avg > 14) {
          issues.push(`Check ${quoteStart(q.question)} has long options (about ${Math.round(avg)} words each). Options should be short phrases a learner can compare at a glance; put shared detail in the question.`);
        }
      }
    }
    if (b.kind === "compare") {
      const longest = b.rows.flatMap((r) => [r.a, r.b]).reduce((m, c) => (words(c).length > words(m).length ? c : m), "");
      if (words(longest).length > MAX_CELL_WORDS) {
        issues.push(`Compare table ${stepName(b, i)} has cells that are sentences (${quoteStart(longest)} is ${words(longest).length} words). Cells should be short, parallel phrases of about 3-12 words.`);
      }
      if (!b.takeaway) issues.push(`Compare table ${stepName(b, i)} has no takeaway: put the one point the contrast makes in its aside.`);
    }
  });

  if (long.length) {
    const shown = long
      .sort((a, b) => b.n - a.n)
      .slice(0, 3)
      .map((l) => `${quoteStart(l.s)} (${l.n} words)`)
      .join("; ");
    issues.push(`${long.length} sentence${long.length > 1 ? "s are" : " is"} over ${MAX_SENTENCE_WORDS} words, hard to follow on a first read: ${shown}. Split them.`);
  }
  const total = all.reduce((s, x) => s + words(x).length, 0);
  const average = all.length ? total / all.length : 0;
  if (average > MAX_AVERAGE_SENTENCE) {
    issues.push(`Sentences average ${Math.round(average)} words; aim for about 12-16. Short sentences, one idea each.`);
  }
  if (terms.size > 6) {
    issues.push(`The lesson introduces ${terms.size} bold terms. A 5-10 minute lesson can carry about 3-5 new terms; keep the ones the goal needs and say the rest in plain words.`);
  }
  return issues;
}
