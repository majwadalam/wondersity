import type { CostSteps, TraceEntry } from "@/lib/admin";
import { costStep, traceStep } from "./labels";
import { Card, duration, Json, Share, Table, tokens, usd } from "./ui";

// A run's trace (lib/harness.ts) read as a list of steps: what each did, how
// long it took and the fields that matter, with the full entry one click away.

/** The few fields of a step worth seeing at a glance. */
function summary(t: TraceEntry): string[] {
  const out: string[] = [];
  const add = (label: string, v: unknown) => {
    if (v === undefined || v === null || v === "") return;
    out.push(`${label} ${Array.isArray(v) ? (v.length ? v.join(", ") : "none") : String(v)}`);
  };
  add("turn", t.turn);
  add("module", t.module);
  add("tool", t.tool);
  add("chose", t.toolCalls);
  add("approach", t.approach);
  if (typeof t.score === "number") out.push(`score ${t.score} / 10`);
  if (typeof t.hit === "boolean") out.push(t.hit ? `found${t.via === "similar" ? " (similar topic)" : ""}` : "not found");
  add("matched", t.matched);
  add("attempt", t.iteration);
  add("claims checked", t.claims);
  add("supported", t.supported);
  if (Array.isArray(t.contradicted) && t.contradicted.length) out.push(`contradicted ${t.contradicted.length}`);
  if (Array.isArray(t.giveaways) && t.giveaways.length) out.push(`giveaways ${t.giveaways.length}`);
  if (Array.isArray(t.problems)) out.push(`${t.problems.length} problem${t.problems.length === 1 ? "" : "s"}`);
  if (typeof t.passed === "boolean") out.push(t.passed ? "passed" : "did not pass");
  add("lesson", t.lessonId);
  add("error", t.error);
  if (t.step === "run.cost") out.push(`${usd(Number(t.usd ?? 0))} · ${t.calls} calls · ${tokens(Number(t.tokensIn ?? 0))} in / ${tokens(Number(t.tokensOut ?? 0))} out`);
  return out;
}

const dot = (t: TraceEntry) =>
  t.ok === false || t.error || (Array.isArray(t.contradicted) && t.contradicted.length)
    ? "bg-bad"
    : t.passed === false || (Array.isArray(t.giveaways) && t.giveaways.length)
      ? "bg-warn"
      : "bg-line-strong";

export function Trace({ trace }: { trace: TraceEntry[] }) {
  if (!trace.length) return <Card className="p-8 text-center text-sm text-muted">This run kept no trace (staging and paintings record only time and cost).</Card>;
  const maxMs = Math.max(...trace.map((t) => (typeof t.ms === "number" ? t.ms : 0)), 1);
  return (
    <Card>
      <ol className="divide-y divide-line">
        {trace.map((t, i) => (
          <li key={i}>
            <details className="group">
              <summary className="grid cursor-pointer list-none grid-cols-[24px_1fr] items-start gap-x-3 gap-y-1 px-4 py-3 hover:bg-canvas/60 sm:grid-cols-[24px_minmax(180px,240px)_1fr_150px]">
                <span className="pt-0.5 text-[12px] text-muted tabular-nums">{i + 1}</span>
                <span className="flex items-start gap-2">
                  <span className={`mt-[7px] size-2 shrink-0 rounded-full ${dot(t)}`} aria-hidden />
                  <span>
                    <span className="font-medium text-fg">{traceStep(t.step).name}</span>
                    <span className="block font-mono text-[11px] text-muted">{t.step}</span>
                  </span>
                </span>
                <span className="col-start-2 min-w-0 text-[13px] break-words sm:col-start-auto">
                  {summary(t).length > 0 && <span className="text-fg">{summary(t).join(" · ")}</span>}
                  {traceStep(t.step).about && <span className="block text-muted">{traceStep(t.step).about}</span>}
                </span>
                <span className="col-start-2 flex items-center gap-2 sm:col-start-auto">
                  {typeof t.ms === "number" && (
                    <>
                      <Share value={t.ms} max={maxMs} />
                      <span className="w-14 shrink-0 text-right text-[12px] text-muted tabular-nums">{duration(t.ms)}</span>
                    </>
                  )}
                </span>
              </summary>
              <div className="px-4 pb-4">
                {Array.isArray(t.problems) && t.problems.length > 0 && (
                  <ul className="mb-3 list-disc space-y-1 pl-5 text-[13px] text-fg">
                    {(t.problems as string[]).map((p, j) => (
                      <li key={j}>{String(p)}</li>
                    ))}
                  </ul>
                )}
                <Json value={t} className="max-h-80" />
              </div>
            </details>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function CostBreakdown({ steps }: { steps: CostSteps }) {
  const rows = Object.entries(steps)
    .map(([step, v]) => ({ step, ...v }))
    .sort((a, b) => b.cost - a.cost);
  const max = Math.max(...rows.map((r) => r.cost), 0);
  return (
    <Table
      rows={rows}
      rowKey={(r) => r.step}
      columns={[
        {
          label: "Part of the work",
          cell: (r) => (
            <div>
              <span className="font-medium">{costStep(r.step).name}</span>
              <div className="text-[13px] text-muted">{costStep(r.step).about}</div>
            </div>
          ),
        },
        { label: "Model calls", align: "right", cell: (r) => r.calls },
        { label: "Tokens in", align: "right", cell: (r) => tokens(r.in) },
        { label: "Tokens out", align: "right", cell: (r) => tokens(r.out) },
        { label: "Cost", align: "right", cell: (r) => usd(r.cost) },
        { label: "Share", cell: (r) => <Share value={r.cost} max={max} />, className: "w-40" },
      ]}
    />
  );
}
