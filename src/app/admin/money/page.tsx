import { costStep } from "@/components/admin/labels";
import { runLabel } from "@/components/admin/labels";
import { A, ChartCard, DayChart, Explain, Filters, HBars, PageHead, Pager, Section, Stats, Table, Tabs, duration, num, pageParam, paginate, usd } from "@/components/admin/ui";
import { allTimeSpend, byDay, daysAgo, emailsById, groupSpend, isLessonRun, percentile, requireAdmin, spendBySteps, spendSince, sumCost } from "@/lib/admin";

// Where the AI money goes: by day, by kind of job, by part of writing a
// lesson, and by learner, over a chosen period.

const BASE = "/admin/money";

export default async function AdminMoney({ searchParams }: PageProps<"/admin/money">) {
  await requireAdmin();
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" && sp[k] ? (sp[k] as string) : undefined);
  const days = [7, 30, 90].includes(Number(str("days"))) ? Number(str("days")) : 30;
  const params = { tab: str("tab"), days: days === 30 ? undefined : String(days) };
  const page = pageParam(sp.page);
  const [runs, allTime, email] = await Promise.all([spendSince(daysAgo(days)), allTimeSpend(), emailsById()]);

  const lessons = runs.filter(isLessonRun);
  const spent = sumCost(runs);
  // Per learner counts every learner the AI worked for, including deleted test accounts, so the cost is shared fairly.
  const learners = new Set(runs.map((r) => r.learner_id)).size;

  return (
    <>
      <PageHead title="Money" sub="What the AI cost, as OpenRouter billed it: every model call, painting and voice line.">
        <Filters base={BASE} params={params} name="days" options={[["7", "7 days"], [undefined, "30 days"], ["90", "90 days"]]} />
      </PageHead>

      <div className="mt-6">
        <Stats
          items={[
            { label: `Last ${days} days`, value: usd(spent), sub: `${num(runs.length)} AI jobs` },
            { label: "Per lesson written", value: lessons.length ? usd(sumCost(lessons) / lessons.length) : "–", sub: `${num(lessons.length)} lessons, not counting scenes` },
            { label: "Per active learner", value: learners ? usd(spent / learners) : "–", sub: `${num(learners)} learners` },
            { label: "All time", value: usd(allTime.total), sub: `${num(allTime.runs)} AI jobs` },
          ]}
        />
      </div>

      <div className="mt-8">
        <Tabs
          base={BASE}
          params={params}
          tabs={[
            { value: undefined, label: "By day" },
            { value: "jobs", label: "By kind of job" },
            { value: "parts", label: "Inside a lesson" },
            { value: "learners", label: "By learner" },
          ]}
        />
      </div>

      {!params.tab && <ByDay runs={runs} days={days} page={page} params={params} />}
      {params.tab === "jobs" && <ByJob runs={runs} />}
      {params.tab === "parts" && <ByPart runs={runs} />}
      {params.tab === "learners" && <ByLearner runs={runs} email={email} page={page} params={params} />}
    </>
  );
}

type Runs = Awaited<ReturnType<typeof spendSince>>;
type Params = Record<string, string | undefined>;

function ByDay({ runs, days, page, params }: { runs: Runs; days: number; page: number; params: Params }) {
  const cost = byDay(runs, days, (r) => r.created_at, (r) => r.cost_usd);
  const jobs = byDay(runs, days, (r) => r.created_at);
  const lessons = byDay(runs.filter(isLessonRun), days, (r) => r.created_at);
  // From the first day with any AI work: earlier days would only be rows of zeros.
  const start = Math.max(0, jobs.findIndex((d) => d.value > 0));
  const rows = cost.map((d, i) => ({ day: d.day, usd: d.value, jobs: jobs[i].value, lessons: lessons[i].value })).slice(start).reverse();
  const p = paginate(rows, page, 10);
  return (
    <>
      <div className="mt-8">
        <ChartCard title="AI cost per day" total={usd(cost.reduce((n, d) => n + d.value, 0))} sub={`${num(jobs.reduce((n, d) => n + d.value, 0))} AI jobs · hover a bar for that day`}>
          <DayChart bare days={cost} format="usd" noun="AI cost" />
        </ChartCard>
      </div>
      <Section title="Day by day" sub="Newest first.">
        <Table
          rows={p.rows}
          rowKey={(r) => r.day}
          columns={[
            { label: "Day", cell: (r) => new Date(`${r.day}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }) },
            { label: "AI cost", align: "right", cell: (r) => usd(r.usd) },
            { label: "AI jobs", align: "right", cell: (r) => num(r.jobs) },
            { label: "Lessons written", align: "right", cell: (r) => num(r.lessons) },
          ]}
        />
        <Pager base="/admin/money" params={params} page={p.page} total={p.total} perPage={p.perPage} />
      </Section>
    </>
  );
}

function ByJob({ runs }: { runs: Runs }) {
  const groups = groupSpend(runs, (r) => runLabel(r.kind, r.outcome, r.ok).name);
  return (
    <>
      <Section title="Cost by kind of job" sub="All the AI work the app did, most expensive first.">
        <HBars rows={groups.map((g) => ({ label: g.key, value: g.usd }))} />
      </Section>
      <Section title="The numbers">
        <Explain>“Usual time” is how long half of them took or less; “Slowest 1 in 10” is how long the slowest tenth took.</Explain>
        <div className="mt-3">
          <Table
            rows={groups}
            rowKey={(r) => r.key}
            columns={[
              { label: "Job", cell: (r) => <span className="font-medium">{r.key}</span> },
              { label: "Times", align: "right", cell: (r) => num(r.runs) },
              { label: "Total cost", align: "right", cell: (r) => usd(r.usd) },
              { label: "Cost each", align: "right", cell: (r) => usd(r.usd / r.runs) },
              { label: "Usual time", align: "right", cell: (r) => duration(percentile(r.ms, 0.5)) },
              { label: "Slowest 1 in 10", align: "right", cell: (r) => duration(percentile(r.ms, 0.9)) },
            ]}
          />
        </div>
      </Section>
    </>
  );
}

function ByPart({ runs }: { runs: Runs }) {
  const steps = spendBySteps(runs);
  const total = steps.reduce((n, s) => n + s.cost, 0);
  return (
    <>
      <Section title="Where a lesson's cost goes" sub="Writing a lesson is several AI steps. This splits their cost.">
        <HBars rows={steps.map((s) => ({ label: costStep(s.step).name, value: s.cost, note: costStep(s.step).about }))} />
      </Section>
      <Section title="The numbers">
        <Table
          rows={steps}
          rowKey={(r) => r.step}
          empty="No lessons were written in this period."
          columns={[
            {
              label: "Step",
              cell: (r) => (
                <div>
                  <span className="font-medium">{costStep(r.step).name}</span>
                  <div className="text-[13px] text-muted">{costStep(r.step).about}</div>
                </div>
              ),
            },
            { label: "Model calls", align: "right", cell: (r) => num(r.calls) },
            { label: "Cost", align: "right", cell: (r) => usd(r.cost) },
            { label: "Share", align: "right", cell: (r) => (total ? `${Math.round((100 * r.cost) / total)}%` : "–") },
          ]}
        />
      </Section>
    </>
  );
}

function ByLearner({ runs, email, page, params }: { runs: Runs; email: Map<string, string>; page: number; params: Params }) {
  const groups = groupSpend(runs, (r) => r.learner_id);
  const lessons = new Map<string, number>();
  for (const r of runs.filter(isLessonRun)) lessons.set(r.learner_id, (lessons.get(r.learner_id) ?? 0) + 1);
  const name = (id: string) => email.get(id) ?? `deleted · ${id.slice(0, 8)}`;
  const p = paginate(groups, page, 15);
  return (
    <>
      <Section title="Top 10 by cost">
        <HBars rows={groups.slice(0, 10).map((g) => ({ label: name(g.key), value: g.usd }))} />
      </Section>
      <Section title="Every learner" sub="Most expensive first.">
        <Table
          rows={p.rows}
          rowKey={(r) => r.key}
          columns={[
            { label: "Learner", cell: (r) => <A href={`/admin/users/${r.key}`}>{name(r.key)}</A> },
            { label: "Lessons written", align: "right", cell: (r) => num(lessons.get(r.key) ?? 0) },
            { label: "AI jobs", align: "right", cell: (r) => num(r.runs) },
            { label: "AI cost", align: "right", cell: (r) => usd(r.usd) },
            { label: "Per lesson", align: "right", cell: (r) => (lessons.get(r.key) ? usd(r.usd / lessons.get(r.key)!) : "–") },
          ]}
        />
        <Pager base="/admin/money" params={params} page={p.page} total={p.total} perPage={p.perPage} />
      </Section>
    </>
  );
}
