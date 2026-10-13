import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { certificateId } from "./milestones";
import { dayIn, hourIn, streakFrom } from "./streak";

const now = new Date("2026-10-13T15:00:00Z");

describe("streakFrom", () => {
  it("counts consecutive days ending today", () => {
    const s = streakFrom(["2026-10-13T09:00:00Z", "2026-10-12T20:00:00Z", "2026-10-11T08:00:00Z", "2026-10-08T08:00:00Z"], "UTC", now);
    assert.deepEqual(s, { streak: 3, doneToday: true, today: "2026-10-13", frozen: [] });
  });

  it("bridges one missed day with the weekly freeze, without counting it", () => {
    const s = streakFrom(["2026-10-13T09:00:00Z", "2026-10-12T20:00:00Z", "2026-10-11T08:00:00Z", "2026-10-09T08:00:00Z"], "UTC", now);
    assert.deepEqual(s, { streak: 4, doneToday: true, today: "2026-10-13", frozen: ["2026-10-10"] });
  });

  it("bridges a missed yesterday, so the streak survives into today", () => {
    const s = streakFrom(["2026-10-11T08:00:00Z", "2026-10-10T08:00:00Z"], "UTC", now);
    assert.equal(s.streak, 2);
    assert.deepEqual(s.frozen, ["2026-10-12"]);
  });

  it("allows one freeze a week: a second miss within 7 days ends the streak", () => {
    // Learned 13, 12, 10, 9, 7: the 11th is bridged; the 8th is 3 days after it, so it isn't.
    const days = ["2026-10-13", "2026-10-12", "2026-10-10", "2026-10-09", "2026-10-07"].map((d) => `${d}T08:00:00Z`);
    const s = streakFrom(days, "UTC", now);
    assert.equal(s.streak, 4);
    assert.deepEqual(s.frozen, ["2026-10-11"]);
  });

  it("bridges again once a week has passed", () => {
    // Misses on the 11th and the 4th, a week apart.
    const learned = ["13", "12", "10", "09", "08", "07", "06", "05", "03"].map((d) => `2026-10-${d}T08:00:00Z`);
    const s = streakFrom(learned, "UTC", now);
    assert.equal(s.streak, 9);
    assert.deepEqual(s.frozen, ["2026-10-11", "2026-10-04"]);
  });

  it("keeps yesterday's streak alive until today ends", () => {
    const s = streakFrom(["2026-10-12T20:00:00Z", "2026-10-11T08:00:00Z"], "UTC", now);
    assert.equal(s.streak, 2);
    assert.equal(s.doneToday, false);
  });

  it("is broken by two missed days in a row", () => {
    assert.equal(streakFrom(["2026-10-10T08:00:00Z"], "UTC", now).streak, 0);
  });

  it("uses the learner's own day", () => {
    // 23:30 UTC on the 12th is already the 13th in Karachi (UTC+5).
    const s = streakFrom(["2026-10-12T23:30:00Z"], "Asia/Karachi", now);
    assert.equal(s.doneToday, true);
    assert.equal(streakFrom(["2026-10-12T23:30:00Z"], "UTC", now).doneToday, false);
  });

  it("falls back to UTC for an unknown zone", () => {
    assert.equal(dayIn(now, "Not/AZone"), "2026-10-13");
    assert.equal(hourIn(now, "Not/AZone"), 15);
    assert.equal(hourIn(now, "Asia/Karachi"), 20);
  });
});

describe("certificateId", () => {
  it("is 14 unambiguous letters and digits, and different each time", () => {
    const ids = new Set(Array.from({ length: 200 }, () => certificateId()));
    assert.equal(ids.size, 200);
    for (const id of ids) assert.match(id, /^[A-HJ-NP-Za-km-z2-9]{14}$/);
  });
});
