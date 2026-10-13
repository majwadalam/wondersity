import { A, Badge, Filters, num, PageHead, Pager, Table, Time, pageParam, paginate } from "@/components/admin/ui";
import { emailsById, listCourses, requireAdmin } from "@/lib/admin";

// Every learner's courses, most recently active first.

export default async function AdminCourses({ searchParams }: PageProps<"/admin/courses">) {
  await requireAdmin();
  const sp = await searchParams;
  const kind = typeof sp.kind === "string" ? sp.kind : undefined;
  const q = String(sp.q ?? "").trim().toLowerCase();
  const [courses, email] = await Promise.all([listCourses(), emailsById()]);
  const shown = courses.filter(
    (c) =>
      (!kind || (kind === "tailored" ? !!c.intake : kind === "shared" ? !!c.plan_key && !c.intake : kind === "own" ? !c.plan_key && !c.intake : c.status === kind)) &&
      (!q || `${c.title} ${c.topic} ${email.get(c.learner_id) ?? ""}`.toLowerCase().includes(q))
  );
  const p = paginate(shown, pageParam(sp.page), 25);
  return (
    <>
      <PageHead title="Courses" sub={`${num(courses.length)} courses across every learner.`}>
        <form className="w-full sm:w-72">
          {kind && <input type="hidden" name="kind" value={kind} />}
          <input name="q" defaultValue={q} placeholder="Search title, topic or learner" className="w-full rounded-full bg-surface px-4 py-2 text-sm ring-1 ring-line outline-none focus:ring-accent" />
        </form>
      </PageHead>
      <div className="mt-6 mb-4">
        <Filters
          base="/admin/courses"
          params={{ kind, q: q || undefined }}
          name="kind"
          options={[
            [undefined, "All"],
            ["shared", "Reused plan"],
            ["own", "Planned for them"],
            ["tailored", "Tailored"],
            ["active", "Active"],
            ["completed", "Finished"],
          ]}
        />
      </div>
      <Table
        rows={p.rows}
        rowKey={(c) => c.id}
        empty="No courses match."
        columns={[
          {
            label: "Course",
            cell: (c) => (
              <div>
                <A href={`/admin/courses/${c.id}`}>{c.title}</A>
                <div className="text-[12px] text-muted">asked: {c.topic}</div>
              </div>
            ),
          },
          { label: "Learner", cell: (c) => <A href={`/admin/users/${c.learner_id}`}>{email.get(c.learner_id) ?? `deleted · ${c.learner_id.slice(0, 8)}`}</A> },
          { label: "Plan", cell: (c) => (c.intake ? <Badge tone="accent">tailored</Badge> : c.plan_key ? <Badge>reused</Badge> : <Badge>planned for them</Badge>) },
          { label: "Lessons done", align: "right", cell: (c) => `${c.lessons.filter((l) => l.completed_at).length} of ${c.modules.length}` },
          { label: "Status", cell: (c) => <Badge tone={c.status === "completed" ? "good" : "muted"}>{c.status}</Badge> },
          { label: "Created", cell: (c) => <Time iso={c.created_at} /> },
          { label: "Last active", cell: (c) => <Time iso={c.updated_at} /> },
        ]}
      />
      <Pager base="/admin/courses" params={{ kind, q: q || undefined }} page={p.page} total={p.total} perPage={p.perPage} />
    </>
  );
}
