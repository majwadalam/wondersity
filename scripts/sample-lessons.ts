// Writes one module per sample topic through the real quality gate and prints
// each lesson's approach and block sequence, to check lessons vary by subject.
// Uses the OpenRouter key in .env.local; nothing is saved to the database.
//
//   node --env-file=.env.local --import tsx scripts/sample-lessons.ts [outDir] [topic filter]

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { lessonBlocks } from "../src/lib/lessonBlocks";
import { lintStructure } from "../src/lib/lessonDesign";
import { withUsage } from "../src/lib/model";
import { writeLesson, type LessonBrief, type TraceEntry } from "../src/lib/lessonWriter";

const SAMPLES: (Pick<LessonBrief, "topic" | "courseTitle" | "module"> & { kind: string })[] = [
  {
    kind: "conceptual science",
    topic: "Black holes",
    courseTitle: "Black Holes: Where Gravity Wins",
    module: { title: "The event horizon", goal: "Understand why nothing, not even light, escapes from inside the event horizon." },
  },
  {
    kind: "programming",
    topic: "Python loops",
    courseTitle: "Python Loops from Scratch",
    module: { title: "For loops and accumulators", goal: "Read, predict and write for loops that build up a result." },
  },
  {
    kind: "history",
    topic: "The French Revolution",
    courseTitle: "The French Revolution",
    module: { title: "Why 1789?", goal: "Explain how debt, food prices and new ideas combined to start the revolution." },
  },
  {
    kind: "strategy",
    topic: "Game theory",
    courseTitle: "Game Theory: Thinking Strategically",
    module: { title: "The prisoner's dilemma", goal: "See why individually rational choices can lead to a worse outcome for everyone." },
  },
  {
    kind: "physics",
    topic: "Projectile motion",
    courseTitle: "Projectile Motion",
    module: { title: "Launch angle and range", goal: "Explain how launch angle changes a projectile's path and how far it lands." },
  },
  {
    kind: "mathematics",
    topic: "Probability",
    courseTitle: "Probability: Reasoning Under Uncertainty",
    module: { title: "Independent events and the multiplication rule", goal: "Compute the probability that two independent events both happen." },
  },
  // Niche topics with few good courses: the positioning bet, and where accuracy is hardest.
  {
    kind: "niche philosophy",
    topic: "The Socratic method",
    courseTitle: "The Socratic Method: Thinking by Questioning",
    module: { title: "The elenchus", goal: "Follow and run the elenchus: draw out a claim, test it with agreed premises, and reach aporia." },
  },
  {
    kind: "niche economics",
    topic: "Elinor Ostrom's commons principles",
    courseTitle: "Governing the Commons",
    module: { title: "Clearly defined boundaries", goal: "Explain why commons last longer when it is clear who may use them and what the resource is." },
  },
  {
    kind: "niche language",
    topic: "Ancient Greek accents",
    courseTitle: "Reading Ancient Greek Accents",
    module: { title: "The three accent marks", goal: "Tell acute, grave and circumflex apart and know where each can stand." },
  },
  {
    kind: "niche mathematics",
    topic: "Babylonian sexagesimal numbers",
    courseTitle: "Counting Like Babylon",
    module: { title: "Place value in base 60", goal: "Read and write numbers in base 60 and convert them to base 10." },
  },
];

const outDir = process.argv[2] ?? "sample-lessons";
mkdirSync(outDir, { recursive: true });

async function one(s: (typeof SAMPLES)[number]) {
  const trace: TraceEntry[] = [];
  const start = Date.now();
  try {
    const { result: { lesson, score, passed }, usage } = await withUsage(() => writeLesson(
      {
        ...s,
        moduleIndex: 1,
        moduleCount: 9,
        previousModules: ["Introduction"],
        // Second module of the first level, so the writer pitches it as early in the course.
        level: { number: 1, count: 3, title: "Foundations", objective: `Understand the core ideas of ${s.topic}.`, moduleNumber: 2, moduleCount: 3 },
        focus: "",
      },
      { reviseDeadline: start + 120_000, deadline: start + 280_000, trace }
    ));
    writeFileSync(join(outDir, `${s.topic.replace(/\W+/g, "-").toLowerCase()}.json`), JSON.stringify({ lesson, score, trace }, null, 2));
    const blocks = lessonBlocks(lesson).map((b) =>
      b.kind === "activity" ? `activity:${lesson.activities?.[b.ref]?.type}` : b.kind === "code" ? `code:${b.mode}` : b.kind
    );
    return [
      `■ ${s.kind}: ${s.topic} (${Math.round((Date.now() - start) / 1000)}s, score ${score}${passed ? "" : ", below bar"}, $${usage.cost.toFixed(4)}, ${usage.calls} calls, ${usage.promptTokens} in / ${usage.completionTokens} out tokens)`,
      `  approach: ${lesson.approach} (${lesson.approachReason})`,
      `  blocks:   ${blocks.join(" > ")}`,
      `  issues:   ${lintStructure(lesson).join(" | ") || "none"}`,
      `  trace:    ${trace.map((t) => `${t.step}${t.score !== undefined ? `=${t.score}` : ""}`).join(", ")}`,
    ].join("\n");
  } catch (e) {
    return `■ ${s.kind}: ${s.topic} FAILED: ${e instanceof Error ? e.message : e}\n  trace: ${JSON.stringify(trace)}`;
  }
}

// Optional filter: only samples whose kind or topic contains this text (e.g. "game", "niche").
const only = process.argv[3]?.toLowerCase();
Promise.all(SAMPLES.filter((s) => !only || `${s.kind} ${s.topic}`.toLowerCase().includes(only)).map(one)).then((results) =>
  console.log(results.join("\n\n"))
);
