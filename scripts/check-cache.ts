// Checks the shared cache from a learner's side: throwaway learners start
// courses through the running app, and each run's trace says whether the plan
// and lesson 1 came from the cache, how long it took and what it cost. Nothing
// is left behind: the learners are deleted afterwards.
//
//   pnpm dev   # in another terminal
//   node --env-file=.env.local --import tsx scripts/check-cache.ts ["topic" ...]
//
// With no topics it runs three cases: a seeded catalog course for a brand-new
// learner, the same course in other words (matched by meaning), and a catalog
// course for a learner who already has another course.

import { createClient, type Session } from "@supabase/supabase-js";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
const ref = new URL(url).hostname.split(".")[0];

function sessionCookie(session: Session) {
  const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  const name = `sb-${ref}-auth-token`;
  if (value.length <= 3180) return `${name}=${value}`;
  return value.match(/.{1,3180}/g)!.map((p, i) => `${name}.${i}=${p}`).join("; ");
}

async function newLearner() {
  const email = `cache-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@wondersity.test`;
  const password = `Cache-${crypto.randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const signed = await createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } }).auth.signInWithPassword({ email, password });
  if (signed.error || !signed.data.session) throw signed.error ?? new Error("no session");
  return { id: data.user.id, cookie: sessionCookie(signed.data.session) };
}
type Learner = Awaited<ReturnType<typeof newLearner>>;

async function call(learner: Learner, method: string, path: string, body?: unknown) {
  const res = await fetch(BASE + path, { method, headers: { cookie: learner.cookie, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => null) };
}

async function cleanUp(learner: Learner) {
  for (const table of ["attempts", "progress", "lesson_views", "runs", "jobs", "lessons", "courses"]) await admin.from(table).delete().eq("learner_id", learner.id);
  await admin.from("profiles").delete().eq("id", learner.id);
  await admin.auth.admin.deleteUser(learner.id);
}

async function startCourse(label: string, topic: string, withHistory = false) {
  const learner = await newLearner();
  try {
    await call(learner, "PATCH", "/api/profile", { onboarded: true, ageConfirmed: true, dailyGoalMinutes: 10 });
    if (withHistory) {
      // Another course already on the account (written straight to the database: no model call).
      await admin.from("courses").insert({ learner_id: learner.id, topic: "Knitting", topic_key: "knitting", title: "Knitting", description: "d", modules: [{ title: "Casting on", goal: "g" }] });
    }
    const t = Date.now();
    const start = await call(learner, "POST", "/api/learn", { topic });
    let job = start.data?.job;
    while (job?.status === "running" && Date.now() - t < 6 * 60_000) {
      await new Promise((r) => setTimeout(r, 1000));
      job = (await call(learner, "GET", `/api/jobs/${job.id}`)).data?.job;
    }
    const seconds = ((Date.now() - t) / 1000).toFixed(1);
    const trace: { step: string; [k: string]: unknown }[] = job?.result?.trace ?? [];
    if (process.env.SHOW_STEPS) console.log(trace.map((s) => `${s.step}${s.ms !== undefined ? ` ${s.ms}ms` : ""}`).join(" · "));
    const plan = trace.find((s) => s.step === "plan_cache");
    const lesson = trace.find((s) => s.step === "lesson_cache");
    const cost = (await admin.from("runs").select("cost_usd").eq("learner_id", learner.id)).data?.reduce((s, r) => s + Number(r.cost_usd), 0) ?? 0;
    const staged = !!job?.result?.lesson?.staging?.images?.every((i: { url?: string }) => i.url);
    const world = !!job?.result?.course?.cover;
    console.log(
      `${label}\n  topic: "${topic}" → course "${job?.result?.course?.title ?? "?"}"\n` +
        `  plan: ${plan ? (plan.hit ? `HIT (${plan.via})` : "miss") : "not looked up"} · lesson 1: ${lesson ? (lesson.hit ? "HIT" : "miss") : "not looked up"}` +
        ` · scenes ${staged ? "yes" : "no"} · world ${world ? "yes" : "no"}\n` +
        `  ready in ${seconds}s · cost $${cost.toFixed(4)} · ${job?.status}${job?.error ? ` (${job.error})` : ""}`
    );
  } finally {
    await cleanUp(learner);
  }
}

async function main() {
  const topics = process.argv.slice(2);
  if (topics.length) {
    for (const t of topics) await startCourse(`New learner: ${t}`, t);
    return;
  }
  await startCourse("1. New learner, seeded catalog course", "Game theory");
  await startCourse("2. New learner, same course in other words", "game theory for beginners");
  await startCourse("3. Learner with another course, catalog course", "Stoicism", true);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
