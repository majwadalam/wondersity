// The weekly recap: on Sunday evening, in the learner's own time zone, what
// they did in the last seven days and what's next. Sent with the daily
// reminder's cron (/api/cron/reminders) to learners who finished at least one
// lesson that week and left reminders on. Pure functions only.

import { weekdayIn, hourIn } from "./streak";

/** Sunday, 17:00 to 21:59 where the learner is. */
export const isRecapTime = (now: Date, timeZone?: string | null) => {
  const hour = hourIn(now, timeZone);
  return weekdayIn(now, timeZone) === 0 && hour >= 17 && hour <= 21;
};

export function weeklyRecap(week: { minutes: number }[], streak: number, next: { course: string; lesson: string } | null) {
  if (week.length === 0) return null;
  const minutes = week.reduce((n, l) => n + (Number.isFinite(l.minutes) && l.minutes > 0 ? l.minutes : 8), 0);
  const parts = [`${week.length} lesson${week.length === 1 ? "" : "s"}`, `about ${minutes} minutes`];
  if (streak > 1) parts.push(`a ${streak}-day streak`);
  const body = `${parts.join(", ")}.${next ? ` Next: ${next.lesson} in ${next.course}.` : ""}`;
  return { title: "Your week on Wondersity", body: body.slice(0, 300) };
}
