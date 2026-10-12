import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkFacts } from "./factCheck";
import type { Lesson } from "./lessonBlocks";

const lesson = (...texts: string[]) => ({ blocks: texts.map((text) => ({ kind: "explain", text })) }) as unknown as Lesson;

describe("checkFacts", () => {
  it("finds a wrong sum", () => {
    const [issue] = checkFacts(lesson("So 3.50 + 2.00 + 1.25 + 4.75 = 19.00 in total."));
    assert.match(issue, /11\.5/);
  });

  it("follows a running total to the step that goes wrong (a real sample lesson)", () => {
    const issues = checkFacts(lesson("total = 19.00: 0 + 3.50 = 3.50, + 2.00 = 5.50, + 1.25 = 6.75, + 4.75 = 19.00."));
    assert.deepEqual(issues, ['blocks[0].text: running total "6.75 + 4.75 = 19.00" is wrong; it is 11.5.']);
  });

  it("checks every part of a chain", () => {
    assert.equal(checkFacts(lesson("2 × 3600 + 5 × 60 + 30 = 7200 + 300 + 30 = 7230")).length, 1);
    assert.equal(checkFacts(lesson("0.5 × 0.4 × 0.5 = 0.2 × 0.5 = 0.2")).length, 1);
  });

  it("checks a fraction on the right", () => {
    assert.equal(checkFacts(lesson("12/90 = 3/15")).length, 1);
  });

  it("checks a share stated as a percentage", () => {
    assert.equal(checkFacts(lesson("11.5 sous out of a 25-sous wage is 60% of it.")).length, 1);
    assert.deepEqual(checkFacts(lesson("11.5 sous out of a 25-sous wage is about 46%.")), []);
  });

  it("accepts correct arithmetic, rounding, currency and scientific notation", () => {
    assert.deepEqual(
      checkFacts(
        lesson(
          "14 ÷ 25 = 0.56, so 56%.",
          "$1,200 × 3 = $3,600.",
          "2/3 = 0.67",
          "r = 7.96 x 10^14 / 9.00 x 10^16 = 8.9 x 10^-3 m",
          "6 × 7 = 42.",
          "So 12/90 = 2/15 of the draws.",
          // Real Opus sample lessons that an earlier version flagged by mistake:
          "P = 0.5 × 0.4 × 0.5 = 0.2 × 0.5 = 0.1",
          "2 × 3600 + 5 × 60 + 30 = 7200 + 300 + 30 = 7530 seconds.",
          "400 ÷ 60 = 6 remainder 40, so the next digit is 40.",
          "In base 60, 1,40 = 100.",
          "r = 2GM / (3.00 x 10^8)^2 = 7.96 x 10^14 / 9.00 x 10^16 = 8.9 x 10^-3 m",
          "R = v^2 / 10 = 225 × 1 / 10 = 22.5 m"
        )
      ),
      []
    );
  });

  it("leaves code comparisons, assignments and trap feedback alone", () => {
    const l = {
      blocks: [
        { kind: "code", code: "if 1 + 1 == 3:\n    total = total + 5" },
        { kind: "problem", traps: [{ answer: "12", feedback: "You did 6 + 6 = 12 instead of 6 × 6." }] },
      ],
    } as unknown as Lesson;
    assert.deepEqual(checkFacts(l), []);
  });
});
