// Checks a lesson's factual claims against the web. Arithmetic is checked in
// code (factCheck.ts); dates, names, numbers and events can't be computed, so
// each is searched for and judged against what the search found.
//
//   1. extract: one call lists the lesson's checkable claims, most at-risk first
//   2. verify:  one web-search call per claim returns supported / contradicted /
//               unclear, the source it relied on and the sentence it quotes
//   3. code checks the provenance: a verdict only counts if its source is one
//      the search actually returned and, when the page text is known, the
//      quoted evidence is on it. Otherwise the claim is "unclear".
//
// A model's verdict about its own claims is what let wrong facts through
// before; here the evidence comes from outside the model, and the harness, not
// the model, decides which evidence counts.

import { z } from "zod";
import type { Lesson } from "./lessonBlocks";
import { callStructured, callStructuredWithSources, writerModel, type Deadline, type Source } from "./model";
import { env } from "./env";

/** At most this many claims are searched per lesson version (cost and time). */
export const MAX_CLAIMS = 8;
const CALL_TIMEOUT_MS = 60_000;
// Deliberately wrong text: wrong options, trap feedback, stated misconceptions.
// Code is checked by what it does, not by searching.
const SKIP_KEYS = new Set(["traps", "options", "wrong", "misconception", "id", "ref", "code", "correctAnswer", "staging"]);
const MAX_TEXT = 14_000;

export type Verdict = "supported" | "contradicted" | "unclear";

export type ClaimCheck = {
  claim: string;
  where: string;
  verdict: Verdict;
  correction?: string;
  source?: { url: string; title: string };
  /** Why the harness downgraded the model's verdict, if it did. */
  downgraded?: string;
};

export type VerifyReport = {
  checks: ClaimCheck[];
  /** Contradicted claims, one line each, for the reviser. */
  errors: string[];
  /** Claims the search couldn't confirm. */
  uncertain: string[];
  /** Pages that supported a claim. */
  sources: { url: string; title: string }[];
};

/** Whether online checking is on (VERIFY_FACTS=off turns it off). */
export const verifyEnabled = () => env("VERIFY_FACTS") !== "off";
/** The model that lists claims and judges them against search results. */
const verifyModel = () => env("VERIFY_MODEL") ?? writerModel();
const searchEngine = () => env("VERIFY_SEARCH_ENGINE") ?? "exa";

// ---------- 1. What the lesson claims ----------

/** The lesson's text as numbered lines, without the parts that are wrong on purpose. */
export function lessonText(lesson: Lesson): string {
  const lines: string[] = [];
  const walk = (node: unknown, path: string) => {
    if (typeof node === "string") {
      if (node.trim().length > 15) lines.push(`${path}: ${node.trim()}`);
      return;
    }
    if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${path}[${i}]`));
    if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) if (!SKIP_KEYS.has(k)) walk(v, path ? `${path}.${k}` : k);
    }
  };
  walk(lesson, "");
  // A question's right answer is a claim too; its wrong options are not.
  lesson.questions?.forEach((q, i) => lines.push(`questions[${i}].correctAnswer: ${q.correctAnswer}`));
  return lines.join("\n").slice(0, MAX_TEXT);
}

const ExtractSchema = z.object({
  claims: z.array(z.object({ claim: z.string().min(5), where: z.string() })),
});

const extractJsonSchema = {
  type: "object",
  properties: {
    claims: {
      type: "array",
      items: {
        type: "object",
        properties: { claim: { type: "string" }, where: { type: "string" } },
        required: ["claim", "where"],
        additionalProperties: false,
      },
    },
  },
  required: ["claims"],
  additionalProperties: false,
};

async function extractClaims(topic: string, lesson: Lesson, deadline: Deadline) {
  const raw = await callStructured(
    `You list the factual claims in a lesson so each can be checked against the web.
A claim is one specific, checkable statement of fact: a date, a number or measurement, a name, who
did or said what, a quotation, a historical event or cause, a scientific value or law, a definition
that could be wrong. Write each as one standalone sentence that makes sense without the lesson
(name the subject; no "it" or "this"). Skip opinions, instructions to the learner, hypothetical
examples the lesson made up (a shopping list, a fictional student), arithmetic, and how code behaves.
List at most ${MAX_CLAIMS}, the ones most likely to be wrong and most important to the lesson first.
"where" is the path at the start of the line the claim comes from.`,
    `Topic: ${topic}\n\nLesson text:\n${lessonText(lesson)}`,
    extractJsonSchema,
    deadline,
    { model: verifyModel(), reasoningEffort: "low", timeoutMs: CALL_TIMEOUT_MS }
  );
  return ExtractSchema.parse(raw).claims.slice(0, MAX_CLAIMS);
}

// ---------- 2. What the web says ----------

const JudgementSchema = z.object({
  verdict: z.enum(["supported", "contradicted", "unclear"]),
  correction: z.string(),
  sourceUrl: z.string(),
  evidence: z.string(),
});
type Judgement = z.infer<typeof JudgementSchema>;

const judgementJsonSchema = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["supported", "contradicted", "unclear"] },
    correction: { type: "string" },
    sourceUrl: { type: "string" },
    evidence: { type: "string" },
  },
  required: ["verdict", "correction", "sourceUrl", "evidence"],
  additionalProperties: false,
};

async function judgeClaim(topic: string, claim: string, deadline: Deadline) {
  const { data, sources } = await callStructuredWithSources(
    `You check one claim from a lesson against web search results. Judge ONLY from the search
results, not from memory. Prefer reliable sources (encyclopedias, universities, museums, official
and scientific bodies) over forums and blogs.
- "supported": a reliable result states the same fact.
- "contradicted": a reliable result clearly states something incompatible. Put the correct fact in
  "correction".
- "unclear": the results don't settle it, sources disagree, or the claim is an interpretation
  historians or scientists dispute.
Small differences of rounding or wording are not contradictions. "sourceUrl" is the exact URL of the
result you relied on, and "evidence" is a short sentence copied word for word from that result.
Leave "correction", "sourceUrl" and "evidence" empty when they don't apply.`,
    `Lesson topic: ${topic}\nClaim: ${claim}`,
    judgementJsonSchema,
    deadline,
    { model: verifyModel(), timeoutMs: CALL_TIMEOUT_MS, webSearch: { maxResults: 5, engine: searchEngine() } }
  );
  return { judgement: JudgementSchema.parse(data), sources };
}

// ---------- 3. Which verdicts count ----------

const normalizeUrl = (u: string) => u.trim().replace(/[#?].*$/, "").replace(/\/+$/, "").replace(/^https?:\/\/(www\.)?/, "").toLowerCase();
const normalizeText = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/**
 * Applies the harness's rules to the model's verdict: a verdict needs a source
 * the search returned, and evidence found on that page when its text is known.
 */
export function settleVerdict(claim: string, where: string, judgement: Judgement, sources: Source[]): ClaimCheck {
  const base = { claim, where };
  if (judgement.verdict === "unclear") return { ...base, verdict: "unclear" };
  const source = sources.find((s) => normalizeUrl(s.url) === normalizeUrl(judgement.sourceUrl));
  if (!source) return { ...base, verdict: "unclear", downgraded: `cited a page the search didn't return (${judgement.sourceUrl || "none"})` };
  const evidence = normalizeText(judgement.evidence);
  if (source.content && (evidence.length < 12 || !normalizeText(source.content).includes(evidence))) {
    return { ...base, verdict: "unclear", downgraded: "the quoted evidence isn't on the cited page" };
  }
  return {
    ...base,
    verdict: judgement.verdict,
    source: { url: source.url, title: source.title || source.url },
    ...(judgement.verdict === "contradicted" ? { correction: judgement.correction } : {}),
  };
}

export function summarize(checks: ClaimCheck[]): VerifyReport {
  const errors = checks
    .filter((c) => c.verdict === "contradicted")
    .map((c) => `${c.where}: "${c.claim}" is contradicted by ${c.source!.title} (${c.source!.url})${c.correction ? `: ${c.correction}` : ""}`);
  const uncertain = checks.filter((c) => c.verdict === "unclear").map((c) => `${c.where}: "${c.claim}"`);
  const seen = new Set<string>();
  const sources = checks
    .filter((c) => c.verdict === "supported" && c.source)
    .map((c) => c.source!)
    .filter((s) => !seen.has(normalizeUrl(s.url)) && seen.add(normalizeUrl(s.url)));
  return { checks, errors, uncertain, sources };
}

export type VerifyDeps = {
  extract: typeof extractClaims;
  judge: typeof judgeClaim;
};

/**
 * Checks a lesson's claims online. A claim whose search call fails counts as
 * unclear; if listing the claims fails, this throws and the caller decides.
 */
export async function verifyFacts(
  topic: string,
  lesson: Lesson,
  deadline: Deadline,
  deps: VerifyDeps = { extract: extractClaims, judge: judgeClaim }
): Promise<VerifyReport> {
  const claims = await deps.extract(topic, lesson, deadline);
  const checks = await Promise.all(
    claims.map(async ({ claim, where }): Promise<ClaimCheck> => {
      try {
        const { judgement, sources } = await deps.judge(topic, claim, deadline);
        return settleVerdict(claim, where, judgement, sources);
      } catch (e) {
        return { claim, where, verdict: "unclear", downgraded: `search failed: ${e instanceof Error ? e.message : e}` };
      }
    })
  );
  return summarize(checks);
}
