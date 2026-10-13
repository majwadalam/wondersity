// Seeds the courses we offer (lib/catalog.ts: the catalog, then the landing
// page's topics) into the shared cache, so a
// learner who opens one gets its plan, painted world and first lessons (with
// their scenes) at once, for under a cent. For each topic, a throwaway learner
// takes the course through the running app's real API, exactly as a learner
// would: the plan is cached (a fresh learner), each lesson that passes review
// is cached, and its scenes go into the shared copy once painted. Answering
// every check right keeps the learner on the shared path for the next lesson.
// The learners are deleted afterwards; the shared plans, lessons and pictures
// stay, and so do their run records (what seeding cost).
//
//   pnpm dev   # in another terminal
//   node --env-file=.env.local --import tsx scripts/seed-catalog.ts [lessons per course, default 1] [topic filter]
//
// Needs SUPABASE_SECRET_KEY. Costs about $0.20 a course for lesson 1 and its
// world, about $0.15 for each further lesson. A lesson that misses the review
// bar isn't cached, so a course gets a second try. Topics already seeded for
// the current lesson guide are skipped.

import { createClient, type Session } from "@supabase/supabase-js";
import { OFFERED_TOPICS } from "../src/lib/catalog";
import { PLANNER_VERSION } from "../src/lib/coursePlan";
import { lessonVersion } from "../src/lib/lessonWriter";

const lessonsPerCourse = Math.max(1, Number(process.argv[2] ?? 1) || 1);
const only = process.argv[3]?.toLowerCase();
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
const ref = new URL(url).hostname.split(".")[0];
const key = (topic: string) => topic.trim().replace(/\s+/g, " ").toLowerCase();

function sessionCookie(session: Session) {
  const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  const name = `sb-${ref}-auth-token`;
  if (value.length <= 3180) return `${name}=${value}`;
  return value.match(/.{1,3180}/g)!.map((p, i) => `${name}.${i}=${p}`).join("; ");
}

async function newLearner() {
  const email = `seed-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@wondersity.test`;
  const password = `Seed-${crypto.randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const signed = await createClient(url, publishable, { auth: { persistSession: false } }).auth.signInWithPassword({ email, password });
  if (signed.error || !signed.data.session) throw signed.error ?? new Error("no session");
  return { id: data.user.id, cookie: sessionCookie(signed.data.session) };
}
type Learner = Awaited<ReturnType<typeof newLearner>>;

async function call(learner: Learner, method: string, path: string, body?: unknown) {
  const res = await fetch(BASE + path, {
    method,
    headers: { cookie: learner.cookie, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

async function waitForJob(learner: Learner, id: string) {
  for (const until = Date.now() + 7 * 60_000; Date.now() < until; ) {
    await new Promise((r) => setTimeout(r, 4000));
    const job = (await call(learner, "GET", `/api/jobs/${id}`)).data?.job;
    if (job && job.status !== "running") return job;
  }
  return { status: "timeout" };
}

/** The latest running job for a learner (the next lesson, started by finishing a quiz). */
async function runningJob(learner: Learner) {
  for (let i = 0; i < 10; i++) {
    const jobs = (await call(learner, "GET", "/api/jobs")).data?.jobs ?? [];
    if (jobs[0]?.id) return jobs[0].id as string;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return null;
}

/** Makes sure a lesson's scenes and the course's world are painted (the job does this when it has time). */
async function finishPictures(learner: Learner, lessonId: number, courseId: number, topic: string) {
  const saved = (await admin.from("lessons").select("lesson_data").eq("id", lessonId).single()).data?.lesson_data;
  const s = saved?.staging;
  if (!s || !s.guide?.portrait || s.images?.some((i: { url?: string }) => !i.url)) await call(learner, "POST", "/api/stage", { lessonId, topic });
  const course = (await admin.from("courses").select("cover_url, world_road").eq("id", courseId).single()).data;
  if (!course?.cover_url || course.world_road == null) await call(learner, "POST", "/api/covers", { courseId });
}

async function cleanUp(learner: Learner) {
  // Runs are kept: they record what seeding cost.
  for (const table of ["attempts", "progress", "lesson_views", "lesson_reports", "jobs", "lessons", "courses"]) {
    await admin.from(table).delete().eq("learner_id", learner.id);
  }
  await admin.from("profiles").delete().eq("id", learner.id);
  await admin.auth.admin.deleteUser(learner.id);
}

async function cached(topic: string) {
  const { data } = await admin.from("shared_lessons").select("module_index, lesson").eq("plan_key", key(topic)).eq("lesson_version", lessonVersion());
  const plan = (await admin.from("course_plans").select("cover_url, planner_version").eq("topic_key", key(topic)).maybeSingle()).data;
  return {
    plan: plan?.planner_version === PLANNER_VERSION,
    world: !!plan?.cover_url,
    lessons: (data ?? []).filter((l) => l.lesson?.staging?.images?.every((i: { url?: string }) => i.url)).length,
  };
}

async function seed(topic: string) {
  const before = await cached(topic);
  if (before.plan && before.world && before.lessons >= lessonsPerCourse) return `${topic}: already seeded`;
  const learner = await newLearner();
  const notes: string[] = [];
  try {
    await call(learner, "PATCH", "/api/profile", { onboarded: true, ageConfirmed: true, dailyGoalMinutes: 10 });
    const start = await call(learner, "POST", "/api/learn", { topic });
    let job = start.data?.job?.id ? await waitForJob(learner, start.data.job.id) : null;
    for (let n = 1; n <= lessonsPerCourse; n++) {
      if (job?.result?.kind !== "lesson") {
        notes.push(`lesson ${n}: ${job?.status ?? start.status} ${job?.error ?? start.data?.error ?? ""}`.trim());
        break;
      }
      const { lessonId, course, score, passed, lesson } = job.result;
      notes.push(`lesson ${n}: ${score}${passed ? "" : " (below the bar: not cached)"}`);
      // Only a lesson that passed review is cached, so only its pictures are worth painting.
      if (!passed) break;
      await finishPictures(learner, lessonId, course.id, topic);
      if (n === lessonsPerCourse) break;
      // Every check right first time keeps the learner on the shared path, and starts the next lesson.
      const answers = lesson.questions.map((q: { correctAnswer: string }, i: number) => ({ questionIndex: i, chosen: q.correctAnswer }));
      await call(learner, "POST", "/api/attempts", { lessonId, answers });
      const next = await runningJob(learner);
      job = next ? await waitForJob(learner, next) : null;
    }
  } finally {
    await cleanUp(learner);
  }
  const after = await cached(topic);
  return `${topic}: ${notes.join(", ")} → cached: plan ${after.plan ? "yes" : "no"}, world ${after.world ? "yes" : "no"}, ${after.lessons} lesson(s) with scenes`;
}

/** Up to two tries: a lesson that misses the bar isn't cached, and a second try writes it afresh. */
async function seedWithRetry(topic: string) {
  const first = await seed(topic);
  if ((await cached(topic)).lessons >= lessonsPerCourse || first.endsWith("already seeded")) return first;
  return `${first}\n  second try: ${await seed(topic)}`;
}

/** What's left on the OpenRouter key's own limit (null when it has none or can't be read). */
async function keyRemaining(): Promise<number | null> {
  const res = await fetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` } }).catch(() => null);
  const data = res?.ok ? await res.json().catch(() => null) : null;
  return typeof data?.data?.limit_remaining === "number" ? data.data.limit_remaining : null;
}

async function main() {
  const t = Date.now();
  // One at a time: each course holds credit while it's written and painted.
  for (const topic of OFFERED_TOPICS.filter((t) => !only || t.toLowerCase().includes(only))) {
    // A course needs about $0.25 of headroom (images need $1 free on the key): stop cleanly before running dry.
    const left = await keyRemaining();
    if (left !== null && left < 0.6) {
      console.log(`stopped before ${topic}: $${left.toFixed(2)} left on the OpenRouter key; raise its limit and run this again`);
      break;
    }
    console.log(await seedWithRetry(topic).catch((e) => `${topic}: FAILED ${e instanceof Error ? e.message : e}`));
  }
  const { data } = await admin.from("runs").select("cost_usd").gte("created_at", new Date(t).toISOString());
  console.log(`done in ${Math.round((Date.now() - t) / 60000)} min, about $${(data ?? []).reduce((s, r) => s + Number(r.cost_usd), 0).toFixed(2)} (all runs in that time)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
