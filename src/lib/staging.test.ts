import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeStaging } from "./staging";

const guide = { name: "Seneca", role: "Roman Stoic", manner: "calm, wry", voice: "cedar", portraitPrompt: "a clay bust of a Roman philosopher" };
const images = [{ setting: "Rome", prompt: "a sunlit Roman courtyard with columns" }];
const raw = (steps: { at?: number; image: number; line: string }[]) => ({ guide, images, steps, farewell: "Until next time." });
const step = (at: number) => ({ at, image: 0, line: `Line ${at}` });

describe("normalizeStaging", () => {
  it("places steps by their number, whatever order they come in", () => {
    const r = normalizeStaging(raw([step(2), step(0), step(1), step(3)]), 3);
    assert.ok(r.ok);
    if (r.ok) assert.deepEqual(r.staging.steps.map((s) => s.line), ["Line 0", "Line 1", "Line 2", "Line 3"]);
  });

  it("keeps a lesson whose staging skipped a step: the gap shows the painting without a line (12 of 13 steps)", () => {
    const steps = Array.from({ length: 13 }, (_, i) => step(i)).filter((s) => s.at !== 7);
    const r = normalizeStaging(raw(steps), 12);
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.equal(r.staging.steps.length, 13);
    assert.equal(r.staging.steps[7].line, "");
    assert.equal(r.staging.steps[8].line, "Line 8", "later lines stay on their own blocks");
  });

  it("shifts steps numbered from 1 back to 0", () => {
    const r = normalizeStaging(raw([1, 2, 3, 4].map(step)), 3);
    assert.ok(r.ok);
    if (r.ok) assert.deepEqual(r.staging.steps.map((s) => s.line), ["Line 1", "Line 2", "Line 3", "Line 4"]);
  });

  it("rejects staging missing the intro or too many steps", () => {
    assert.equal(normalizeStaging(raw([1, 2, 3].map(step)), 3).ok, false, "no intro, and not clearly numbered from 1: retried");
    assert.equal(normalizeStaging(raw([0, 5].map(step)), 9).ok, false);
  });

  it("still reads staging without step numbers, in order", () => {
    const r = normalizeStaging(raw([{ image: 0, line: "a" }, { image: 0, line: "b" }]), 1);
    assert.ok(r.ok);
    if (r.ok) assert.deepEqual(r.staging.steps.map((s) => s.line), ["a", "b"]);
  });
});
