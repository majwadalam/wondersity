/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import { ActionForm, Field } from "@/components/admin/ActionForm";
import { A, Badge, Card, Details, PageHead, Section, Stats, Table, Time } from "@/components/admin/ui";
import { coursesPerPlan, getPlan, listActions, listSharedLessons, requireAdmin } from "@/lib/admin";
import { PLANNER_VERSION } from "@/lib/coursePlan";
import { lessonVersion } from "@/lib/lessonWriter";
import { removePlan, retire, savePlan, savePlanModule } from "../../actions";

// One shared plan: what new learners on this topic get. Edit its wording and
// lessons, retire a saved lesson so it's written fresh, or stop reusing it.

export default async function AdminPlan({ params }: PageProps<"/admin/cache/[key]">) {
  await requireAdmin();
  const key = decodeURIComponent((await params).key);
  const [plan, saved, uses, history] = await Promise.all([getPlan(key), listSharedLessons(), coursesPerPlan(), listActions({ target: ["plan", key] })]);
  if (!plan) notFound();
  const current = lessonVersion();
  const mine = saved.filter((l) => l.plan_key === key);
  const savedAt = (i: number) => mine.find((l) => l.module_index === i && l.lesson_version === current);
  const modules = plan.modules as { title: string; goal?: string; level?: { title: string } }[];

  return (
    <>
      <p className="text-sm">
        <A href="/admin/cache">← Saved for reuse</A>
      </p>
      <PageHead title={plan.title} sub={<>Given to new learners who ask for “{plan.topic}” · saved <Time iso={plan.created_at} /></>}>
        {plan.planner_version === PLANNER_VERSION ? <Badge tone="good">in use</Badge> : <Badge tone="warn">out of date</Badge>}
      </PageHead>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_300px]">
        <Stats
          items={[
            { label: "Lessons planned", value: modules.length },
            { label: "Lessons saved", value: `${modules.filter((_, i) => savedAt(i)).length} of ${modules.length}`, sub: "given free to the next learner" },
            { label: "Learners using it", value: uses.get(key) ?? 0 },
            { label: "Changes by admins", value: history.total },
          ]}
        />
        {plan.cover_url && <img src={plan.cover_url} alt="" className="hidden h-full max-h-36 w-full rounded-2xl object-cover ring-1 ring-line lg:block" />}
      </div>

      <Section title="Plan details" sub="Courses already made from this plan keep their own copy; this changes it for the next learners.">
        <Card className="max-w-2xl p-5">
          <ActionForm action={savePlan} hidden={{ planKey: key }} submit="Save">
            <Field label="Title" name="title" defaultValue={plan.title} />
            <Field label="Description" name="description" defaultValue={plan.description} textarea />
          </ActionForm>
        </Card>
      </Section>

      <Section title="Lessons" sub="A saved lesson is handed out as is. Retire one to have the next learner's copy written fresh (and saved again).">
        <Card className="divide-y divide-line">
          {modules.map((m, i) => {
            const s = savedAt(i);
            return (
              <div key={i} className="px-4 py-3.5 sm:px-5">
                <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-canvas text-[13px] font-semibold text-muted ring-1 ring-line">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    {m.level?.title && <p className="text-[12px] text-muted">{m.level.title}</p>}
                    <p className="font-medium text-fg">{m.title}</p>
                    {m.goal && <p className="mt-0.5 text-[13px] text-muted">{m.goal}</p>}
                  </div>
                  {s ? <Badge tone="good">saved · quality {Number(s.score).toFixed(1)}</Badge> : <Badge>written per learner</Badge>}
                </div>
                <div className="mt-2 pl-11">
                  <Details summary="Change">
                    <div className="grid gap-4 rounded-xl bg-canvas p-4 ring-1 ring-line md:grid-cols-2">
                      <ActionForm action={savePlanModule} hidden={{ planKey: key, index: i }} submit="Save lesson plan">
                        <Field label="Title" name="title" defaultValue={m.title} />
                        <Field label="Goal" name="goal" defaultValue={m.goal} textarea rows={2} />
                      </ActionForm>
                      <div className="text-[13px] text-muted">
                        {s ? (
                          <ActionForm action={retire} hidden={{ planKey: key, index: i, version: s.lesson_version }} submit="Retire saved lesson" confirm="Yes, retire it" tone="danger">
                            <p className="mb-2">
                              Learners who already have it keep theirs. The next one to reach lesson {i + 1} gets a new lesson, written to the title and goal on the left.
                            </p>
                          </ActionForm>
                        ) : (
                          <p>No saved copy: it&rsquo;s written for each learner, and saved once one passes every check for a learner with no wrong answers.</p>
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

      <Section title="History">
        <Table
          rows={history.actions}
          rowKey={(a) => a.id}
          empty="No one has changed this plan."
          columns={[
            { label: "Change", cell: (a) => a.summary },
            { label: "By", cell: (a) => a.admin_email ?? "–" },
            { label: "When", cell: (a) => <Time iso={a.created_at} /> },
          ]}
        />
      </Section>

      <Section title="Stop reusing this plan">
        <Card className="max-w-2xl p-5">
          <ActionForm action={removePlan} hidden={{ planKey: key }} submit="Stop reusing" confirm="Yes, stop reusing it" tone="danger">
            <p className="mb-3 text-[14px] text-muted">
              Removes the plan and its saved lessons, so the next learner on this topic gets a newly planned course. Learners who already have it keep theirs.
              {uses.get(key) ? ` ${uses.get(key)} learner${uses.get(key) === 1 ? " has" : "s have"} it.` : ""}
            </p>
          </ActionForm>
        </Card>
      </Section>
    </>
  );
}
