/* eslint-disable @next/next/no-img-element */
import { A, Badge, num, PageHead, Section, Stats, Table, Time } from "@/components/admin/ui";
import { cacheStats, coursesPerPlan, daysAgo, listPlans, listSharedLessons, requireAdmin, spendSince } from "@/lib/admin";
import { PLANNER_VERSION } from "@/lib/coursePlan";
import { lessonVersion } from "@/lib/lessonWriter";

// The shared cache: course plans reused across learners, and the lessons on
// their mistake-free path. Rows from an older planning guide or lesson
// version are kept but no longer served.

export default async function AdminCache() {
  await requireAdmin();
  const [plans, lessons, uses, runs] = await Promise.all([listPlans(), listSharedLessons(), coursesPerPlan(), spendSince(daysAgo(30))]);
  const currentLessons = lessonVersion();
  const cache = cacheStats(runs);
  const live = lessons.filter((l) => l.lesson_version === currentLessons);

  return (
    <>
      <PageHead title="Saved for reuse" sub="Course plans and lessons written once and given free to the next learner on the same topic. A saved item stops being used when the lesson-writing instructions or models change (shown as “out of date”)." />
      <div className="mt-8">
        <Stats
          items={[
            { label: "Saved course plans", value: num(plans.length), sub: `${plans.filter((p) => p.planner_version === PLANNER_VERSION).length} still in use` },
            { label: "Saved lessons", value: num(lessons.length), sub: `${live.length} still in use` },
            { label: "Plans reused, 30 days", value: num(cache.plan.exact + cache.plan.similar), sub: `${cache.plan.miss} new courses had to be planned` },
            { label: "Lessons reused, 30 days", value: num(cache.lesson.hit), sub: `${cache.lesson.miss} had to be written` },
          ]}
        />
      </div>

      <Section title="Saved course plans">
        <Table
          rows={plans}
          rowKey={(p) => p.topic_key}
          columns={[
            { label: "", cell: (p) => (p.cover_url ? <img src={p.cover_url} alt="" className="h-9 w-16 rounded-md object-cover" /> : null), className: "w-20" },
            {
              label: "Plan",
              cell: (p) => (
                <div>
                  <A href={`/admin/cache/${encodeURIComponent(p.topic_key)}`}>{p.title}</A>
                  <div className="text-[12px] text-muted">key: {p.topic_key}</div>
                </div>
              ),
            },
            { label: "Modules", align: "right", cell: (p) => p.modules.length },
            {
              label: "Lessons saved",
              align: "right",
              cell: (p) => {
                const mine = lessons.filter((l) => l.plan_key === p.topic_key);
                const cur = mine.filter((l) => l.lesson_version === currentLessons).length;
                return `${cur} of ${p.modules.length}${mine.length > cur ? ` (+${mine.length - cur} out of date)` : ""}`;
              },
            },
            { label: "Learners using it", align: "right", cell: (p) => uses.get(p.topic_key) ?? 0 },
            { label: "Status", cell: (p) => (p.planner_version === PLANNER_VERSION ? <Badge tone="good">in use</Badge> : <Badge tone="warn">out of date</Badge>) },
            { label: "Updated", cell: (p) => <Time iso={p.updated_at} /> },
          ]}
        />
      </Section>

      <Section title="Saved lessons" sub="The score is the quality review’s, out of 10.">
        <Table
          rows={[...lessons].sort((a, b) => a.plan_key.localeCompare(b.plan_key) || a.module_index - b.module_index)}
          rowKey={(l) => `${l.plan_key}-${l.module_index}-${l.lesson_version}`}
          columns={[
            { label: "Course", cell: (l) => plans.find((p) => p.topic_key === l.plan_key)?.title ?? l.plan_key },
            { label: "Lesson", align: "right", cell: (l) => l.module_index + 1 },
            { label: "Score", align: "right", cell: (l) => Number(l.score).toFixed(1) },
            { label: "Status", cell: (l) => (l.lesson_version === currentLessons ? <Badge tone="good">in use</Badge> : <Badge tone="warn">out of date</Badge>) },
            { label: "Saved", cell: (l) => <Time iso={l.created_at} /> },
          ]}
        />
      </Section>
    </>
  );
}
