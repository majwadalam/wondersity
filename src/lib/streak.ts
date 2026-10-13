// Streaks: consecutive days, in the learner's own time zone, on which they
// finished at least one lesson. The streak still counts until the end of a day
// they haven't learned on yet (so it doesn't look broken in the morning),
// and one missed day a week is forgiven (a streak freeze).
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

const daysApart = (a: string, b: string) => Math.round(Math.abs(Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000);

/** How far apart two bridged days must be: one streak freeze a week. */
export const FREEZE_EVERY_DAYS = 7;

/**
 * The streak and whether today already counts, from the times lessons were
 * finished. A streak freeze is automatic: one missed day is bridged when the
 * learner learned on the day before it and no other day was bridged within a
 * week of it. Bridged days keep the streak going but don't add to it.
 */
export function streakFrom(completedAt: string[], timeZone?: string | null, now = new Date()) {
  const days = new Set(completedAt.map((t) => dayIn(new Date(t), timeZone)));
  const today = dayIn(now, timeZone);
  const doneToday = days.has(today);
  let cursor = doneToday ? today : previousDay(today);
  let streak = 0;
  const frozen: string[] = [];
  for (;;) {
    if (days.has(cursor)) {
      streak++;
      cursor = previousDay(cursor);
      continue;
    }
    const before = previousDay(cursor);
    const last = frozen[frozen.length - 1];
    if (days.has(before) && (!last || daysApart(last, cursor) >= FREEZE_EVERY_DAYS)) {
      frozen.push(cursor);
      cursor = before;
      continue;
    }
    break;
  }
  return { streak, doneToday, today, frozen };
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

/** The day of the week in a time zone, 0 = Sunday (UTC if the zone is unknown). */
export function weekdayIn(date: Date, timeZone?: string | null) {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  try {
    return names.indexOf(new Intl.DateTimeFormat("en-US", { timeZone: timeZone || "UTC", weekday: "short" }).format(date));
  } catch {
    return date.getUTCDay();
  }
}
