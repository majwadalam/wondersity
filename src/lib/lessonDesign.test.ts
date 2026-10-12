import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { activityJsonSchema } from "./activities";
import { answerMatches, checkProblem, lessonBlocks, parseNumber, type Block, type Lesson } from "./lessonBlocks";
import { lessonJsonSchema, lintStructure, normalizeBlock, normalizeLesson, toModelFormat } from "./lessonDesign";
import { legacyLesson, question, rawHistoryLesson, rawProgrammingLesson } from "./testFixtures";

const kinds = (l: Lesson) => lessonBlocks(l).map((b) => b.kind);

function valid(raw: unknown) {
  const r = normalizeLesson(raw);
  if (!r.ok) assert.fail(r.error);
  return r;
}

describe("normalizeLesson", () => {
  it("keeps a well-formed programming lesson in the order the writer chose", () => {
    const { lesson, report } = valid(rawProgrammingLesson());
    assert.equal(lesson.version, 2);
    assert.equal(lesson.approach, "practice");
    assert.deepEqual(kinds(lesson), ["code", "code", "check", "explain", "code", "check", "activity"]);
    assert.deepEqual(report, { droppedBlocks: 0, droppedActivities: 0, droppedQuestions: 0, placedChecks: 0 });
    const trace = lesson.blocks!.find((b) => b.kind === "code" && b.mode === "trace");
    assert.ok(trace && trace.kind === "code" && trace.trace.length === 5);
  });

  it("gives different subjects different shapes", () => {
    const a = kinds(valid(rawProgrammingLesson()).lesson);
    const b = kinds(valid(rawHistoryLesson()).lesson);
    assert.notDeepEqual(a, b);
    assert.ok(!b.includes("code"), "history has no code blocks");
  });

  it("drops a malformed block and keeps the rest", () => {
    const raw = rawProgrammingLesson();
    // A trace pointing past the end of the code is unusable.
    raw.blocks[1].items[0].line = 99;
    const { lesson, report } = valid(raw);
    assert.equal(report.droppedBlocks, 1);
    assert.equal(lesson.blocks!.filter((b) => b.kind === "code").length, 2);
  });

  it("remaps activity refs after dropping an invalid activity", () => {
    const raw = rawHistoryLesson();
    raw.activities[0].items = []; // the story now has no beats
    const { lesson, report } = valid(raw);
    assert.equal(report.droppedActivities, 1);
    assert.equal(lesson.activities!.length, 1);
    const placed = lesson.blocks!.filter((b) => b.kind === "activity");
    assert.deepEqual(placed, [{ kind: "activity", ref: 0 }]);
    assert.equal(lesson.activities![0].type, "timeline");
  });

  it("never repeats an activity type", () => {
    const raw = rawHistoryLesson();
    raw.activities[1] = { ...raw.activities[0] };
    const { lesson } = valid(raw);
    assert.equal(lesson.activities!.length, 1);
  });

  it("places a question no block placed, before a closing summary", () => {
    const raw = rawHistoryLesson();
    raw.blocks = raw.blocks.filter((b) => !(b.kind === "check" && b.ref === 1));
    const { lesson, report } = valid(raw);
    assert.equal(report.placedChecks, 1);
    const k = kinds(lesson);
    assert.equal(k[k.length - 1], "summary");
    assert.equal(k[k.length - 2], "check");
  });

  it("drops a duplicate check so each question is answered once", () => {
    const raw = rawProgrammingLesson();
    raw.blocks.push({ ...raw.blocks[2] });
    const { lesson } = valid(raw);
    assert.equal(lesson.blocks!.filter((b) => b.kind === "check").length, 2);
  });

  it("drops an invalid question and remaps the checks", () => {
    const raw = rawProgrammingLesson();
    raw.questions = [{ ...question(9), correctAnswer: "not an option" }, question(1), question(2)];
    raw.blocks = raw.blocks.map((b) => (b.kind === "check" ? { ...b, ref: b.ref + 1 } : b));
    const { lesson, report } = valid(raw);
    assert.equal(report.droppedQuestions, 1);
    assert.equal(lesson.questions.length, 2);
    assert.deepEqual(lesson.blocks!.filter((b) => b.kind === "check").map((b) => b.kind === "check" && b.ref), [0, 1]);
  });

  it("rejects lessons missing the essentials", () => {
    const fewQuestions = { ...rawProgrammingLesson(), questions: [question(1)] };
    assert.equal(normalizeLesson(fewQuestions).ok, false);

    const badApproach = { ...rawProgrammingLesson(), approach: "lecture" };
    assert.equal(normalizeLesson(badApproach).ok, false);

    const noHandsOn = rawHistoryLesson();
    noHandsOn.blocks = noHandsOn.blocks.filter((b) => b.kind === "explain" || b.kind === "check" || b.kind === "summary");
    assert.equal(normalizeLesson(noHandsOn).ok, false);

    assert.equal(normalizeLesson(null).ok, false);
    assert.equal(normalizeLesson({ title: "x" }).ok, false);
  });
});

describe("normalizeBlock", () => {
  it("requires exactly one correct option for predict and bug code", () => {
    const raw = rawProgrammingLesson().blocks[0];
    assert.ok(normalizeBlock(raw));
    const twoRight = { ...raw, items: raw.items.map((i) => ({ ...i, correct: true })) };
    assert.equal(normalizeBlock(twoRight), null);
  });

  it("rejects unknown kinds and code modes", () => {
    assert.equal(normalizeBlock({ kind: "lecture" }), null);
    assert.equal(normalizeBlock({ ...rawProgrammingLesson().blocks[0], mode: "run" }), null);
  });

  it("needs a model answer for reflection and two columns to compare", () => {
    const reflect = rawHistoryLesson().blocks.find((b) => b.kind === "reflect")!;
    assert.ok(normalizeBlock(reflect));
    assert.equal(normalizeBlock({ ...reflect, aside: "" }), null);
    const compare = rawHistoryLesson().blocks.find((b) => b.kind === "compare")!;
    assert.equal(normalizeBlock({ ...compare, columns: ["Only one"] }), null);
  });
});

describe("lintStructure", () => {
  it("passes a lesson with checks placed through it", () => {
    assert.deepEqual(lintStructure(valid(rawHistoryLesson()).lesson), []);
  });

  it("flags checks stacked at the end and the old template", () => {
    const issues = lintStructure(legacyLesson() as Lesson);
    assert.ok(issues.some((i) => i.includes("stacked at the end")));
    assert.ok(issues.some((i) => i.includes("old fixed template")));
  });

  it("flags the same interaction used three times", () => {
    const raw = rawProgrammingLesson();
    const predict = raw.blocks[0];
    raw.blocks = [predict, raw.blocks[3], { ...predict }, raw.blocks[2], { ...predict }, raw.blocks[5], raw.blocks[6]];
    assert.ok(lintStructure(valid(raw).lesson).some((i) => i.includes("code (predict)) is used 3 times")));
  });

  it("flags back-to-back blocks of the same kind", () => {
    // The programming fixture opens with two code blocks.
    assert.ok(lintStructure(valid(rawProgrammingLesson()).lesson).some((i) => i.includes('"code"')));
  });
});

describe("lessonBlocks (saved lessons)", () => {
  it("rebuilds a pre-blocks lesson in its original order", () => {
    const legacy = legacyLesson() as Lesson;
    assert.deepEqual(kinds(legacy), ["activity", "explain", "explain", "check", "check", "check"]);
    const checks = lessonBlocks(legacy).filter((b) => b.kind === "check");
    assert.deepEqual(checks.map((b) => b.kind === "check" && b.ref), [0, 1, 2]);
  });

  it("handles a lesson with neither concepts nor activities", () => {
    assert.deepEqual(kinds({ title: "t", objective: "o", estimatedMinutes: 5, questions: [question(1)] }), ["check"]);
  });
});

describe("JSON schemas (strict structured output)", () => {
  // Strict mode requires every property to be listed as required.
  const strictOk = (schema: { properties: Record<string, unknown>; required: string[] }) =>
    assert.deepEqual([...schema.required].sort(), Object.keys(schema.properties).sort());

  it("lists every property as required", () => {
    strictOk(lessonJsonSchema);
    strictOk(lessonJsonSchema.properties.blocks.items);
    strictOk(lessonJsonSchema.properties.blocks.items.properties.items.items);
    strictOk(activityJsonSchema);
  });
});

describe("toModelFormat (what the reviser sees)", () => {
  it("round-trips a lesson through the model's format without losing anything", () => {
    for (const raw of [rawProgrammingLesson(), rawHistoryLesson()]) {
      const { lesson } = valid(raw);
      const again = valid(toModelFormat(lesson));
      assert.deepEqual(again.lesson, lesson);
      assert.deepEqual(again.report, { droppedBlocks: 0, droppedActivities: 0, droppedQuestions: 0, placedChecks: 0 });
    }
  });

  it("round-trips every activity type", () => {
    const { lesson } = valid(rawHistoryLesson());
    const all = [
      { type: "predict", title: "p", prompt: "q", reveal: "r", afterConcept: 0, options: [{ text: "a", correct: true, feedback: "f" }, { text: "b", correct: false, feedback: "f" }, { text: "c", correct: false, feedback: "f" }] },
      { type: "sort", title: "s", prompt: "", reveal: "", afterConcept: 0, buckets: ["X", "Y"], items: ["1", "2", "3", "4"].map((t, i) => ({ text: t, bucket: i % 2 ? "Y" : "X" })) },
      { type: "order", title: "o", prompt: "", reveal: "", afterConcept: 0, steps: ["a", "b", "c"] },
      { type: "chart", title: "c", prompt: "", reveal: "", afterConcept: 0, unit: "km", bars: [1, 2, 3].map((v) => ({ label: `L${v}`, value: v, note: "" })) },
      { type: "simulation", title: "m", prompt: "", reveal: "", afterConcept: 0, slider: { label: "x", min: 0, max: 10, step: 1, unit: "", initial: 2 }, bands: [{ upTo: 5, title: "low", detail: "" }, { upTo: 10, title: "high", detail: "" }] },
      { type: "diagram", title: "d", prompt: "", reveal: "", afterConcept: 0, nodes: ["a", "b", "c"].map((l) => ({ label: l, detail: "" })), edges: [{ from: 0, to: 1, label: "x" }, { from: 1, to: 2, label: "y" }] },
      { type: "listen", title: "l", prompt: "", reveal: "", afterConcept: 0, script: "one two three four five six seven eight nine ten eleven twelve thirteen" },
      { type: "sound", title: "n", prompt: "", reveal: "", afterConcept: 0, clips: [{ label: "C", notes: ["C4", "E4", "G4"], detail: "" }] },
      {
        type: "graph",
        title: "g",
        prompt: "",
        reveal: "",
        afterConcept: 0,
        expression: "k*x^2",
        slider: { label: "Stretch", min: 1, max: 3, step: 0.5, unit: "", initial: 1 },
        bands: [{ upTo: 2, title: "gentle", detail: "" }, { upTo: 3, title: "steep", detail: "" }],
        axis: { xLabel: "x", yLabel: "y", xMin: -3, xMax: 3, yMin: 0, yMax: 20 },
      },
    ] as Lesson["activities"];
    for (const a of all!) {
      const withOne: Lesson = { ...lesson, activities: [a], blocks: [...lesson.blocks!.filter((b) => b.kind !== "activity"), { kind: "activity", ref: 0 }] };
      const again = valid(toModelFormat(withOne));
      assert.deepEqual(again.lesson.activities, [a], a.type);
    }
  });
});

// ---------- problem blocks (typed answers) ----------

const rawProblem = (o: Record<string, unknown> = {}) => ({
  kind: "problem",
  heading: "Discount",
  body: "A $40 jacket is 25% off. What do you pay?",
  aside: "25% of 40 is 10, so you pay 40 - 10 = 30.",
  ref: 0,
  language: "",
  code: "",
  mode: "",
  columns: [],
  items: [
    { label: "", text: "10", detail: "That's the discount itself, not the price you pay.", correct: false, line: 0 },
    { label: "", text: "30", detail: "A trap that equals the answer is contradictory.", correct: false, line: 0 },
  ],
  hints: ["Find 25% of 40 first."],
  answers: ["30"],
  unit: "$",
  ...o,
});

describe("typed answers", () => {
  it("parses the numbers people type", () => {
    assert.equal(parseNumber("1,200"), 1200);
    assert.equal(parseNumber("3/4"), 0.75);
    assert.equal(parseNumber(" 12 cm"), 12);
    assert.equal(parseNumber("-0.5"), -0.5);
    assert.equal(parseNumber(".5"), 0.5);
    assert.equal(parseNumber("2e3"), 2000);
    assert.ok(Number.isNaN(parseNumber("about ten")));
    assert.ok(Number.isNaN(parseNumber("1/0")));
  });

  it("matches integers exactly, decimals within 1%, text after normalizing", () => {
    assert.ok(answerMatches("30", "30"));
    assert.ok(answerMatches("$30", "30"), "a currency symbol in front is fine");
    assert.ok(answerMatches("-$5", "-5"));
    assert.ok(answerMatches("30 dollars", "30"));
    assert.ok(!answerMatches("29.9", "30"), "integer answers need the exact integer");
    assert.ok(answerMatches("3.1416", "3.14"));
    assert.ok(!answerMatches("3.2", "3.14"));
    assert.ok(answerMatches("0.75", "3/4"));
    assert.ok(answerMatches("3/4", "0.75"));
    assert.ok(answerMatches(" Photosynthesis. ", "photosynthesis"));
    assert.ok(!answerMatches("respiration", "photosynthesis"));
    assert.ok(answerMatches("2, 0, 14", "(2,0,14)"), "spacing and enclosing brackets don't count");
    assert.ok(answerMatches("(2,0,14)", "(2, 0, 14)"));
    assert.ok(answerMatches("[a; b]", "a;b"));
    assert.ok(!answerMatches("2, 14", "(2,0,14)"));
    assert.ok(!answerMatches("f(x)", "f"), "only brackets around the whole answer are dropped");
  });

  it("validates a problem block and drops traps that contradict the answer", () => {
    const b = normalizeBlock(rawProblem());
    assert.ok(b && b.kind === "problem");
    assert.deepEqual(b.answers, ["30"]);
    assert.deepEqual(b.traps.map((t) => t.answer), ["10"]);
    assert.equal(b.unit, "$");
  });

  it("gives feedback aimed at the mistake behind a likely wrong answer", () => {
    const b = normalizeBlock(rawProblem()) as Extract<Block, { kind: "problem" }>;
    assert.deepEqual(checkProblem(b, "30"), { correct: true, feedback: null });
    assert.deepEqual(checkProblem(b, "10"), { correct: false, feedback: "That's the discount itself, not the price you pay." });
    assert.deepEqual(checkProblem(b, "35"), { correct: false, feedback: null });
  });

  it("rejects a problem with no answer or no worked solution", () => {
    assert.equal(normalizeBlock(rawProblem({ answers: [] })), null);
    assert.equal(normalizeBlock(rawProblem({ aside: "" })), null);
    assert.equal(normalizeBlock(rawProblem({ body: "" })), null);
  });

  it("counts as hands-on and round-trips through the model format", () => {
    const raw = rawHistoryLesson();
    // Replace the reflection with a problem: the lesson still has enough hands-on blocks.
    raw.blocks = raw.blocks.map((b) => (b.kind === "reflect" ? (rawProblem() as unknown as typeof b) : b));
    const { lesson } = valid(raw);
    assert.ok(lesson.blocks!.some((b) => b.kind === "problem"));
    assert.deepEqual(valid(toModelFormat(lesson)).lesson, lesson);
  });
});
