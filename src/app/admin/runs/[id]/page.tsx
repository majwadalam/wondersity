import { notFound } from "next/navigation";
import { plainError, runLabel } from "@/components/admin/labels";
import { CostBreakdown, Trace } from "@/components/admin/Trace";
import { A, Badge, Card, Details, Json, PageHead, Section, Stats, Time, duration, tokens, usd, when } from "@/components/admin/ui";
import { costSteps, getRun, getUser, requireAdmin } from "@/lib/admin";

// One run: what it did step by step, how long each step took, and where its money went.

export default async function AdminRun({ params }: PageProps<"/admin/runs/[id]">) {
  await requireAdmin();
  const id = Number((await params).id);
  const run = Number.isInteger(id) ? await getRun(id) : null;
  if (!run) notFound();
  const user = await getUser(run.learner_id);
  const steps = costSteps(run.trace);

  return (
    <>
      <p className="text-sm">
        <A href="/admin/runs">← AI activity</A>
      </p>
      <PageHead
        title={runLabel(run.kind, run.outcome, run.ok).name}
        sub={
          <>
            Job #{run.id} {run.topic && <>on “{run.topic}”</>} for <A href={`/admin/users/${run.learner_id}`}>{user?.email ?? run.learner_id.slice(0, 8)}</A> · <Time iso={run.created_at} /> ({when(run.created_at)})
            {run.lesson_id && (
              <>
                {" "}
                · lesson <A href={`/admin/lessons/${run.lesson_id}`}>#{run.lesson_id}</A>
              </>
            )}
          </>
        }
      >
        <Badge tone={run.ok ? "good" : "bad"}>{run.ok ? "Succeeded" : "Failed"}</Badge>
      </PageHead>

      <div className="mt-8">
        <Stats
          items={[
            { label: "Cost", value: usd(run.cost_usd), sub: "as OpenRouter billed it" },
            { label: "Took", value: duration(run.ms) },
            { label: "Model calls", value: run.calls, sub: "requests to an AI model" },
            { label: "Text sent / received", value: `${tokens(run.tokens_in)} / ${tokens(run.tokens_out)}`, sub: "tokens (≈ ¾ of a word each)" },
          ]}
        />
      </div>

      {run.error && (
        <Section title="What went wrong">
          <Card className="p-4">
            <p className="font-medium text-fg">{plainError(run.error)}</p>
            <pre className="mt-3 font-mono text-[12px] break-all whitespace-pre-wrap text-muted">{run.error}</pre>
          </Card>
        </Section>
      )}

      {steps && (
        <Section title="Where this job's money went">
          <CostBreakdown steps={steps} />
        </Section>
      )}

      <Section title="Step by step" sub="Everything this job did, in order. The bar shows how long a step took; click a step for all it recorded.">
        <Trace trace={run.trace} />
      </Section>

      <Section title="Raw data">
        <Details summary="Show the whole trace as JSON">
          <Json value={run.trace} className="max-h-[600px]" />
        </Details>
      </Section>
    </>
  );
}
