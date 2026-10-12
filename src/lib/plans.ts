// What each plan allows, checked on the server before anything costs money.
// See ECONOMICS.md for where the numbers come from.
//
//   Free: plan any course and take its first 2 lessons; up to 3 new courses
//         in 30 days.
//   Paid ($19.99 a month or $119.99 a year): every lesson, with paintings for
//         30 lessons in 30 days and plain lessons after that; 60 new lessons
//         in 30 days at most (about 2 a day). At ~$0.28 a lesson the monthly
//         plan breaks even near 66 lessons and the yearly near 34, so the cap
//         keeps even the heaviest learner close to paying their way (see
//         ECONOMICS.md). A "Pro Plus" tier for heavier learners may come later.
//
// The limits only apply once billing is set up (Paddle's keys and prices are
// configured). Until then Wondersity is free in beta, as the pricing page says, and
// nobody hits a limit they have no way to lift.

import { env } from "./env";
import type { SubscriptionRow } from "./db";

export const PRICES = {
  monthly: { label: "$19.99", per: "month" },
  yearly: { label: "$119.99", per: "year", monthly: "$10" },
} as const;

export const FREE_LESSONS_PER_COURSE = 2;
export const FREE_COURSES_PER_WINDOW = 3;
export const PAINTED_LESSONS_PER_WINDOW = 30;
export const PAID_LESSONS_PER_WINDOW = 60;
/** Usage is counted over a rolling window, so there's no month boundary or time zone to get wrong. */
export const WINDOW_DAYS = 30;

export const windowStart = (now = new Date()) => new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

/** True once Paddle is configured; until then everything is free. */
export function billingEnabled() {
  return !!(env("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN") && env("NEXT_PUBLIC_PADDLE_PRICE_MONTHLY") && env("NEXT_PUBLIC_PADDLE_PRICE_YEARLY"));
}

export type Plan = {
  tier: "free" | "paid";
  /** Which paid plan, when paid. */
  plan?: "monthly" | "yearly";
  /** When a canceled plan ends, or the next renewal. */
  until?: string | null;
  canceled?: boolean;
};

/** The learner's plan from their subscription row. A canceled plan lasts until its period ends. */
export function planFrom(sub: SubscriptionRow | null, now = new Date()): Plan {
  if (!sub) return { tier: "free" };
  const periodLeft = !!sub.current_period_end && new Date(sub.current_period_end) > now;
  const paid = sub.status === "active" || sub.status === "trialing" || sub.status === "past_due" || (sub.status === "canceled" && periodLeft);
  if (!paid) return { tier: "free" };
  return { tier: "paid", plan: sub.plan, until: sub.current_period_end, canceled: sub.status === "canceled" || !!sub.canceled_at };
}

export type Usage = { lessons: number; painted: number; courses: number };

export type Gate =
  | { ok: true }
  | { ok: false; reason: "free_lessons" | "free_courses" | "paid_lessons"; message: string };

/** Whether a new lesson may be written: module `moduleIndex` of a course (new, or not). */
export function canWriteLesson(plan: Plan, { moduleIndex, newCourse, usage }: { moduleIndex: number; newCourse: boolean; usage: Usage }): Gate {
  if (plan.tier === "paid") {
    return usage.lessons < PAID_LESSONS_PER_WINDOW
      ? { ok: true }
      : { ok: false, reason: "paid_lessons", message: `You've taken ${PAID_LESSONS_PER_WINDOW} new lessons in the last ${WINDOW_DAYS} days, the most a plan allows. More open up as the days pass.` };
  }
  if (newCourse && usage.courses >= FREE_COURSES_PER_WINDOW) {
    return { ok: false, reason: "free_courses", message: `The free plan starts ${FREE_COURSES_PER_WINDOW} new courses every ${WINDOW_DAYS} days. Upgrade to start as many as you like.` };
  }
  if (moduleIndex >= FREE_LESSONS_PER_COURSE) {
    return { ok: false, reason: "free_lessons", message: `The free plan includes the first ${FREE_LESSONS_PER_COURSE} lessons of every course. Upgrade to keep going.` };
  }
  return { ok: true };
}

/** Whether a lesson's scenes may be painted; past the allowance, lessons are staged without new paintings. */
export function canPaint(plan: Plan, usage: Usage) {
  const allowance = plan.tier === "paid" ? PAINTED_LESSONS_PER_WINDOW : FREE_COURSES_PER_WINDOW * FREE_LESSONS_PER_COURSE;
  return usage.painted < allowance;
}
