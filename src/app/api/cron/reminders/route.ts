import { NextResponse } from "next/server";
import { completionTimes, listPushSubscriptions, markRecapped, markReminded, recapData, reminderCandidates } from "@/lib/db";
import { env } from "@/lib/env";
import { notify } from "@/lib/notify";
import { isRecapTime, weeklyRecap } from "@/lib/recap";
import { dayIn, hourIn, streakFrom } from "@/lib/streak";

// The daily streak reminder, and on Sunday evenings the weekly recap. A scheduled task calls this every hour with
// `Authorization: Bearer $CRON_SECRET` (Coolify: a scheduled task running
// curl). A learner gets one reminder a day, in their evening (18:00-21:59 in
// their time zone), only if they have a streak, haven't learned today, turned
// reminders on and have browser notifications on. The recap (lib/recap.ts)
// goes once a week, Sunday 17:00-21:59 their time, to those who finished a
// lesson that week; it reaches the bell even without browser notifications.

export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = env("CRON_SECRET");
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }
  const now = new Date();
  let sent = 0;
  let checked = 0;
  let recaps = 0;
  for (const p of await reminderCandidates()) {
    if (isRecapTime(now, p.timezone) && p.last_recap_on !== dayIn(now, p.timezone)) {
      const data = await recapData(p.id).catch(() => null);
      const streak = data?.week.length ? streakFrom(await completionTimes(p.id, true).catch(() => [] as string[]), p.timezone, now).streak : 0;
      const recap = data ? weeklyRecap(data.week, streak, data.next) : null;
      if (recap) {
        await notify(p.id, { kind: "recap", ...recap, href: "/progress" }, { asServer: true });
        recaps++;
      }
      await markRecapped(p.id, dayIn(now, p.timezone)).catch(() => {});
    }
    const hour = hourIn(now, p.timezone);
    if (hour < 18 || hour > 21) continue;
    const today = dayIn(now, p.timezone);
    if (p.last_reminded_on === today) continue;
    checked++;
    const subs = await listPushSubscriptions(p.id, true).catch(() => []);
    if (!subs.length) continue;
    const s = streakFrom(await completionTimes(p.id, true).catch(() => [] as string[]), p.timezone, now);
    if (s.streak < 1 || s.doneToday) continue;
    await notify(
      p.id,
      { kind: "reminder", title: `Keep your ${s.streak}-day streak`, body: "One short lesson today keeps it going.", href: "/home" },
      { asServer: true }
    );
    await markReminded(p.id, today).catch(() => {});
    sent++;
  }
  return NextResponse.json({ checked, sent, recaps });
}
