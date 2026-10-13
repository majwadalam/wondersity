import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeLesson, toModelFormat } from "./lessonDesign";
import type { Lesson } from "./lessonBlocks";
import { applyPatch, numbered } from "./lessonPatch";
import { rawHistoryLesson } from "./testFixtures";

const lesson = (() => {
  const r = normalizeLesson(rawHistoryLesson());
  if (!r.ok) throw new Error(r.error);
  return r.lesson as Lesson;
})();
const base = toModelFormat(lesson);
const empty = { kind: "explain", heading: "", body: "", aside: "", ref: 0, language: "", code: "", mode: "", columns: [], items: [], hints: [], answers: [], unit: "" };
const explain = (body: string) => ({ ...empty, body, heading: "New" });

describe("applyPatch", () => {
  it("replaces, inserts and removes blocks by their original index", () => {
    const r = applyPatch(lesson, {
      summary: "s",
      blocks: [
        { op: "replace", at: 0, block: explain("Replaced first") },
        { op: "insert_after", at: 0, block: explain("Inserted after first") },
        { op: "insert_after", at: -1, block: explain("At the start") },
        { op: "remove", at: base.blocks.length - 1, block: empty },
      ],
      questions: [],
      activities: [],
    });
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.deepEqual(r.raw.blocks.slice(0, 3).map((b) => b.body), ["At the start", "Replaced first", "Inserted after first"]);
    assert.equal(r.raw.blocks.length, base.blocks.length + 1);
    assert.deepEqual(r.raw.blocks.slice(3), base.blocks.slice(1, -1));
  });

  it("replaces questions in place and adds new ones at the end", () => {
    const q = { question: "A new situation?", options: ["a", "b", "c", "d"], correctAnswer: "b", explanation: "e" };
    const r = applyPatch(lesson, { summary: "", blocks: [], questions: [{ op: "replace", at: 0, question: q }, { op: "add", at: 99, question: { ...q, question: "Added?" } }], activities: [] });
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.equal(r.raw.questions[0].question, "A new situation?");
    assert.equal(r.raw.questions.length, base.questions.length + 1);
    assert.equal(r.raw.questions.at(-1)!.question, "Added?");
    assert.deepEqual(r.raw.questions.slice(1, -1), base.questions.slice(1));
  });

  it("keeps the rest of the lesson exactly, so it validates as before", () => {
    const r = applyPatch(lesson, { summary: "", blocks: [{ op: "replace", at: 0, block: { ...base.blocks[0], heading: "Sharper heading" } }], questions: [], activities: [] });
    assert.ok(r.ok);
    if (!r.ok) return;
    const again = normalizeLesson(r.raw);
    assert.ok(again.ok);
    if (!again.ok) return;
    assert.equal(again.lesson.questions.length, lesson.questions.length);
    assert.equal(again.lesson.blocks!.length, lesson.blocks!.length);
  });

  it("refuses patches that don't apply", () => {
    for (const bad of [
      { summary: "", blocks: [], questions: [], activities: [] },
      { summary: "", blocks: [{ op: "replace", at: 999, block: empty }], questions: [], activities: [] },
      { summary: "", blocks: [{ op: "replace", at: 0, block: empty }, { op: "remove", at: 0, block: empty }], questions: [], activities: [] },
      { summary: "", blocks: [], questions: [{ op: "replace", at: -1, question: base.questions[0] }], activities: [] },
      null,
    ])
      assert.equal(applyPatch(lesson, bad).ok, false, JSON.stringify(bad));
  });

  it("numbers what the reviser sees", () => {
    const n = numbered(lesson);
    assert.deepEqual(n.blocks.map((b) => b.at), base.blocks.map((_, i) => i));
    assert.equal(n.questions[1].at, 1);
  });
});
