import { A, Filters, Pager, Tabs, PageHead, RunStatus, Table, Time, duration, num, usd } from "@/components/admin/ui";
import { emailsById, listRuns, requireAdmin, RUNS_PER_PAGE } from "@/lib/admin";

// Every run (a tutor run, a staging, a painting) with its time and cost; each
// opens to its trace.

export default async function AdminRuns({ searchParams }: PageProps<"/admin/runs">) {
  await requireAdmin();
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" && sp[k] ? (sp[k] as string) : undefined);
  const params = { kind: str("kind"), ok: str("ok"), learner: str("learner"), page: str("page") };
  const page = Number(params.page ?? 0) || 0;
  const [{ runs, total }, email] = await Promise.all([
    listRuns({ kind: params.kind, ok: params.ok === "ok" || params.ok === "failed" ? params.ok : undefined, learner: params.learner, page }),
    emailsById(),
  ]);

  return (
    <>
      <PageHead
        title="AI activity & costs"
        sub={
          <>
            Every piece of AI work, newest first: {num(total)} jobs{params.learner && <> for {email.get(params.learner) ?? params.learner}</>}. Open one to see each step it took and what it cost.
          </>
        }
      />
      <div className="mt-6">
        <Tabs
          base="/admin/runs"
          params={params}
          name="kind"
          tabs={[
            { value: undefined, label: "All" },
            { value: "learn", label: "Writing lessons" },
            { value: "stage", label: "Scenes & guide" },
            { value: "cover", label: "Course maps" },
          ]}
        />
      </div>
      <div className="mt-4 mb-4 flex flex-wrap gap-4">
        <Filters base="/admin/runs" params={params} name="ok" options={[[undefined, "Any result"], ["ok", "Succeeded"], ["failed", "Failed"]]} />
        {params.learner && <A href={`/admin/runs?${new URLSearchParams(Object.entries({ ...params, learner: undefined, page: undefined }).filter((e): e is [string, string] => !!e[1]))}`}>Clear learner ×</A>}
      </div>
      <Table
        rows={runs}
        rowKey={(r) => r.id}
        empty="No runs match."
        columns={[
                    { label: "What happened", cell: (r) => <RunStatus kind={r.kind} ok={r.ok} outcome={r.outcome} /> },
          { label: "Topic", cell: (r) => <span className="line-clamp-1">{r.topic ?? "–"}</span> },
          { label: "Learner", cell: (r) => <A href={`/admin/runs?${new URLSearchParams({ learner: r.learner_id })}`}>{email.get(r.learner_id) ?? `deleted · ${r.learner_id.slice(0, 8)}`}</A> },
          { label: "Lesson", cell: (r) => (r.lesson_id ? <A href={`/admin/lessons/${r.lesson_id}`}>#{r.lesson_id}</A> : "–") },
                    { label: "Took", align: "right", cell: (r) => duration(r.ms) },
          { label: "Cost", align: "right", cell: (r) => usd(r.cost_usd) },
          { label: "When", cell: (r) => <Time iso={r.created_at} /> },
          { label: "", cell: (r) => <A href={`/admin/runs/${r.id}`}>Details</A> },
        ]}
      />
      <Pager base="/admin/runs" params={params} page={page} total={total} perPage={RUNS_PER_PAGE} />
    </>
  );
}
