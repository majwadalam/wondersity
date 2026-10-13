/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import { A, Badge, Card, Json, PageHead, RunStatus, Section, Stats, Table, Time, duration, usd } from "@/components/admin/ui";
import { attemptsFor, getCourse, getUser, requireAdmin, selectAll, sumCost, type RunRow } from "@/lib/admin";

// One course: its plan, each module's lesson with its score and answers, and
// every run that worked on it.

export default async function AdminCourse({ params }: PageProps<"/admin/courses/[id]">) {
  await requireAdmin();
  const id = Number((await params).id);
  const course = Number.isInteger(id) ? await getCourse(id) : null;
  if (!course) notFound();
  const lessonIds = course.lessons.map((l) => l.id);
  const [user, attempts, runs] = await Promise.all([
    getUser(course.learner_id),
    attemptsFor({ lessons: lessonIds }),
    selectAll<RunRow>("runs", "id, learner_id, kind, topic, lesson_id, outcome, ok, error, ms, cost_usd, calls, tokens_in, tokens_out, created_at", ["learner_id", course.learner_id]),
  ]);
  // Runs that belong to this course: its lessons' runs, and learn/cover runs on its topic.
  const mine = runs
    .map((r) => ({ ...r, cost_usd: Number(r.cost_usd) }))
    .filter((r) => (r.lesson_id && lessonIds.includes(r.lesson_id)) || (!r.lesson_id && r.topic === course.topic))
    .reverse();
  const byModule = new Map(course.lessons.map((l) => [l.module_index, l]));
  const answers = (lessonId: number) => attempts.filter((a) => a.lesson_id === lessonId);

  return (
    <>
      <p className="text-sm">
        <A href="/admin/courses">← Courses</A>
      </p>
      <PageHead
        title={course.title}
        sub={
          <>
            For <A href={`/admin/users/${course.learner_id}`}>{user?.email ?? course.learner_id.slice(0, 8)}</A> · asked “{course.topic}” · created <Time iso={course.created_at} />
          </>
        }
      >
        <div className="flex gap-2">
          {course.intake ? <Badge tone="accent">tailored</Badge> : course.plan_key ? <Badge>reused plan</Badge> : <Badge>planned for them</Badge>}
          <Badge tone={course.status === "completed" ? "good" : "muted"}>{course.status}</Badge>
        </div>
      </PageHead>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <Stats
          items={[
            { label: "Lessons finished", value: `${course.lessons.filter((l) => l.completed_at).length} / ${course.modules.length}` },
            { label: "On lesson", value: `${course.current_module + 1} of ${course.modules.length}` },
            { label: "Checks right first time", value: attempts.length ? `${Math.round((100 * attempts.filter((a) => a.correct).length) / attempts.length)}%` : "–", sub: `${attempts.length} graded` },
            { label: "AI cost", value: usd(sumCost(mine)), sub: `${mine.length} jobs` },
          ]}
        />
        {course.cover_url && <img src={course.cover_url} alt="" className="h-full max-h-40 w-full rounded-2xl object-cover ring-1 ring-line" />}
      </div>

      <p className="mt-6 max-w-3xl text-[15px] text-muted">{course.description}</p>

      <Section title="Lessons" sub="Quality is the AI review's score, out of 10.">
        <Table
          rows={course.modules.map((m, i) => ({ ...m, i, lesson: byModule.get(i) }))}
          rowKey={(m) => m.i}
          columns={[
            { label: "#", cell: (m) => m.i + 1 },
            { label: "Level", cell: (m) => <span className="text-[13px] text-muted">{m.level?.title ?? "–"}</span> },
            {
              label: "Lesson",
              cell: (m) => (
                <div>
                  {m.lesson ? <A href={`/admin/lessons/${m.lesson.id}`}>{m.title}</A> : <span>{m.title}</span>}
                  {m.goal && <div className="text-[12px] text-muted">{m.goal}</div>}
                </div>
              ),
            },
            { label: "Quality", align: "right", cell: (m) => (m.lesson?.score != null ? Number(m.lesson.score).toFixed(1) : "–") },
            {
              label: "Checks right",
              cell: (m) => {
                if (!m.lesson) return "–";
                const a = answers(m.lesson.id);
                return a.length ? `${a.filter((x) => x.correct).length} / ${a.length} right` : "–";
              },
            },
            { label: "State", cell: (m) => (m.lesson?.completed_at ? <Badge tone="good">done</Badge> : m.lesson ? <Badge tone="accent">written</Badge> : m.i === course.current_module ? <Badge>next</Badge> : <Badge>planned</Badge>) },
          ]}
        />
      </Section>

      <Section title="AI work on this course">
        <Table
          rows={mine}
          rowKey={(r) => r.id}
          empty="No AI work recorded."
          columns={[
            { label: "", cell: (r) => <A href={`/admin/runs/${r.id}`}>Details</A> },
            { label: "What happened", cell: (r) => <RunStatus kind={r.kind} ok={r.ok} outcome={r.outcome} /> },
            { label: "Lesson no.", cell: (r) => (r.lesson_id ? <A href={`/admin/lessons/${r.lesson_id}`}>#{r.lesson_id}</A> : "–") },
            { label: "Took", align: "right", cell: (r) => duration(r.ms) },
            { label: "Cost", align: "right", cell: (r) => usd(r.cost_usd) },
            { label: "When", cell: (r) => <Time iso={r.created_at} /> },
          ]}
        />
      </Section>

      {(course.intake || course.outcomes) && (
        <Section title="Tailoring">
          <Card className="p-5">
            <Json value={{ intake: course.intake, outcomes: course.outcomes }} />
          </Card>
        </Section>
      )}
    </>
  );
}
