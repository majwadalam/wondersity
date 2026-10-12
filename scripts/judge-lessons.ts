// Re-scores saved sample lessons with one reviewer, so lessons written by
// different models are judged the same way (by default each model reviews
// its own lessons). The reviewer is REVIEW_MODEL.
//
//   REVIEW_MODEL=deepseek/deepseek-v4.1-flash node --env-file=.env.local --import tsx scripts/judge-lessons.ts <file.json>...

import { readFileSync } from "node:fs";
import { evaluateLesson, type LessonBrief } from "../src/lib/lessonWriter";
import { withUsage } from "../src/lib/model";

const BRIEFS: Record<string, Pick<LessonBrief, "topic" | "courseTitle" | "module">> = {
  "black-holes": { topic: "Black holes", courseTitle: "Black Holes: Where Gravity Wins", module: { title: "The event horizon", goal: "Understand why nothing, not even light, escapes from inside the event horizon." } },
  "python-loops": { topic: "Python loops", courseTitle: "Python Loops from Scratch", module: { title: "For loops and accumulators", goal: "Read, predict and write for loops that build up a result." } },
  "the-french-revolution": { topic: "The French Revolution", courseTitle: "The French Revolution", module: { title: "Why 1789?", goal: "Explain how debt, food prices and new ideas combined to start the revolution." } },
  "game-theory": { topic: "Game theory", courseTitle: "Game Theory: Thinking Strategically", module: { title: "The prisoner's dilemma", goal: "See why individually rational choices can lead to a worse outcome for everyone." } },
  "projectile-motion": { topic: "Projectile motion", courseTitle: "Projectile Motion", module: { title: "Launch angle and range", goal: "Explain how launch angle changes a projectile's path and how far it lands." } },
  probability: { topic: "Probability", courseTitle: "Probability: Reasoning Under Uncertainty", module: { title: "Independent events and the multiplication rule", goal: "Compute the probability that two independent events both happen." } },
};

async function judge(file: string) {
  const key = Object.keys(BRIEFS).find((k) => file.endsWith(`${k}.json`));
  if (!key) return `${file}: unknown topic`;
  const { lesson } = JSON.parse(readFileSync(file, "utf8"));
  const brief: LessonBrief = { ...BRIEFS[key], moduleIndex: 1, moduleCount: 9, previousModules: ["Introduction"], focus: "" };
  try {
    const { result: e, usage } = await withUsage(() => evaluateLesson(brief, lesson, Date.now() + 120_000));
    return `${file}\t${e.score}\t$${usage.cost.toFixed(4)}\t${e.problems.slice(0, 2).join(" / ")}`;
  } catch (err) {
    return `${file}\tFAILED ${err instanceof Error ? err.message : err}`;
  }
}

Promise.all(process.argv.slice(2).map(judge)).then((r) => console.log(r.join("\n")));
