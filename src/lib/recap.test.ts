import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isRecapTime, weeklyRecap } from "./recap";

describe("weeklyRecap", () => {
  it("is nothing for a week without lessons", () => {
    assert.equal(weeklyRecap([], 0, null), null);
  });
  it("sums the week and names what's next", () => {
    const r = weeklyRecap([{ minutes: 8 }, { minutes: 10 }, { minutes: NaN }], 5, { course: "Stoicism", lesson: "The dichotomy of control" });
    assert.equal(r?.body, "3 lessons, about 26 minutes, a 5-day streak. Next: The dichotomy of control in Stoicism.");
  });
  it("leaves out a one-day streak", () => {
    assert.equal(weeklyRecap([{ minutes: 7 }], 1, null)?.body, "1 lesson, about 7 minutes.");
  });
});

describe("isRecapTime", () => {
  // Sunday 2026-10-11, 18:30 UTC.
  const sunday = new Date("2026-10-11T18:30:00Z");
  it("is Sunday evening where the learner is", () => {
    assert.equal(isRecapTime(sunday, "UTC"), true);
    // Already Monday 00:30 in Karachi.
    assert.equal(isRecapTime(sunday, "Asia/Karachi"), false);
    // 11:30 on Sunday in Los Angeles: too early.
    assert.equal(isRecapTime(sunday, "America/Los_Angeles"), false);
  });
});
