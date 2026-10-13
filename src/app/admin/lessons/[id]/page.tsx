/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import { A, Badge, Card, Details, Json, PageHead, RunStatus, Section, Stats, Table, Time, duration, usd } from "@/components/admin/ui";
import { getLesson, getUser, lessonAttempts, lessonViews, listRuns, requireAdmin, sumCost } from "@/lib/admin";
import { lessonBlocks, type Block, type Lesson } from "@/lib/lessonBlocks";

// One lesson as it was saved: its blocks, its graded checks and how they were
// answered, how far the learner got, and the runs that wrote and staged it.

/** One line describing a block, for the outline. */
function blockLine(b: Block, lesson: Lesson): string {
  switch (b.kind) {
    case "check":
      return lesson.questions[b.ref]?.question ?? `question ${b.ref + 1}`;
    case "activity": {
      const a = lesson.activities?.[b.ref] as { type?: string; title?: string; prompt?: string } | undefined;
      return a ? `${a.type ?? "activity"}: ${a.title ?? a.prompt ?? ""}` : `activity ${b.ref + 1}`;
    }
    default: {
      const r = b as Record<string, unknown>;
      return String(r.heading ?? r.title ?? r.prompt ?? r.problem ?? r.question ?? "");
    }
  }
}

export default async function AdminLesson({ params }: PageProps<"/admin/lessons/[id]">) {
  await requireAdmin();
  const id = Number((await params).id);
  const lesson = Number.isInteger(id) ? await getLesson(id) : null;
  if (!lesson) notFound();
  const data = lesson.lesson_data as unknown as Lesson;
  const [user, attempts, views, { runs }] = await Promise.all([getUser(lesson.learner_id), lessonAttempts(id), lessonViews(id), listRuns({ lesson: id })]);
  const blocks = lessonBlocks(data);
  const furthest = views.reduce((m, v) => Math.max(m, v.step), -1);
  const stepCount = views[0]?.step_count;

  return (
    <>
      <p className="text-sm">{lesson.course_id ? <A href={`/admin/courses/${lesson.course_id}`}>← Course</A> : <A href="/admin/courses">← Courses</A>}</p>
      <PageHead
        title={data.title}
        sub={
          <>
            Module {(lesson.module_index ?? 0) + 1} of “{lesson.topic}” for <A href={`/admin/users/${lesson.learner_id}`}>{user?.email ?? lesson.learner_id.slice(0, 8)}</A> · written <Time iso={lesson.created_at} />
          </>
        }
      >
        <div className="flex flex-wrap gap-2">
          {data.approach && <Badge tone="accent">{data.approach}</Badge>}
          {data.sharedFrom && <Badge>shared lesson</Badge>}
          {data.staging ? <Badge tone="good">staged</Badge> : <Badge>not staged</Badge>}
        </div>
      </PageHead>

      <div className="mt-8">
        <Stats
          items={[
            { label: "Quality score", value: lesson.score != null ? Number(lesson.score).toFixed(1) : "–", sub: "from the AI review, out of 10 (8 passes)" },
            { label: "How far they got", value: furthest >= 0 ? `${furthest + 1}${stepCount ? ` / ${stepCount}` : ""}` : "not opened", sub: lesson.completed_at ? <>finished <Time iso={lesson.completed_at} /></> : "not finished" },
            { label: "Checks right", value: attempts.length ? `${attempts.filter((a) => a.correct).length} / ${attempts.length}` : "–", sub: "first tries only" },
            { label: "AI cost", value: usd(sumCost(runs)), sub: `${runs.length} jobs` },
          ]}
        />
      </div>

      <p className="mt-6 max-w-3xl text-[15px] text-muted">
        <span className="font-medium text-fg">Objective:</span> {data.objective}
        {data.approachReason && (
          <>
            <br />
            <span className="font-medium text-fg">Why this approach:</span> {data.approachReason}
          </>
        )}
      </p>

      <div className="grid gap-x-6 lg:grid-cols-2">
        <Section title="What the lesson does, screen by screen" sub={`${blocks.length} screens, about ${data.estimatedMinutes} minutes.`}>
          <Card>
            <ol className="divide-y divide-line">
              {blocks.map((b, i) => (
                <li key={i} className="flex gap-3 px-4 py-2.5 text-sm">
                  <span className="w-5 shrink-0 text-right text-muted tabular-nums">{i + 1}</span>
                  <Badge tone={b.kind === "check" ? "accent" : "muted"}>{b.kind}</Badge>
                  <span className="min-w-0 text-fg">{blockLine(b, data)}</span>
                </li>
              ))}
            </ol>
          </Card>
        </Section>

        <Section title="Questions" sub="The graded checks. ✓ is the right answer, ✗ what the learner picked if wrong.">
          <div className="space-y-3">
            {data.questions.map((q, i) => {
              const a = attempts.find((x) => x.question_index === i);
              return (
                <Card key={i} className="p-4 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-fg">
                      {i + 1}. {q.question}
                    </p>
                    {a ? <Badge tone={a.correct ? "good" : "bad"}>{a.correct ? "right" : "wrong"}</Badge> : <Badge>unanswered</Badge>}
                  </div>
                  <ul className="mt-2 space-y-1">
                    {q.options.map((o) => (
                      <li key={o} className={o === q.correctAnswer ? "font-medium text-[#0e7a36]" : a?.chosen === o ? "text-bad" : "text-muted"}>
                        {o === q.correctAnswer ? "✓" : a?.chosen === o ? "✗" : "·"} {o}
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>
        </Section>
      </div>

      <Section title="AI work on this lesson" sub="Writing it, then adding its scenes and guide.">
        <Table
          rows={runs}
          rowKey={(r) => r.id}
          empty="No AI work recorded: this lesson was reused from the saved copy, at no cost."
          columns={[
            { label: "", cell: (r) => <A href={`/admin/runs/${r.id}`}>Details</A> },
            { label: "What happened", cell: (r) => <RunStatus kind={r.kind} ok={r.ok} outcome={r.outcome} /> },
            { label: "Took", align: "right", cell: (r) => duration(r.ms) },
            { label: "Cost", align: "right", cell: (r) => usd(r.cost_usd) },
            { label: "When", cell: (r) => <Time iso={r.created_at} /> },
          ]}
        />
      </Section>

      {data.staging && (
        <Section title="Guide">
          <Card className="flex items-center gap-4 p-4">
            {data.staging.guide.portrait && <img src={data.staging.guide.portrait} alt="" className="size-14 rounded-full object-cover" />}
            <div className="text-sm">
              <p className="font-medium text-fg">{data.staging.guide.name}</p>
              <p className="text-muted">
                {data.staging.guide.role} · voice {data.staging.guide.voice}
              </p>
            </div>
          </Card>
        </Section>
      )}

      {!!data.sources?.length && (
        <Section title="Sources that confirmed its claims">
          <Card className="p-4">
            <ul className="space-y-1 text-sm">
              {data.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                    {s.title || s.url}
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        </Section>
      )}

      <Section title="Raw data">
        <Details summary="Show lesson_data JSON">
          <Json value={lesson.lesson_data} className="max-h-[600px]" />
        </Details>
      </Section>
    </>
  );
}
