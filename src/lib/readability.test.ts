import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Lesson } from "./lessonBlocks";
import { lintLesson, lintVariety, lessonShape, loopCount, normalizeLesson } from "./lessonDesign";
import { lintReadability, plainText, sentences, words } from "./readability";
import { question, rawHistoryLesson } from "./testFixtures";

const lesson = (blocks: Lesson["blocks"], extra: Partial<Lesson> = {}): Lesson => ({
  version: 2,
  title: "T",
  objective: "O",
  estimatedMinutes: 7,
  approach: "scenario",
  blocks,
  activities: [
    { type: "sort", title: "s", prompt: "Sort these.", reveal: "r", afterConcept: 0, buckets: ["A", "B"], items: [] },
    { type: "scenario", title: "c", prompt: "Pick one.", reveal: "r", afterConcept: 0, options: [] },
    { type: "timeline", title: "t", prompt: "Look.", reveal: "r", afterConcept: 0, events: [] },
  ] as unknown as Lesson["activities"],
  questions: [question(0), question(1), question(2)],
  ...extra,
});
const explain = (body: string, heading = "Step") => ({ kind: "explain" as const, heading, body, example: "" });
const check = (ref: number) => ({ kind: "check" as const, ref, hints: [], retry: "" });
const act = (ref: number) => ({ kind: "activity" as const, ref });

describe("reading text", () => {
  it("leaves out graphs, tables, math and markdown", () => {
    const t = plainText("A **term** with \\(x^2\\).\n| a | b |\n|---|---|\n```graph\ny = x\n```\n- item");
    assert.equal(t.includes("|"), false);
    assert.equal(t.includes("graph"), false);
    assert.equal(t.includes("**"), false);
    assert.deepEqual(words("Hello, world — again."), ["Hello,", "world", "again."]);
  });

  it("splits sentences, lines and list items", () => {
    assert.deepEqual(sentences("One here. Two there!\n- Three"), ["One here.", "Two there!", "Three"]);
  });
});

describe("lintReadability", () => {
  it("passes short, plain steps", () => {
    const l = lesson([explain("You just sorted the cards. Notice the pattern. Each group shares one rule."), act(0), check(0), act(1), check(1)]);
    assert.deepEqual(lintReadability(l), []);
  });

  it("flags a long step, long sentences and many new terms at once", () => {
    const long = Array(12).fill("This sentence keeps adding a clause, and then another clause, and then one more clause so it runs on and on without a break until the reader loses track of where it started").join(". ");
    const issues = lintReadability(lesson([explain(`${long}. **Regression**, **classification**, **features** and **target**.`), act(0), check(0), check(1)]));
    assert.ok(issues.some((i) => i.includes("words of reading")));
    assert.ok(issues.some((i) => i.includes("over 30 words")));
    assert.ok(issues.some((i) => i.includes("4 new terms at once")));
  });

  it("ignores bold labels", () => {
    const issues = lintReadability(lesson([explain("**Typography:** serif. **Color:** warm. **Spacing:** wide."), act(0), check(0), check(1)]));
    assert.equal(issues.some((i) => i.includes("new terms")), false);
  });

  it("flags wordy compare cells and a compare without its point", () => {
    const row = { label: "Hierarchy", a: "Make it engaging.", b: "Lead with the current collection and a shop link, then put the studio story after the products." };
    const issues = lintReadability(lesson([{ kind: "compare", heading: "Two briefs", intro: "Look.", columns: ["Vague", "Directed"], rows: [row, row] }, act(0), check(0), check(1)]));
    assert.ok(issues.some((i) => i.includes("cells that are sentences")));
    assert.ok(issues.some((i) => i.includes("no takeaway")));
  });

  it("flags long check options", () => {
    const q = { ...question(0), options: ["a b c d e f g h i j k l m n o p q r s t", "b", "c", "d"], correctAnswer: "b" };
    const issues = lintReadability(lesson([explain("Short."), act(0), check(0), check(1)], { questions: [q, question(1)] }));
    assert.ok(issues.some((i) => i.includes("long options")));
  });
});

describe("lintVariety", () => {
  // read a bit, do a bit, check: three times (the shape most saved lessons had, 2026-10-13)
  const loop = lesson([explain("a"), act(0), check(0), explain("b"), act(1), check(1), explain("c"), act(2), check(2)]);

  it("counts the read-do-check loop", () => {
    assert.equal(loopCount(lessonShape(loop)), 3);
    assert.ok(lintVariety(loop).some((i) => i.includes("same loop 3 times")));
  });

  it("checks that the sequence shows the approach", () => {
    assert.ok(lintVariety({ ...loop, approach: "socratic" }).some((i) => i.includes("dialogue")));
    assert.ok(lintVariety({ ...loop, approach: "discovery" }).some((i) => i.includes("before anything is explained")));
  });

  it("flags repeating the previous module's opening, ending, activities and rhythm", () => {
    const previous = lessonShape(loop).join(" > ");
    const issues = lintVariety(loop, [previous]);
    assert.ok(issues.some((i) => i.includes("also opened with")));
    assert.ok(issues.some((i) => i.includes("same activities")));
    assert.ok(issues.some((i) => i.includes("same rhythm")));
  });

  it("leaves a lesson with its own shape alone", () => {
    const r = normalizeLesson(rawHistoryLesson());
    assert.ok(r.ok);
    assert.deepEqual(lintVariety(r.lesson, ["explain > act:sort > check > reflect"]), []);
    assert.ok(Array.isArray(lintLesson(r.lesson)));
  });
});
