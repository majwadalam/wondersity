import { A, Badge, ChartCard, DayChart, num, PageHead, Pager, Table, Tabs, Time, pageParam, paginate, usd } from "@/components/admin/ui";
import { byDay, listUsers, requireAdmin, selectAll } from "@/lib/admin";

// Every account, with how far they've got and what they've cost.

export default async function AdminUsers({ searchParams }: PageProps<"/admin/users">) {
  await requireAdmin();
  const sp = await searchParams;
  const q = String(sp.q ?? "").trim().toLowerCase();
  const tab = typeof sp.tab === "string" ? sp.tab : undefined;
  const params = { tab, q: q || undefined };
  const [users, courses, lessons, runs] = await Promise.all([
    listUsers(),
    selectAll<{ learner_id: string }>("courses", "learner_id"),
    selectAll<{ learner_id: string; completed_at: string | null }>("lessons", "learner_id, completed_at"),
    selectAll<{ learner_id: string; cost_usd: number; created_at: string }>("runs", "learner_id, cost_usd, created_at"),
  ]);
  const tally = <T extends { learner_id: string }>(rows: T[], add: (r: T) => number = () => 1) => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.learner_id, (m.get(r.learner_id) ?? 0) + add(r));
    return m;
  };
  const courseCount = tally(courses);
  const lessonCount = tally(lessons);
  const doneCount = tally(lessons, (r) => (r.completed_at ? 1 : 0));
  const spend = tally(runs, (r) => Number(r.cost_usd ?? 0));
  const lastRun = new Map<string, string>();
  for (const r of runs) if (!lastRun.has(r.learner_id) || r.created_at > lastRun.get(r.learner_id)!) lastRun.set(r.learner_id, r.created_at);

  const groups: Record<string, (u: (typeof users)[number]) => boolean> = {
    admins: (u) => !!u.role,
    paying: (u) => u.plan !== "free",
    unfinished: (u) => !u.onboarded,
  };
  const matching = q ? users.filter((u) => `${u.email} ${u.name} ${u.id}`.toLowerCase().includes(q)) : users;
  const shown = tab && groups[tab] ? matching.filter(groups[tab]) : matching;
  const p = paginate(shown, pageParam(sp.page), 25);

  return (
    <>
      <PageHead title="Learners" sub={`${num(users.length)} accounts, newest first.`}>
        <form className="w-full sm:w-72">
          {tab && <input type="hidden" name="tab" value={tab} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="Search email, name or id"
            className="w-full rounded-full bg-surface px-4 py-2 text-sm ring-1 ring-line outline-none focus:ring-accent"
          />
        </form>
      </PageHead>
      <div className="mt-8">
        <ChartCard title="New sign-ups per day" total={num(byDay(users, 30, (u) => u.createdAt).reduce((n, d) => n + d.value, 0))} sub="last 30 days">
          <DayChart bare days={byDay(users, 30, (u) => u.createdAt)} noun="sign-ups" />
        </ChartCard>
      </div>
      <div className="mt-10">
        <Tabs
          base="/admin/users"
          params={params}
          tabs={[
            { value: undefined, label: "Everyone", count: matching.length },
            { value: "paying", label: "Paying", count: matching.filter(groups.paying).length },
            { value: "unfinished", label: "Didn't finish sign-up", count: matching.filter(groups.unfinished).length },
            { value: "admins", label: "Admins", count: matching.filter(groups.admins).length },
          ]}
        />
      </div>
      <div className="mt-4">
        <Table
          rows={p.rows}
          rowKey={(u) => u.id}
          empty="No learners match."
          columns={[
            {
              label: "Learner",
              cell: (u) => (
                <div className="min-w-0">
                  <A href={`/admin/users/${u.id}`}>{u.email ?? u.id.slice(0, 8)}</A>
                  <div className="text-[12px] text-muted">
                    {u.name ?? "no name"} · {u.provider ?? "–"}
                  </div>
                </div>
              ),
            },
            { label: "Plan", cell: (u) => <Badge tone={u.plan === "free" ? "muted" : "good"}>{u.plan}</Badge> },
            { label: "Role", cell: (u) => (u.role ? <Badge tone="accent">{u.role}</Badge> : <span className="text-muted">learner</span>) },
            { label: "Finished sign-up", cell: (u) => (u.onboarded ? "yes" : <span className="text-muted">no</span>) },
            { label: "Courses", align: "right", cell: (u) => courseCount.get(u.id) ?? 0 },
            { label: "Lessons done", align: "right", cell: (u) => `${doneCount.get(u.id) ?? 0} of ${lessonCount.get(u.id) ?? 0}` },
            { label: "AI spend", align: "right", cell: (u) => usd(spend.get(u.id) ?? 0) },
            { label: "Signed up", cell: (u) => <Time iso={u.createdAt} /> },
            { label: "Last active", cell: (u) => <Time iso={[u.lastSignIn, lastRun.get(u.id)].filter(Boolean).sort().at(-1) ?? null} /> },
            { label: "Referred by", cell: (u) => u.referredBy ?? "–" },
          ]}
        />
        <Pager base="/admin/users" params={params} page={p.page} total={p.total} perPage={p.perPage} />
      </div>
    </>
  );
}
