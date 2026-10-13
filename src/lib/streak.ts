// Streaks: consecutive days, in the learner's own time zone, on which they
// finished at least one lesson. The streak still counts until the end of a day
// they haven't learned on yet (so it doesn't look broken in the morning).
// Pure functions only.

/** A date as YYYY-MM-DD in a time zone (UTC if the zone is missing or unknown). */
export function dayIn(date: Date, timeZone?: string | null) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timeZone || "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

const previousDay = (day: string) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

/** The streak and whether today already counts, from the times lessons were finished. */
export function streakFrom(completedAt: string[], timeZone?: string | null, now = new Date()) {
  const days = new Set(completedAt.map((t) => dayIn(new Date(t), timeZone)));
  const today = dayIn(now, timeZone);
  const doneToday = days.has(today);
  let cursor = doneToday ? today : previousDay(today);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = previousDay(cursor);
  }
  return { streak, doneToday, today };
}

/** Streak lengths worth a notification. */
export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365];

/** The local hour in a time zone, for sending reminders in the evening. */
export function hourIn(date: Date, timeZone?: string | null) {
  try {
    return Number(new Intl.DateTimeFormat("en-GB", { timeZone: timeZone || "UTC", hour: "2-digit", hourCycle: "h23" }).format(date));
  } catch {
    return date.getUTCHours();
  }
}
