// End-to-end course test through the app's real HTTP API, as a browser would
// use it: two throwaway learners, one course each, every step timed and costed.
//
//   Learner A starts topic A (/api/learn) and then behaves like a closed
//   browser: it never calls the app again while the lesson is made, and the
//   script only watches the database to see the server finish the job on its
//   own: plan, lesson 1, scenes and "Go deeper", the course world. Then one
//   voiced line (/api/voice).
//   Learner B starts topic B, worded differently for the same course: it should
//   reuse A's shared plan (matched by meaning) and cached lesson 1.
//
// Results (responses' traces, the runs table's costs) go to the output folder;
// both learners and their data are deleted at the end.
//
//   pnpm dev   # in another terminal
//   node --env-file=.env.local --import tsx scripts/e2e-course.ts research/runs/11-server-jobs [topicA] [topicB]
//
// Needs SUPABASE_SECRET_KEY (to create confirmed test users) and OpenRouter credit.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type Session } from "@supabase/supabase-js";

const [outDir = "research/runs/11-server-jobs", topicA = "Stoicism", topicB = "stoic philosophy"] = process.argv.slice(2);
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
const ref = new URL(url).hostname.split(".")[0];
mkdirSync(outDir, { recursive: true });

/** The cookie @supabase/ssr reads: "base64-" + base64url(session JSON), split into 3180-char chunks. */
function sessionCookie(session: Session) {
  const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  const name = `sb-${ref}-auth-token`;
  if (value.length <= 3180) return `${name}=${value}`;
  const parts = value.match(/.{1,3180}/g)!;
  return parts.map((p, i) => `${name}.${i}=${p}`).join("; ");
}

async function newLearner(label: string) {
  const email = `e2e-${label}-${Date.now()}@wondersity.test`;
  const password = `E2e-${crypto.randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const anon = createClient(url, publishable, { auth: { persistSession: false } });
  const signed = await anon.auth.signInWithPassword({ email, password });
  if (signed.error || !signed.data.session) throw signed.error ?? new Error("no session");
  return { id: data.user.id, email, cookie: sessionCookie(signed.data.session) };
}

type Learner = Awaited<ReturnType<typeof newLearner>>;

async function call(learner: Learner, method: string, path: string, body?: unknown) {
  const t = Date.now();
  const res = await fetch(BASE + path, {
    method,
    headers: { cookie: learner.cookie, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ms: Date.now() - t, data };
}

const runs = async (learnerId: string) =>
  (await admin.from("runs").select("kind, outcome, ok, ms, cost_usd, calls, tokens_in, tokens_out, error").eq("learner_id", learnerId).order("created_at")).data ?? [];

/** Watches a lesson job, either as the app does (its API) or only in the database (a closed browser). */
async function waitForJob(learner: Learner, id: string, browserClosed: boolean) {
  for (const until = Date.now() + 7 * 60_000; Date.now() < until; ) {
    await new Promise((r) => setTimeout(r, 3000));
    const job = browserClosed
      ? (await admin.from("jobs").select("status, result, error, ref").eq("id", id).single()).data
      : (await call(learner, "GET", `/api/jobs/${id}`)).data?.job;
    if (job && job.status !== "running") return job;
  }
  return { status: "timeout" };
}

async function course(learner: Learner, topic: string, report: Record<string, unknown>, full: boolean) {
  report.onboarding = (await call(learner, "PATCH", "/api/profile", { onboarded: true, ageConfirmed: true, dailyGoalMinutes: 10 })).status;
  const t = Date.now();
  const start = await call(learner, "POST", "/api/learn", { topic });
  const job = start.data?.job?.id ? await waitForJob(learner, start.data.job.id, full) : null;
  report.learn = {
    started: start.status,
    startSeconds: Math.round(start.ms / 1000),
    job: job?.status,
    seconds: Math.round((Date.now() - t) / 1000),
    watched: full ? "database only (browser closed)" : "the app's job API",
    kind: job?.result?.kind,
    error: job?.error ?? start.data?.error,
    ref: job?.ref ?? start.data?.ref,
  };
  if (job?.result?.kind !== "lesson") return;
  const { course: c, lesson, lessonId, score, passed } = job.result;
  report.course = { title: c.title, levels: c.levels?.length, lessons: c.modules?.length };
  report.lesson1 = {
    title: lesson.title,
    score,
    passed,
    approach: lesson.approach,
    blocks: lesson.blocks?.map((b: { kind: string }) => b.kind).join(" > "),
    sources: lesson.sources?.length ?? 0,
    stagedInResult: !!lesson.staging, // the job stages a new lesson before it finishes
  };
  report.trace = job.result.trace;
  if (!full) return;
  // What the server did on its own, read from the database (nothing asked the app to stage or paint).
  const saved = (await admin.from("lessons").select("lesson_data").eq("id", lessonId).single()).data?.lesson_data;
  const staging = saved?.staging;
  report.stagedByServer = {
    guide: staging?.guide?.name ?? null,
    scenes: staging?.images?.length ?? 0,
    painted: staging?.images?.filter((i: { url?: string }) => i.url).length ?? 0,
    portrait: !!staging?.guide?.portrait,
    goDeeper: saved?.resources ? Object.fromEntries(["videos", "articles", "books", "images"].map((k) => [k, saved.resources[k]?.length ?? 0])) : null,
  };
  const world = (await admin.from("courses").select("cover_url").eq("id", c.id).single()).data?.cover_url;
  report.worldPaintedByServer = !!world;
  const voice = await call(learner, "GET", `/api/voice?lessonId=${lessonId}&step=0`);
  report.voice = { status: voice.status, seconds: Math.round(voice.ms / 1000), url: !!voice.data?.url };
}

async function cleanUp(learner: Learner) {
  for (const table of ["attempts", "progress", "lesson_views", "lesson_reports", "runs", "jobs", "lessons", "courses"]) {
    await admin.from(table).delete().eq("learner_id", learner.id);
  }
  await admin.from("profiles").delete().eq("id", learner.id);
  await admin.auth.admin.deleteUser(learner.id);
}

async function main() {
  const a = await newLearner("a");
  const b = await newLearner("b");
  const report: Record<string, Record<string, unknown>> = { a: { topic: topicA }, b: { topic: topicB } };
  try {
    await course(a, topicA, report.a, true);
    report.a.runs = await runs(a.id);
    await course(b, topicB, report.b, false);
    report.b.runs = await runs(b.id);
  } finally {
    writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));
    await cleanUp(a);
    await cleanUp(b);
  }
  const total = (r: unknown) => ((r as { cost_usd: number }[]) ?? []).reduce((s, x) => s + Number(x.cost_usd), 0);
  console.log(JSON.stringify({ a: { ...report.a, trace: undefined, runs: undefined, costUsd: total(report.a.runs) }, b: { ...report.b, trace: undefined, runs: undefined, costUsd: total(report.b.runs) } }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
