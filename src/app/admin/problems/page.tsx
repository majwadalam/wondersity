import { plainError, reportKind } from "@/components/admin/labels";
import { A, Badge, Card, Details, Explain, PageHead, Pager, RunStatus, Section, Table, Tabs, Time, pageParam, paginate } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/ActionForm";
import { allMessages, allRatings, allReports, count, emailsById, isStale, listJobs, listRuns, requireAdmin, RUNS_PER_PAGE, weakLessons } from "@/lib/admin";
import { markMessage } from "../actions";

// Everything that went wrong, in one place: AI jobs that failed, lessons that
// couldn't be written, what learners reported, and lessons that never reached
// the quality bar.

const BASE = "/admin/problems";

export default async function AdminProblems({ searchParams }: PageProps<"/admin/problems">) {
  await requireAdmin();
  const sp = await searchParams;
  const tab = typeof sp.tab === "string" ? sp.tab : undefined;
  const page = pageParam(sp.page);
  const params = { tab };
  const [failedCount, jobs, reports, weak, email, ratings, messages] = await Promise.all([
    count("runs", { eq: ["ok", "false"] }),
    listJobs(1000),
    allReports(),
    weakLessons(),
    emailsById(),
    allRatings(),
    allMessages(),
  ]);
  const thumbsDown = ratings.filter((r) => r.rating < 0);
  const openMessages = messages.filter((m) => !m.resolved_at);
  const badJobs = jobs.filter((j) => j.status === "failed" || isStale(j));
  const who = (id: string) => email.get(id) ?? `deleted · ${id.slice(0, 8)}`;

  return (
    <>
      <PageHead title="Problems" sub="Everything that went wrong, newest first." />

      <Card className="mt-6 p-4">
        <Details summary="How problems are recorded">
          <ul className="mt-1 space-y-2 text-[14px] leading-relaxed text-muted">
            <li>
              <b className="text-fg">Failed AI jobs.</b> Every AI job (writing a lesson, adding scenes, painting a map) is saved when it ends, with whether it worked,
              the error, how long it took, its cost and, for lessons, every step it took. A failed one shows the step it stopped at.
            </li>
            <li>
              <b className="text-fg">Lessons that couldn&rsquo;t be written.</b> A lesson request is a queue entry. If it fails, the entry keeps the message the learner
              saw and a reference code. The full error is in the server log under that code, and in the matching failed AI job.
            </li>
            <li>
              <b className="text-fg">Mistake reports.</b> Learners press the flag in a lesson. The report keeps what they chose, what they wrote and which screen they were on.
            </li>
            <li>
              <b className="text-fg">Thumbs down.</b> At the end of a lesson learners rate it up or down, and can say what was off. Only thumbs down are listed; the count of
              thumbs up is in the tab&rsquo;s note.
            </li>
            <li>
              <b className="text-fg">Messages.</b> What people sent from the Help page, with the page they came from. Mark one answered once you&rsquo;ve replied by email.
            </li>
            <li>
              <b className="text-fg">Lessons below the bar.</b> Every lesson is scored out of 10 by an AI review. Under 8, it&rsquo;s rewritten once; if no version reaches
              8, the best one is shown and listed here.
            </li>
            <li>
              <b className="text-fg">Not recorded here:</b> errors in the learner&rsquo;s browser, and server errors outside AI jobs. Those are only in the server log (look up
              the reference code a learner was shown).
            </li>
          </ul>
        </Details>
      </Card>

      <div className="mt-6">
        <Tabs
          base={BASE}
          params={params}
          tabs={[
            { value: undefined, label: "Failed AI jobs", count: failedCount },
            { value: "queue", label: "Lessons that failed", count: badJobs.length },
            { value: "reports", label: "Mistake reports", count: reports.length },
            { value: "weak", label: "Lessons below the bar", count: weak.length },
            { value: "ratings", label: "Thumbs down", count: thumbsDown.length },
            { value: "messages", label: "Messages", count: openMessages.length },
          ]}
        />
      </div>

      {!tab && <FailedJobs page={page} who={who} />}

      {tab === "queue" && (
        <Section title="Lessons that couldn't be written" sub="The learner asked for a lesson and got an error instead, or it got stuck.">
          <Paged rows={badJobs} page={page} params={params}>
            {(rows) => (
              <Table
                rows={rows}
                rowKey={(j) => j.id}
                empty="None."
                columns={[
                  { label: "Topic", cell: (j) => j.topic },
                  { label: "For", cell: (j) => <A href={`/admin/users/${j.learner_id}`}>{who(j.learner_id)}</A> },
                  { label: "Problem", cell: (j) => (isStale(j) ? <Badge tone="bad">stuck</Badge> : <Badge tone="bad">failed</Badge>) },
                  { label: "What the learner saw", cell: (j) => <span className="text-[13px]">{j.error ?? "–"}</span> },
                  { label: "Log code", cell: (j) => (j.ref ? <span className="font-mono text-[12px]">{j.ref}</span> : "–") },
                  { label: "When", cell: (j) => <Time iso={j.created_at} /> },
                ]}
              />
            )}
          </Paged>
        </Section>
      )}

      {tab === "reports" && (
        <Section title="Mistake reports" sub="What learners flagged in a lesson. A wrong fact in a lesson that passed the fact check shows something the check missed.">
          <Paged rows={reports} page={page} params={params}>
            {(rows) => (
              <Table
                rows={rows}
                rowKey={(r) => r.id}
                empty="No reports yet."
                columns={[
                  { label: "Problem", cell: (r) => <span title={reportKind(r.kind).about}><Badge tone={r.kind === "wrong_fact" ? "bad" : r.kind === "broken" ? "warn" : "muted"}>{reportKind(r.kind).name}</Badge></span> },
                  { label: "What they wrote", cell: (r) => <span className="text-[13px]">{r.message || <span className="text-muted">nothing</span>}</span> },
                  { label: "Where", cell: (r) => <A href={`/admin/lessons/${r.lesson_id}`}>Lesson #{r.lesson_id}, screen {r.step}</A> },
                  { label: "From", cell: (r) => <A href={`/admin/users/${r.learner_id}`}>{who(r.learner_id)}</A> },
                  { label: "When", cell: (r) => <Time iso={r.created_at} /> },
                ]}
              />
            )}
          </Paged>
        </Section>
      )}

      {tab === "ratings" && (
        <Section
          title="Thumbs down"
          sub={`Lessons learners rated down, with what they said. ${ratings.length - thumbsDown.length} of ${ratings.length} ratings so far are thumbs up.`}
        >
          <Paged rows={thumbsDown} page={page} params={params}>
            {(rows) => (
              <Table
                rows={rows}
                rowKey={(r) => `${r.learner_id}:${r.lesson_id}`}
                empty="No lesson has been rated down."
                columns={[
                  { label: "What they said", cell: (r) => <span className="text-[13px]">{r.comment || <span className="text-muted">nothing</span>}</span> },
                  { label: "Lesson", cell: (r) => <A href={`/admin/lessons/${r.lesson_id}`}>Lesson #{r.lesson_id}</A> },
                  { label: "From", cell: (r) => <A href={`/admin/users/${r.learner_id}`}>{who(r.learner_id)}</A> },
                  { label: "When", cell: (r) => <Time iso={r.updated_at} /> },
                ]}
              />
            )}
          </Paged>
        </Section>
      )}

      {tab === "messages" && (
        <Section title="Messages" sub="Sent from the Help page. Answer by email, then mark it answered.">
          <Paged rows={messages} page={page} params={params}>
            {(rows) => (
              <Table
                rows={rows}
                rowKey={(m) => m.id}
                empty="No messages yet."
                columns={[
                  { label: "About", cell: (m) => <Badge tone={m.kind === "problem" || m.kind === "billing" ? "warn" : "muted"}>{m.kind}</Badge> },
                  { label: "Message", cell: (m) => <span className="block max-w-md text-[13px] whitespace-pre-wrap">{m.message}</span> },
                  {
                    label: "From",
                    cell: (m) =>
                      m.learner_id ? (
                        <A href={`/admin/users/${m.learner_id}`}>{m.email ?? who(m.learner_id)}</A>
                      ) : (
                        <span className="text-[13px]">{m.email ?? "–"} <span className="text-muted">(signed out)</span></span>
                      ),
                  },
                  { label: "Page", cell: (m) => <span className="font-mono text-[12px]">{m.page ?? "–"}</span> },
                  { label: "When", cell: (m) => <Time iso={m.created_at} /> },
                  {
                    label: "",
                    cell: (m) => (
                      <ActionForm
                        action={markMessage}
                        hidden={{ id: m.id, resolved: m.resolved_at ? "0" : "1" }}
                        submit={m.resolved_at ? "Reopen" : "Mark answered"}
                        tone="quiet"
                      />
                    ),
                  },
                ]}
              />
            )}
          </Paged>
        </Section>
      )}

      {tab === "weak" && (
        <Section title="Lessons below the bar" sub="No version scored 8 of 10 in the AI review, so the best one was shown. Worth a read.">
          <Paged rows={weak} page={page} params={params}>
            {(rows) => (
              <Table
                rows={rows}
                rowKey={(l) => l.id}
                empty="Every lesson reached the bar."
                columns={[
                  { label: "Lesson", cell: (l) => <A href={`/admin/lessons/${l.id}`}>{l.title ?? `Lesson #${l.id}`}</A> },
                  { label: "Course", cell: (l) => l.topic },
                  { label: "Score", align: "right", cell: (l) => <span className="text-bad">{Number(l.score).toFixed(1)}</span> },
                  { label: "For", cell: (l) => <A href={`/admin/users/${l.learner_id}`}>{who(l.learner_id)}</A> },
                  { label: "Written", cell: (l) => <Time iso={l.created_at} /> },
                ]}
              />
            )}
          </Paged>
        </Section>
      )}
    </>
  );
}

async function FailedJobs({ page, who }: { page: number; who: (id: string) => string }) {
  const { runs, total } = await listRuns({ ok: "failed", page });
  return (
    <Section title="Failed AI jobs" sub="Open one to see the step it stopped at.">
      <Explain>Failed scenes or map paintings don&rsquo;t break a lesson: it&rsquo;s shown without them and tried again later.</Explain>
      <div className="mt-3">
        <Table
          rows={runs}
          rowKey={(r) => r.id}
          empty="No AI job has failed."
          columns={[
            { label: "What failed", cell: (r) => <RunStatus kind={r.kind} ok={r.ok} outcome={r.outcome} /> },
            { label: "Topic", cell: (r) => <span className="line-clamp-2 min-w-32">{r.topic ?? "–"}</span> },
            {
              label: "Why",
              cell: (r) => (
                <span title={r.error ?? undefined} className="text-[13px] text-muted">
                  {r.error ? plainError(r.error) : "Not recorded (this kind of job didn’t save its error until now)."}
                </span>
              ),
            },
            { label: "For", cell: (r) => <A href={`/admin/users/${r.learner_id}`}>{who(r.learner_id)}</A> },
            { label: "When", cell: (r) => <Time iso={r.created_at} /> },
            { label: "", cell: (r) => <A href={`/admin/runs/${r.id}`}>Details</A> },
          ]}
        />
      </div>
      <Pager base={BASE} params={{}} page={page} total={total} perPage={RUNS_PER_PAGE} />
    </Section>
  );
}

function Paged<T>({ rows, page, params, children }: { rows: T[]; page: number; params: Record<string, string | undefined>; children: (rows: T[]) => React.ReactNode }) {
  const p = paginate(rows, page, 25);
  return (
    <>
      {children(p.rows)}
      <Pager base={BASE} params={params} page={p.page} total={p.total} perPage={p.perPage} />
    </>
  );
}
