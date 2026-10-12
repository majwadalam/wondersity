// Finding a shared course plan for a new learner's topic (see AGENTS.md,
// "Plan cache and runs"). Learners word the same course differently ("Stoicism",
// "stoic philosophy", "intro to stoicism"), so an exact match on the topic
// would rarely hit. Three steps, cheapest first:
//
//   1. exact:   the same topic, normalized (free)
//   2. similar: the closest cached topics by meaning, from embeddings
//               (~$0.0000004 per topic); only candidates above MIN_SIMILARITY
//   3. confirm: a small model decides whether one of them is the same course,
//               not just a related one ("Stoicism for anxiety" isn't "Stoicism";
//               Python the language isn't pythons the snakes)
//
// Any failure along the way just means "no shared plan": the course is
// planned fresh, as it would have been without the cache.

import { z } from "zod";
import { PLANNER_VERSION } from "./coursePlan";
import * as db from "./db";
import { env } from "./env";
import { callStructured, embed, type Deadline } from "./model";

/** Cosine similarity below which a cached topic isn't even shown to the judge. */
export const MIN_SIMILARITY = 0.55;
const MAX_CANDIDATES = 3;
const judgeModel = () => env("MATCH_MODEL") ?? "openai/gpt-6-luna";

export type SharedPlanResult = {
  plan: db.CachedPlan | null;
  via: "exact" | "similar" | null;
  /** The requested topic's embedding, kept so a new plan can be cached with it. */
  embedding: number[] | null;
  /** What happened, for the trace. */
  note: Record<string, unknown>;
};

const JudgeSchema = z.object({ match: z.string() });
const judgeJsonSchema = {
  type: "object",
  properties: { match: { type: "string" } },
  required: ["match"],
  additionalProperties: false,
};

/** Asks a small model which candidate, if any, is the same course. Returns its topic_key or null. */
export async function judgeSameCourse(
  topic: string,
  candidates: { topic_key: string; topic: string; title: string; description: string }[],
  deadline: Deadline
): Promise<string | null> {
  const raw = await callStructured(
    `A learner asked for a course. Decide whether one of these existing courses would serve them exactly
as well as a course made for their own words. Say yes only for the same subject, the same scope and the
same angle: different wording or spelling of one subject is a match ("Stoicism", "stoic philosophy",
"intro to stoicism"); a narrower, broader or differently aimed course is not ("Stoicism for anxiety",
"Roman philosophy", "Marcus Aurelius"), nor is a different meaning of the same word (Python the
programming language vs pythons the snakes). If unsure, say none.
Reply with the matching course's key exactly as given, or "none".`,
    `Learner asked for: "${topic}"\n\nExisting courses:\n${candidates
      .map((c) => `- key: ${c.topic_key}\n  asked as: "${c.topic}"\n  course: ${c.title} — ${c.description}`)
      .join("\n")}`,
    judgeJsonSchema,
    deadline,
    { model: judgeModel(), timeoutMs: 20_000, maxTokens: 1_000 }
  );
  const { match } = JudgeSchema.parse(raw);
  // Only a key that was offered counts; anything else is "none".
  return candidates.some((c) => c.topic_key === match) ? match : null;
}

export type PlanCacheDeps = {
  getCachedPlan: typeof db.getCachedPlan;
  matchCoursePlans: typeof db.matchCoursePlans;
  embed: typeof embed;
  judge: typeof judgeSameCourse;
};

const realDeps: PlanCacheDeps = { getCachedPlan: db.getCachedPlan, matchCoursePlans: db.matchCoursePlans, embed, judge: judgeSameCourse };

/** The shared plan for a new learner's topic, if there is one that's truly the same course. */
export async function findSharedPlan(topic: string, topicKey: string, deadline: Deadline, deps: PlanCacheDeps = realDeps): Promise<SharedPlanResult> {
  const exact = await deps.getCachedPlan(topicKey, PLANNER_VERSION).catch(() => null);
  if (exact) return { plan: exact, via: "exact", embedding: null, note: { hit: true, via: "exact" } };

  let embedding: number[] | null = null;
  try {
    embedding = await deps.embed(topic);
  } catch (e) {
    return { plan: null, via: null, embedding: null, note: { hit: false, error: `embedding: ${e instanceof Error ? e.message : e}` } };
  }

  try {
    const nearest = await deps.matchCoursePlans(embedding, PLANNER_VERSION, MAX_CANDIDATES);
    const candidates = nearest.filter((c) => c.similarity >= MIN_SIMILARITY);
    const seen = nearest.map((c) => `${c.topic} (${c.similarity.toFixed(2)})`);
    if (!candidates.length) return { plan: null, via: null, embedding, note: { hit: false, nearest: seen } };
    const match = await deps.judge(topic, candidates, deadline);
    const plan = match ? await deps.getCachedPlan(match, PLANNER_VERSION) : null;
    return { plan, via: plan ? "similar" : null, embedding, note: { hit: !!plan, via: plan ? "similar" : undefined, nearest: seen, matched: match } };
  } catch (e) {
    return { plan: null, via: null, embedding, note: { hit: false, error: e instanceof Error ? e.message : String(e) } };
  }
}
