import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Lesson } from "./lessonBlocks";
import { gradeRetry, reviewItems } from "./review";

const lesson = {
  version: 2,
  title: "Supply shocks",
  objective: "o",
  estimatedMinutes: 8,
  blocks: [
    { kind: "explain", heading: "h", body: "b" },
    { kind: "check", ref: 0, hints: ["Think about the curve"], retry: "Another way to see it" },
    { kind: "check", ref: 1, hints: [], retry: "" },
  ],
  activities: [],
  questions: [
    { question: "Q1?", options: ["a", "b", "c", "d"], correctAnswer: "b", explanation: "because b" },
    { question: "Q2?", options: ["w", "x", "y", "z"], correctAnswer: "z", explanation: "because z" },
  ],
} as unknown as Lesson;

const row = (attempts: { question_index: number; chosen: string; correct: boolean; created_at: string }[]) => ({
  id: 7,
  course_id: 3,
  module_index: 1,
  lesson_data: lesson,
  attempts,
});

describe("reviewItems", () => {
  it("lists only wrong first answers, without the answer until cleared", () => {
    const items = reviewItems(
      [row([
        { question_index: 0, chosen: "a", correct: false, created_at: "2026-10-01T00:00:00Z" },
        { question_index: 1, chosen: "z", correct: true, created_at: "2026-10-01T00:00:00Z" },
      ])],
      new Map([[3, "Economics"]]),
      new Map()
    );
    assert.equal(items.length, 1);
    assert.equal(items[0].courseTitle, "Economics");
    assert.equal(items[0].lessonNumber, 2);
    assert.deepEqual(items[0].hints, ["Think about the curve"]);
    assert.equal(items[0].answer, null);
    assert.equal(JSON.stringify(items[0]).includes("because b"), false);
  });

  it("shows the answer once cleared, and puts cleared ones last", () => {
    const items = reviewItems(
      [row([
        { question_index: 0, chosen: "a", correct: false, created_at: "2026-10-02T00:00:00Z" },
        { question_index: 1, chosen: "w", correct: false, created_at: "2026-10-01T00:00:00Z" },
      ])],
      new Map(),
      new Map([["7:0", "2026-10-05T00:00:00Z"]])
    );
    assert.deepEqual(items.map((i) => i.questionIndex), [1, 0]);
    assert.deepEqual(items[1].answer, { correct: "b", explanation: "because b" });
    assert.equal(items[0].courseTitle, "Supply shocks");
  });
});

describe("gradeRetry", () => {
  it("a right answer clears it and shows why", () => {
    assert.deepEqual(gradeRetry(lesson, 0, "b"), { correct: true, retry: null, answer: { correct: "b", explanation: "because b" } });
  });
  it("a wrong answer gets the other explanation, not the answer", () => {
    assert.deepEqual(gradeRetry(lesson, 0, "c"), { correct: false, retry: "Another way to see it", answer: null });
  });
  it("asking for the answer shows it without clearing", () => {
    assert.deepEqual(gradeRetry(lesson, 1, "", true), { correct: false, retry: null, answer: { correct: "z", explanation: "because z" } });
  });
  it("rejects an option the question doesn't have", () => {
    assert.equal(gradeRetry(lesson, 0, "not an option"), null);
    assert.equal(gradeRetry(lesson, 9, "a"), null);
  });
});
