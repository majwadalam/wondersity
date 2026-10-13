import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Lesson, Question } from "./lessonBlocks";
import { contentWords, lintQuestions, shuffleOptions } from "./questionCheck";

const q = (question: string, options: string[], correct = 0): Question => ({ question, options, correctAnswer: options[correct], explanation: "" });
const lessonOf = (questions: Question[], hints: string[][] = []) =>
  ({ version: 2, blocks: questions.map((_, ref) => ({ kind: "check", ref, hints: hints[ref] ?? [], retry: "" })), activities: [], questions }) as unknown as Lesson;

// The kind of check the tutor wrote before (a game theory lesson): the right answer is the only
// one that echoes the scenario's key words, and the longest.
const obvious = q("Maya and Leo both want to meet but prefer different places. What kind of game is this coordination problem?", [
  "A coordination game where both players gain from meeting and differ only in where they prefer to meet",
  "A zero-sum game",
  "A game of chance",
  "A prisoner's dilemma",
]);

const fair = q("Two shops each decide whether to cut prices this week. Whatever the other does, each earns more by cutting, yet both earn less when both cut than when neither does. Which game does this match?", [
  "A prisoner's dilemma",
  "A coordination game",
  "A game of pure conflict",
  "A battle of the sexes",
]);

describe("lintQuestions", () => {
  it("flags the longest-answer and word-echo cues", () => {
    const issues = lintQuestions(lessonOf([obvious]));
    assert.ok(issues.some((i) => /longest option/.test(i)), issues.join("\n"));
    assert.ok(issues.some((i) => /repeats the question's wording/.test(i)), issues.join("\n"));
  });

  it("passes a question whose options are alike", () => {
    assert.deepEqual(lintQuestions(lessonOf([fair])), []);
  });

  it("flags all-of-the-above, which-is-true stems, absolute words and leaky hints", () => {
    const issues = lintQuestions(
      lessonOf(
        [
          q("Which of the following is true?", ["Prices rise", "Prices fall", "Prices stay", "All of the above"]),
          q("A ball is dropped on the Moon. How does it fall?", ["Slower, because gravity there is weaker", "It never falls at all", "It always floats away", "Only sideways"]),
          q("Why did the bridge sway?", ["Resonance with the wind's rhythm", "The steel was too heavy", "The river rose", "The paint cracked"]),
        ],
        [[], [], ["Think about resonance and rhythm."]]
      )
    );
    assert.ok(issues.some((i) => /all\/none of the above/.test(i)));
    assert.ok(issues.some((i) => /which of the following is true/.test(i)));
    assert.ok(issues.some((i) => /absolute words/.test(i)));
    assert.ok(issues.some((i) => /a hint uses words found only in the right answer/.test(i)));
  });

  it("flags a typed problem whose answer is in its text", () => {
    const lesson = { ...lessonOf([fair]), blocks: [{ kind: "problem", heading: "Speed", prompt: "A car covers 120 km in 2 hours, so 60 km/h. What is its speed?", answers: ["60"], unit: "km/h", traps: [], hints: [], solution: "" }] } as unknown as Lesson;
    assert.ok(lintQuestions(lesson).some((i) => /already appears/.test(i)));
  });
});

describe("shuffleOptions", () => {
  it("is stable, keeps every option and doesn't depend on the writer's order", () => {
    const [a] = shuffleOptions([fair]);
    const [b] = shuffleOptions([{ ...fair, options: [...fair.options].reverse() }]);
    assert.deepEqual(a.options, b.options);
    assert.deepEqual([...a.options].sort(), [...fair.options].sort());
    assert.equal(a.correctAnswer, fair.correctAnswer);
  });

  it("puts right answers in different places across questions", () => {
    const qs = Array.from({ length: 12 }, (_, i) => q(`Question ${i} about a new situation?`, ["Alpha", "Bravo", "Charlie", "Delta"], i % 4));
    const places = new Set(shuffleOptions(qs).map((x) => x.options.indexOf(x.correctAnswer)));
    assert.ok(places.size >= 3);
  });
});

describe("contentWords", () => {
  it("drops stopwords, short words and plurals", () => {
    assert.deepEqual([...contentWords("The players' choices and payoffs")], ["player", "choice", "payoff"]);
  });
});
