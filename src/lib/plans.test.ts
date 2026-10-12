import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SubscriptionRow } from "./db";
import { FREE_COURSES_PER_WINDOW, FREE_LESSONS_PER_COURSE, PAID_LESSONS_PER_WINDOW, PAINTED_LESSONS_PER_WINDOW, canPaint, canWriteLesson, planFrom } from "./plans";

const now = new Date("2026-10-12T12:00:00Z");
const sub = (over: Partial<SubscriptionRow>): SubscriptionRow => ({
  learner_id: "u1",
  paddle_customer_id: "ctm_1",
  paddle_subscription_id: "sub_1",
  status: "active",
  price_id: "pri_y",
  plan: "yearly",
  current_period_end: "2027-10-12T12:00:00Z",
  canceled_at: null,
  ...over,
});
const usage = (over: Partial<{ lessons: number; painted: number; courses: number }> = {}) => ({ lessons: 0, painted: 0, courses: 0, ...over });

describe("planFrom", () => {
  it("is free without a subscription, and paid while one is active, trialing or past due", () => {
    assert.equal(planFrom(null, now).tier, "free");
    for (const status of ["active", "trialing", "past_due"] as const) assert.equal(planFrom(sub({ status }), now).tier, "paid");
    assert.equal(planFrom(sub({ status: "paused" }), now).tier, "free");
  });

  it("keeps a canceled plan until the end of the paid period", () => {
    assert.deepEqual(planFrom(sub({ status: "canceled", canceled_at: "2026-10-01T00:00:00Z" }), now), {
      tier: "paid",
      plan: "yearly",
      until: "2027-10-12T12:00:00Z",
      canceled: true,
    });
    assert.equal(planFrom(sub({ status: "canceled", current_period_end: "2026-10-01T00:00:00Z" }), now).tier, "free");
  });
});

describe("canWriteLesson", () => {
  const free = { tier: "free" as const };
  const paid = { tier: "paid" as const, plan: "monthly" as const };

  it("gives a free learner the first lessons of each course", () => {
    assert.equal(canWriteLesson(free, { moduleIndex: FREE_LESSONS_PER_COURSE - 1, newCourse: false, usage: usage() }).ok, true);
    const gate = canWriteLesson(free, { moduleIndex: FREE_LESSONS_PER_COURSE, newCourse: false, usage: usage() });
    assert.equal(gate.ok, false);
    assert.equal(!gate.ok && gate.reason, "free_lessons");
  });

  it("limits how many courses a free learner starts", () => {
    const gate = canWriteLesson(free, { moduleIndex: 0, newCourse: true, usage: usage({ courses: FREE_COURSES_PER_WINDOW }) });
    assert.equal(!gate.ok && gate.reason, "free_courses");
    // An existing course's free lessons stay open.
    assert.equal(canWriteLesson(free, { moduleIndex: 0, newCourse: false, usage: usage({ courses: FREE_COURSES_PER_WINDOW }) }).ok, true);
  });

  it("opens every lesson on a paid plan, up to the window's cap", () => {
    assert.equal(canWriteLesson(paid, { moduleIndex: 8, newCourse: true, usage: usage({ courses: 50 }) }).ok, true);
    const gate = canWriteLesson(paid, { moduleIndex: 1, newCourse: false, usage: usage({ lessons: PAID_LESSONS_PER_WINDOW }) });
    assert.equal(!gate.ok && gate.reason, "paid_lessons");
  });
});

describe("canPaint", () => {
  it("paints up to the plan's allowance", () => {
    assert.equal(canPaint({ tier: "paid" }, usage({ painted: PAINTED_LESSONS_PER_WINDOW - 1 })), true);
    assert.equal(canPaint({ tier: "paid" }, usage({ painted: PAINTED_LESSONS_PER_WINDOW })), false);
    assert.equal(canPaint({ tier: "free" }, usage({ painted: FREE_COURSES_PER_WINDOW * FREE_LESSONS_PER_COURSE })), false);
  });
});
