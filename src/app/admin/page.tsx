import { BookOpen, TriangleAlert, Users, Wallet } from "lucide-react";
import { type Attention, Card, ChartCard, DayChart, NeedsAttention, Section, Stats, num, usd } from "@/components/admin/ui";
import { allMessages, allRatings, byDay, count, isRecent, daysAgo, isLessonRun, isStale, listJobs, listUsers, requireAdmin, spendByDay, spendSince, sumCost } from "@/lib/admin";

// The overview: four numbers, what needs a look, and four charts. Everything
// else has its own tab (Money, Learners, Problems …).

const WINDOW = 30;

export default async function AdminOverview() {
  const me = await requireAdmin();
  const [users, runs, jobs, reportsThisWeek, messages, ratings] = await Promise.all([
    listUsers(),
    spendSince(daysAgo(WINDOW)),
    listJobs(100),
    count("lesson_reports", { since: daysAgo(7) }),
    allMessages(),
    allRatings(),
  ]);
  const unanswered = messages.filter((m) => !m.resolved_at).length;
  const downThisWeek = ratings.filter((r) => r.rating < 0 && isRecent(r.updated_at, 7)).length;

  const today = runs.filter((r) => isRecent(r.created_at, 1));
  const lessons = runs.filter(isLessonRun);
  // Learners with an account now (throwaway test accounts are deleted after use).
  const accounts = new Set(users.map((u) => u.id));
  const active = new Set(runs.map((r) => r.learner_id).filter((id) => accounts.has(id))).size;
  const failedToday = today.filter((r) => !r.ok);
  const stuck = jobs.filter(isStale);
  const failedJobs = jobs.filter((j) => j.status === "failed" && isRecent(j.updated_at, 1));

  const failed = runs.filter((r) => !r.ok);
  const costDays = spendByDay(runs, WINDOW);
  const lessonDays = byDay(lessons, WINDOW, (r) => r.created_at);
  const signupDays = byDay(users, WINDOW, (u) => u.createdAt);
  const failedDays = byDay(failed, WINDOW, (r) => r.created_at);
  // The tiles' mini charts: the last two weeks, from the first day with data (at least a week).
  const last14 = (days: { value: number }[]) => {
    const recent = days.slice(-14).map((d) => d.value);
    const first = recent.findIndex((v) => v > 0);
    return recent.slice(Math.max(0, Math.min(first < 0 ? recent.length : first, recent.length - 7)));
  };

  const attention: Attention[] = [];
  if (failedJobs.length)
    attention.push({
      tone: "bad",
      title: `${failedJobs.length} lesson${failedJobs.length === 1 ? "" : "s"} couldn't be written today`,
      detail: "The learner saw an error and had to try again.",
      href: "/admin/problems?tab=queue",
    });
  if (stuck.length)
    attention.push({ tone: "bad", title: `${stuck.length} lesson${stuck.length === 1 ? " is" : "s are"} stuck`, detail: "Being written for over 6 minutes.", href: "/admin/problems?tab=queue" });
  if (failedToday.length)
    attention.push({
      tone: "warn",
      title: `${failedToday.length} AI job${failedToday.length === 1 ? "" : "s"} failed today`,
      detail: "Mostly scenes or map paintings; lessons still work without them.",
      href: "/admin/problems",
    });
  if (reportsThisWeek)
    attention.push({ tone: "warn", title: `${reportsThisWeek} mistake report${reportsThisWeek === 1 ? "" : "s"} this week`, detail: "Learners flagged something in a lesson.", href: "/admin/problems?tab=reports" });

  if (unanswered)
    attention.push({ tone: "warn", title: `${unanswered} message${unanswered === 1 ? "" : "s"} waiting for an answer`, detail: "Sent from the Help page.", href: "/admin/problems?tab=messages" });
  if (downThisWeek)
    attention.push({ tone: "warn", title: `${downThisWeek} lesson${downThisWeek === 1 ? "" : "s"} rated down this week`, detail: "Learners said what was off.", href: "/admin/problems?tab=ratings" });

  return (
    <>
      <Welcome
        name={users.find((u) => u.id === me.id)?.name?.split(" ")[0] ?? me.email?.split("@")[0] ?? "there"}
        today={{ cost: sumCost(today), lessons: today.filter(isLessonRun).length, signups: users.filter((u) => isRecent(u.createdAt, 1)).length, failed: failedToday.length }}
      />
      <h2 className="mt-10 text-lg font-semibold text-fg">The last {WINDOW} days</h2>

      <div className="mt-3">
        <Stats
          items={[
            { label: "AI cost", icon: Wallet, value: usd(sumCost(runs)), sub: `${usd(sumCost(today))} in the last 24 hours`, href: "/admin/money", spark: last14(costDays) },
            { label: "Active learners", icon: Users, value: num(active), sub: `of ${num(users.length)} accounts`, href: "/admin/users", spark: last14(signupDays) },
            { label: "Lessons written", icon: BookOpen, value: num(lessons.length), sub: lessons.length ? `about ${usd(sumCost(lessons) / lessons.length)} each to write` : "none yet", spark: last14(lessonDays) },
            { label: "Failed AI jobs", icon: TriangleAlert, value: num(failed.length), sub: `${failedToday.length} in the last 24 hours`, href: "/admin/problems", spark: last14(failedDays) },
          ]}
        />
      </div>

      <Section title="Needs attention">
        <NeedsAttention items={attention} />
      </Section>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <ChartCard title="AI cost per day" total={usd(sumCost(runs))} sub={`last ${WINDOW} days`} href="/admin/money">
          <DayChart bare days={costDays} format="usd" noun="AI cost" />
        </ChartCard>
        <ChartCard title="Lessons written per day" total={num(lessons.length)} sub={`last ${WINDOW} days`} href="/admin/runs?kind=learn">
          <DayChart bare days={lessonDays} noun="lessons" />
        </ChartCard>
        <ChartCard title="New sign-ups per day" total={num(signupDays.reduce((n, d) => n + d.value, 0))} sub={`last ${WINDOW} days`} href="/admin/users">
          <DayChart bare days={signupDays} noun="sign-ups" />
        </ChartCard>
        <ChartCard title="Failed AI jobs per day" total={num(failed.length)} sub={`last ${WINDOW} days`} href="/admin/problems">
          <DayChart bare days={failedDays} noun="failed" />
        </ChartCard>
      </div>

      <Card className="mt-10 p-5 text-[14px] leading-relaxed text-muted">
        <b className="text-fg">Words used here.</b> An <b className="text-fg">AI job</b> is one piece of work the AI did: writing a lesson, adding its scenes, or
        painting a course map. <b className="text-fg">AI cost</b> is what OpenRouter charged for it. <b className="text-fg">Active learners</b> are people the AI did
        work for in the period.
      </Card>
    </>
  );
}

/** The greeting: who's here, over a strip of the painted course world, with today in one line. */
function Welcome({ name, today }: { name: string; today: { cost: number; lessons: number; signups: number; failed: number } }) {
  const plural = (n: number, one: string, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`;
  return (
    <section className="relative isolate overflow-hidden rounded-3xl bg-navy px-6 py-8 text-white shadow-md sm:px-9 sm:py-10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/art/landing/hero-2400.webp" alt="" className="absolute inset-0 -z-20 h-full w-full object-cover object-[center_62%]" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-navy via-navy/85 to-navy/10" />
      <p className="text-[13px] font-medium tracking-wide text-accent-on-dark uppercase">Wondersity admin</p>
      <h1 className="mt-2 font-display text-3xl sm:text-4xl">Welcome back, {name}.</h1>
      <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/80">
        Today so far: {usd(today.cost)} of AI, {plural(today.lessons, "lesson")} written, {plural(today.signups, "new learner")}
        {today.failed ? `, and ${plural(today.failed, "AI job")} that failed` : ", and nothing failed"}.
      </p>
    </section>
  );
}
