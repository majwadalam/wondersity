import { notFound } from "next/navigation";
import { A, Badge, Card, ChartCard, DayChart, Json, PageHead, RunStatus, Section, Stats, Table, Time, duration, num, usd } from "@/components/admin/ui";
import { adminSupabase } from "@/lib/db";
import { ActionForm } from "@/components/admin/ActionForm";
import { changeRole } from "../../actions";
import { attemptsFor, daysAgo, isAdmin, selectAll, getUser, listCourses, listJobs, listRuns, requireAdmin, spendByDay, spendSince, sumCost } from "@/lib/admin";

// One learner: their account, courses, lessons, runs and what they cost.

export default async function AdminUser({ params }: PageProps<"/admin/users/[id]">) {
  const me = await requireAdmin();
  const { id } = await params;
  // A deleted account (e.g. a seeding script's throwaway learner) still has runs worth seeing.
  const user = await getUser(id);
  if (!user && !/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [profile, sub, courses, { runs, total }, recent, attempts, jobs, admin] = await Promise.all([
    adminSupabase().from("profiles").select("*").eq("id", id).maybeSingle(),
    adminSupabase().from("subscriptions").select("*").eq("learner_id", id).maybeSingle(),
    listCourses(id),
    listRuns({ learner: id }),
    spendSince(daysAgo(30)),
    attemptsFor({ learner: id }),
    listJobs(500),
    isAdmin(id),
  ]);
  const mine = recent.filter((r) => r.learner_id === id);
  const allRuns = await selectAll<{ cost_usd: number }>("runs", "cost_usd", ["learner_id", id]);
  const lifetime = sumCost(allRuns.map((r) => ({ cost_usd: Number(r.cost_usd ?? 0) })));
  const lessons = courses.flatMap((c) => c.lessons);
  const done = lessons.filter((l) => l.completed_at).length;
  const correct = attempts.filter((a) => a.correct).length;
  const myJobs = jobs.filter((j) => j.learner_id === id).slice(0, 10);

  return (
    <>
      <p className="text-sm">
        <A href="/admin/users">← Learners</A>
      </p>
      <PageHead
        title={user ? (user.email ?? id) : "Deleted account"}
        sub={
          <>
            {profile.data?.display_name ?? "No name"} · signed up <Time iso={user?.created_at} /> · last sign-in <Time iso={user?.last_sign_in_at} /> ·{" "}
            <span className="font-mono text-[12px]">{id}</span>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={sub.data ? "good" : "muted"}>{sub.data ? `${sub.data.plan} plan · ${sub.data.status}` : "free plan"}</Badge>
          {admin && <Badge tone="accent">admin</Badge>}
          {user && id !== me.id && (
            <ActionForm
              action={changeRole}
              hidden={{ userId: id, grant: admin ? "0" : "1" }}
              submit={admin ? "Remove admin" : "Make admin"}
              confirm={admin ? "Yes, remove admin" : "Yes, make them an admin"}
              tone="quiet"
            />
          )}
        </div>
      </PageHead>

      <div className="mt-8">
        <Stats
          items={[
            { label: "AI cost, all time", value: usd(lifetime), sub: `${num(allRuns.length)} jobs` },
            { label: "AI cost, last 30 days", value: usd(sumCost(mine)), sub: `${mine.length} jobs` },
            { label: "Lessons finished", value: `${done} of ${lessons.length}`, sub: `in ${courses.length} course${courses.length === 1 ? "" : "s"}` },
            { label: "Checks right first time", value: attempts.length ? `${Math.round((100 * correct) / attempts.length)}%` : "–", sub: `${attempts.length} answers` },
          ]}
        />
      </div>

      <div className="mt-10">
        <ChartCard title="AI cost per day" total={usd(sumCost(mine))} sub="last 30 days">
          <DayChart bare days={spendByDay(mine, 30)} format="usd" noun="AI cost" />
        </ChartCard>
      </div>

      <Section title="Courses">
        <Table
          rows={courses}
          rowKey={(c) => c.id}
          empty="No courses yet."
          columns={[
            { label: "Course", cell: (c) => <A href={`/admin/courses/${c.id}`}>{c.title}</A> },
            { label: "Plan", cell: (c) => (c.intake ? <Badge tone="accent">tailored</Badge> : c.plan_key ? <Badge>reused</Badge> : <Badge>planned for them</Badge>) },
            { label: "Progress", align: "right", cell: (c) => `${c.lessons.filter((l) => l.completed_at).length} / ${c.modules.length}` },
            { label: "Status", cell: (c) => <Badge tone={c.status === "completed" ? "good" : "muted"}>{c.status}</Badge> },
            { label: "Updated", cell: (c) => <Time iso={c.updated_at} /> },
          ]}
        />
      </Section>

      <Section title="AI activity" sub={`${num(total)} jobs in all, newest first.`} action={<A href={`/admin/runs?learner=${id}`}>See all →</A>}>
        <Table
          rows={runs.slice(0, 20)}
          rowKey={(r) => r.id}
          empty="No runs."
          columns={[
            { label: "", cell: (r) => <A href={`/admin/runs/${r.id}`}>Details</A> },
            { label: "What happened", cell: (r) => <RunStatus kind={r.kind} ok={r.ok} outcome={r.outcome} /> },
            { label: "Topic", cell: (r) => r.topic ?? "–" },
            { label: "Time", align: "right", cell: (r) => duration(r.ms) },
            { label: "Cost", align: "right", cell: (r) => usd(r.cost_usd) },
            { label: "When", cell: (r) => <Time iso={r.created_at} /> },
          ]}
        />
      </Section>

      <Section title="Lesson queue" sub="Lessons the server was asked to write for them.">
        <Table
          rows={myJobs}
          rowKey={(j) => j.id}
          empty="No jobs."
          columns={[
            { label: "Topic", cell: (j) => j.topic },
            { label: "Type", cell: (j) => (j.kind === "ahead" ? "Next lesson, early" : "Lesson asked for") },
            { label: "Status", cell: (j) => <Badge tone={j.status === "done" ? "good" : j.status === "failed" ? "bad" : "accent"}>{j.status}</Badge> },
            { label: "Error", cell: (j) => <span className="text-[13px] text-muted">{j.error ?? "–"}</span> },
            { label: "Started", cell: (j) => <Time iso={j.created_at} /> },
          ]}
        />
      </Section>

      <Section title="Account">
        <Card className="grid gap-4 p-5 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted">Profile</h3>
            <Json value={profile.data ?? null} className="max-h-72" />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted">Auth</h3>
            <Json value={{ provider: user?.app_metadata?.provider, providers: user?.app_metadata?.providers, confirmed: user?.email_confirmed_at, subscription: sub.data }} className="max-h-72" />
          </div>
        </Card>
      </Section>
    </>
  );
}
