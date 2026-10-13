import { A, Badge, Details, Json, PageHead, Pager, Table, Time, pageParam } from "@/components/admin/ui";
import { listActions, requireAdmin } from "@/lib/admin";

// Every change made from the admin panel: who, what, when, and what it was before.

const TARGET = { course: "/admin/courses/", plan: "/admin/cache/", learner: "/admin/users/" } as Record<string, string>;
const KIND: Record<string, string> = {
  edit_course: "Edited a course",
  edit_lesson_plan: "Changed a lesson plan",
  move_learner: "Moved a learner",
  rewrite_lesson: "Rewrote a lesson",
  delete_course: "Deleted a course",
  resolve_message: "Answered a message",
  reopen_message: "Reopened a message",
  edit_brief: "Retailored a course",
  edit_plan: "Edited a shared plan",
  edit_plan_lesson: "Changed a shared lesson",
  retire_saved_lesson: "Retired a saved lesson",
  delete_plan: "Stopped reusing a plan",
  grant_role: "Made an admin",
  remove_role: "Removed an admin",
};

export default async function AdminLog({ searchParams }: PageProps<"/admin/log">) {
  await requireAdmin();
  const page = pageParam((await searchParams).page);
  const { actions, total } = await listActions({ page });
  return (
    <>
      <PageHead title="Activity log" sub="Every change made from this panel, newest first. Nothing here can be edited." />
      <div className="mt-6">
        <Table
          rows={actions}
          rowKey={(a) => a.id}
          empty="No changes yet. Edits, moves, rewrites and role changes show up here."
          columns={[
            { label: "What", cell: (a) => <Badge tone={a.action.startsWith("delete") || a.action.startsWith("retire") || a.action === "rewrite_lesson" ? "warn" : "muted"}>{KIND[a.action] ?? a.action}</Badge> },
            {
              label: "Details",
              cell: (a) => (
                <div className="space-y-1">
                  {TARGET[a.target_type] && a.target_id !== "none" && !a.action.startsWith("delete") ? <A href={`${TARGET[a.target_type]}${encodeURIComponent(a.target_id)}`}>{a.summary}</A> : <span>{a.summary}</span>}
                  {(a.before != null || a.after != null) && (
                    <Details summary="Before and after">
                      <div className="grid gap-2 md:grid-cols-2">
                        {(
                          [
                            ["Before", a.before],
                            ["After", a.after],
                          ] as const
                        )
                          .filter(([, v]) => v != null)
                          .map(([label, v]) => (
                            <div key={label}>
                              <p className="mb-1 text-[12px] font-medium text-muted">{label}</p>
                              <Json value={v} className="max-h-48" />
                            </div>
                          ))}
                      </div>
                    </Details>
                  )}
                </div>
              ),
            },
            { label: "By", cell: (a) => a.admin_email ?? "–" },
            { label: "When", cell: (a) => <Time iso={a.created_at} /> },
          ]}
        />
        <Pager base="/admin/log" params={{}} page={page} total={total} perPage={50} />
      </div>
    </>
  );
}
