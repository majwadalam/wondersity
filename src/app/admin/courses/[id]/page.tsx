/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import { ActionForm, Field } from "@/components/admin/ActionForm";
import { A, Badge, Card, Details, Explain, PageHead, RunStatus, Section, Stats, Table, Tabs, Time, duration, usd } from "@/components/admin/ui";
import { attemptsFor, getCourse, getUser, listActions, requireAdmin, selectAll, sumCost, type RunRow } from "@/lib/admin";
import { moveTo, removeCourse, rewrite, saveBrief, saveCourse, saveModule } from "../../actions";

// One course: its lessons (with controls to edit, move the learner, or have a
// lesson rewritten), its details, its tailoring brief, the AI work on it and
// every change an admin made.

export default async function AdminCourse({ params, searchParams }: PageProps<"/admin/courses/[id]">) {
  await requireAdmin();
  const id = Number((await params).id);
  const tab = (await searchParams).tab;
  const course = Number.isInteger(id) ? await getCourse(id) : null;
  if (!course) notFound();
  const lessonIds = course.lessons.map((l) => l.id);
  const [user, attempts, runs, history] = await Promise.all([
    getUser(course.learner_id),
    attemptsFor({ lessons: lessonIds }),
    selectAll<RunRow>("runs", "id, learner_id, kind, topic, lesson_id, outcome, ok, error, ms, cost_usd, calls, tokens_in, tokens_out, created_at", ["learner_id", course.learner_id]),
    listActions({ target: ["course", String(id)] }),
  ]);
  // Runs that belong to this course: its lessons' runs, and learn/cover runs on its topic.
  const mine = runs
    .map((r) => ({ ...r, cost_usd: Number(r.cost_usd) }))
    .filter((r) => (r.lesson_id && lessonIds.includes(r.lesson_id)) || (!r.lesson_id && r.topic === course.topic))
    .reverse();
  const byModule = new Map(course.lessons.map((l) => [l.module_index, l]));
  const answers = (lessonId: number) => attempts.filter((a) => a.lesson_id === lessonId);
  const intake = course.intake as { goal?: string; purpose?: string; context?: string; level?: string; known?: string; cover?: string[]; length?: string; materials?: { name: string }[] } | null;
  const t = typeof tab === "string" ? tab : undefined;
  const base = `/admin/courses/${id}`;

  return (
    <>
      <p className="text-sm">
        <A href="/admin/courses">← Courses</A>
      </p>
      <PageHead
        title={course.title}
        sub={
          <>
            For <A href={`/admin/users/${course.learner_id}`}>{user?.email ?? course.learner_id.slice(0, 8)}</A> · asked “{course.topic}” · started <Time iso={course.created_at} />
          </>
        }
      >
        <div className="flex gap-2">
          {intake ? <Badge tone="accent">tailored</Badge> : course.plan_key ? <Badge>reused plan</Badge> : <Badge>planned for them</Badge>}
          <Badge tone={course.status === "completed" ? "good" : "muted"}>{course.status === "completed" ? "finished" : "in progress"}</Badge>
        </div>
      </PageHead>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_300px]">
        <Stats
          items={[
            { label: "Lessons finished", value: `${course.lessons.filter((l) => l.completed_at).length} of ${course.modules.length}` },
            { label: "On lesson", value: `${course.current_module + 1}` },
            { label: "Checks right first time", value: attempts.length ? `${Math.round((100 * attempts.filter((a) => a.correct).length) / attempts.length)}%` : "–", sub: `${attempts.length} answered` },
            { label: "AI cost", value: usd(sumCost(mine)), sub: `${mine.length} jobs` },
          ]}
        />
        {course.cover_url && <img src={course.cover_url} alt="" className="hidden h-full max-h-36 w-full rounded-2xl object-cover ring-1 ring-line lg:block" />}
      </div>

      <div className="mt-8">
        <Tabs
          base={base}
          params={{ tab: t }}
          tabs={[
            { value: undefined, label: "Lessons", count: course.modules.length },
            { value: "edit", label: "Edit" },
            ...(intake ? [{ value: "tailoring", label: "Tailoring" }] : []),
            { value: "work", label: "AI work", count: mine.length },
            { value: "history", label: "History", count: history.total },
          ]}
        />
      </div>

      {!t && (
        <Section title="Lessons" sub="Open “Change” on a lesson to edit it, move the learner there, or have it rewritten.">
          <Card className="divide-y divide-line">
            {course.modules.map((m, i) => {
              const lesson = byModule.get(i);
              const a = lesson ? answers(lesson.id) : [];
              const state = lesson?.completed_at ? "done" : lesson ? "written" : i === course.current_module ? "next" : "planned";
              return (
                <div key={i} className="px-4 py-3.5 sm:px-5">
                  <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                    <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold ${i === course.current_module ? "bg-accent text-white" : "bg-canvas text-muted ring-1 ring-line"}`}>
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      {m.level?.title && <p className="text-[12px] text-muted">{m.level.title}</p>}
                      <p className="font-medium text-fg">{lesson ? <A href={`/admin/lessons/${lesson.id}`}>{m.title}</A> : m.title}</p>
                      {m.goal && <p className="mt-0.5 text-[13px] text-muted">{m.goal}</p>}
                    </div>
                    <div className="flex items-center gap-3 text-[13px] text-muted">
                      {lesson?.score != null && <span title="AI quality review, out of 10">quality {Number(lesson.score).toFixed(1)}</span>}
                      {a.length > 0 && <span>{a.filter((x) => x.correct).length}/{a.length} right</span>}
                      <Badge tone={state === "done" ? "good" : state === "written" ? "accent" : "muted"}>{state === "next" ? "up next" : state}</Badge>
                    </div>
                  </div>
                  <div className="mt-2 pl-11">
                    <Details summary="Change">
                      <div className="grid gap-4 rounded-xl bg-canvas p-4 ring-1 ring-line md:grid-cols-2">
                        {!lesson ? (
                          <ActionForm action={saveModule} hidden={{ courseId: id, index: i }} submit="Save lesson plan">
                            <p className="mb-2 text-[13px] text-muted">Not written yet: the tutor writes it to this title and goal.</p>
                            <Field label="Title" name="title" defaultValue={m.title} />
                            <Field label="Goal" name="goal" defaultValue={m.goal} textarea rows={2} />
                          </ActionForm>
                        ) : (
                          <div className="space-y-2 text-[13px] text-muted">
                            <p>Already written, so its title and goal are what the lesson teaches.</p>
                            {!lesson.completed_at ? (
                              <ActionForm action={rewrite} hidden={{ lessonId: lesson.id, courseId: id }} submit="Rewrite this lesson" confirm="Yes, rewrite it" tone="danger">
                                <p className="mb-2">
                                  Deletes it (and any answers on it); the tutor writes a fresh one when the learner next opens it. Costs one lesson&rsquo;s AI.
                                </p>
                              </ActionForm>
                            ) : (
                              <p>The learner finished it, so it&rsquo;s kept as their record.</p>
                            )}
                          </div>
                        )}
                        <div className="space-y-2 text-[13px] text-muted">
                          {i === course.current_module ? (
                            <p>The learner is on this lesson.</p>
                          ) : (
                            <ActionForm action={moveTo} hidden={{ courseId: id, index: i }} submit="Move the learner here" confirm={`Yes, move them to lesson ${i + 1}`} tone="quiet">
                              <p className="mb-2">Their next lesson becomes this one. Finished lessons stay finished.</p>
                            </ActionForm>
                          )}
                        </div>
                      </div>
                    </Details>
                  </div>
                </div>
              );
            })}
          </Card>
        </Section>
      )}

      {t === "edit" && (
        <>
          <Section title="Course details" sub="What the learner sees as the course's name and description.">
            <Card className="max-w-2xl p-5">
              <ActionForm action={saveCourse} hidden={{ courseId: id }} submit="Save">
                <Field label="Title" name="title" defaultValue={course.title} />
                <Field label="Description" name="description" defaultValue={course.description} textarea />
              </ActionForm>
            </Card>
          </Section>
          <Section title="Delete this course">
            <Card className="max-w-2xl p-5 ring-bad/30">
              <ActionForm action={removeCourse} hidden={{ courseId: id }} submit="Delete course" confirm="Yes, delete it for good" tone="danger">
                <p className="mb-3 text-[14px] text-muted">
                  Removes the course from {user?.email ?? "the learner"}&rsquo;s account with its lessons, answers and certificate. It can&rsquo;t be undone; it&rsquo;s recorded in
                  the activity log.
                </p>
              </ActionForm>
            </Card>
          </Section>
        </>
      )}

      {t === "tailoring" && intake && (
        <>
          <Section title="What the learner asked for" sub="From “Tailor it” when they started the course.">
            <Card className="max-w-3xl p-5">
              <dl className="grid gap-x-6 gap-y-3 text-[14px] sm:grid-cols-[160px_1fr]">
                {(
                  [
                    ["Goal", intake.goal],
                    ["Why", intake.purpose],
                    ["Where they'll use it", intake.context],
                    ["Starting point", intake.level],
                    ["Already knows", intake.known],
                    ["Must cover", intake.cover?.join(" · ")],
                    ["Length", intake.length],
                    ["Their materials", intake.materials?.map((x) => x.name).join(", ")],
                  ] as [string, string | undefined][]
                )
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-muted">{k}</dt>
                      <dd className="text-fg">{v}</dd>
                    </div>
                  ))}
              </dl>
            </Card>
          </Section>
          <Section title="Retailor the rest of the course" sub="Every lesson not written yet is briefed from these. Written lessons stay as they are.">
            <Card className="max-w-3xl p-5">
              <ActionForm action={saveBrief} hidden={{ courseId: id }} submit="Save brief">
                <Field label="Goal" name="goal" defaultValue={intake.goal} textarea rows={2} />
                <Field label="Where they'll use it" name="context" defaultValue={intake.context} textarea rows={2} />
                <Field label="What they already know" name="known" defaultValue={intake.known} textarea rows={2} />
                <Field label="Outcomes" name="outcomes" defaultValue={(course.outcomes ?? []).join("\n")} textarea rows={4} hint="One per line, 1 to 6. Start each with something they'll be able to do." />
              </ActionForm>
            </Card>
          </Section>
        </>
      )}

      {t === "work" && (
        <Section title="AI work on this course">
          <Table
            rows={mine}
            rowKey={(r) => r.id}
            empty="No AI work recorded."
            columns={[
              { label: "What happened", cell: (r) => <RunStatus kind={r.kind} ok={r.ok} outcome={r.outcome} /> },
              { label: "Lesson", cell: (r) => (r.lesson_id ? <A href={`/admin/lessons/${r.lesson_id}`}>#{r.lesson_id}</A> : "–") },
              { label: "Took", align: "right", cell: (r) => duration(r.ms) },
              { label: "Cost", align: "right", cell: (r) => usd(r.cost_usd) },
              { label: "When", cell: (r) => <Time iso={r.created_at} /> },
              { label: "", cell: (r) => <A href={`/admin/runs/${r.id}`}>Details</A> },
            ]}
          />
        </Section>
      )}

      {t === "history" && (
        <Section title="Changes made by admins">
          <Explain>Everything changed on this course from the admin panel, newest first.</Explain>
          <div className="mt-3">
            <Table
              rows={history.actions}
              rowKey={(a) => a.id}
              empty="No one has changed this course."
              columns={[
                { label: "Change", cell: (a) => a.summary },
                { label: "By", cell: (a) => a.admin_email ?? "–" },
                { label: "When", cell: (a) => <Time iso={a.created_at} /> },
              ]}
            />
          </div>
        </Section>
      )}
    </>
  );
}
