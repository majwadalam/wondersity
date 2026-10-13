import type { Intake, StoredIntake } from "./intake";
import { AsyncLocalStorage } from "node:async_hooks";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, requireEnv } from "./env";
import type { StoredModule } from "./courseHierarchy";
import type { Lesson } from "./lessonWriter";
import type { Staging } from "./staging";
import { readCast, type Cast } from "./voices";

// A request from a signed-in learner runs inside withDb(), so every query
// here goes out as that learner and the row rules keep them to their own data.
const requestClient = new AsyncLocalStorage<SupabaseClient>();

export function withDb<T>(db: SupabaseClient, fn: () => Promise<T>) {
  return requestClient.run(db, fn);
}

/** The signed-in learner's client for this request, so background work (lib/jobs.ts) can keep using it. */
export function currentDb() {
  return requestClient.getStore() ?? null;
}

// Outside a request (scripts, the health check) queries go out signed out.
// Created on first use, not at import: `next build` loads route modules, and
// the build must not need (or crash without) runtime secrets.
let client: SupabaseClient | null = null;

function supabase(): SupabaseClient {
  const scoped = requestClient.getStore();
  if (scoped) return scoped;
  if (client) return client;
  client = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
  );
  return client;
}

// ---------- Types ----------

/** One planned module; newer ones also carry an id and their level (see courseHierarchy.ts). */
export type ModulePlan = StoredModule;

export type CourseRow = {
  id: number;
  learner_id: string;
  topic: string;
  topic_key: string;
  title: string;
  description: string;
  modules: ModulePlan[];
  current_module: number;
  status: "active" | "completed";
  cover_url: string | null;
  /** The road traced in the world, in % of the picture ([] = tracing failed); null until traced. */
  world_road?: { x: number; y: number }[] | null;
  /** The shared plan this course was made from or seeded (course_plans.topic_key). */
  plan_key?: string | null;
  /** What the learner asked for when they tailored the course (lib/intake.ts); null for "Plan it for me". */
  intake?: StoredIntake | null;
  /** A tailored course's learning outcomes, written by the planner. */
  outcomes?: string[] | null;
  /** The course's cast: who speaks in which voice (lib/voices.ts). */
  voices?: unknown;
  /** Set when the learner archived the course. */
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type LessonRow = {
  id: number;
  course_id: number | null;
  module_index: number | null;
  topic: string;
  score: number | null;
  created_at: string;
  completed_at: string | null;
  lesson_data: Lesson;
  /** Present when loaded with a course: one entry per recorded quiz answer. */
  attempts?: { correct: boolean }[];
};

export type CourseWithLessons = CourseRow & { lessons: LessonRow[] };

export type AttemptRow = { question_index: number; chosen: string; correct: boolean };

const LESSON_COLUMNS = "id, course_id, module_index, topic, score, created_at, completed_at, lesson_data";
const COURSE_WITH_LESSONS = `*, lessons(${LESSON_COLUMNS}, attempts(correct))`;

// ---------- Health check ----------
/** Reads one row's worth of the columns the app needs from each table. */
export async function checkTables() {
  const checks: [string, string][] = [
    ["courses", "id, topic_key, modules, current_module, status"],
    ["lessons", "id, course_id, module_index, completed_at"],
    ["attempts", "id, lesson_id, correct"],
    ["progress", "id, topic, status"],
  ];
  const results: Record<string, string> = {};
  for (const [table, columns] of checks) {
    const { error } = await supabase().from(table).select(columns).limit(1);
    results[table] = error ? `error: ${error.message}` : "ok";
  }
  return results;
}

// ---------- Learner history ----------
export async function getLearnerHistory(learnerId: string) {
  const { data, error } = await supabase()
    .from("progress")
    .select("topic, status, updated_at")
    .eq("learner_id", learnerId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("getLearnerHistory error:", error);
    return [];
  }
  return data ?? [];
}

// ---------- Courses ----------
export async function getCourse(learnerId: string, topicKey: string) {
  const { data, error } = await supabase()
    .from("courses")
    .select(COURSE_WITH_LESSONS)
    .eq("learner_id", learnerId)
    .eq("topic_key", topicKey)
    .maybeSingle();
  if (error) throw new Error(`getCourse: ${error.message}`);
  return data as CourseWithLessons | null;
}

export async function getCourseById(courseId: number, learnerId: string) {
  const { data, error } = await supabase()
    .from("courses")
    .select(COURSE_WITH_LESSONS)
    .eq("id", courseId)
    .eq("learner_id", learnerId)
    .maybeSingle();
  if (error) throw new Error(`getCourseById: ${error.message}`);
  return data as CourseWithLessons | null;
}

// Most recently active first, capped so the response stays small.
const COURSE_LIMIT = 20;

export async function listCourses(learnerId: string) {
  const { data, error } = await supabase()
    .from("courses")
    .select(COURSE_WITH_LESSONS)
    .eq("learner_id", learnerId)
    .order("updated_at", { ascending: false })
    .limit(COURSE_LIMIT);
  if (error) throw new Error(`listCourses: ${error.message}`);
  return (data ?? []) as CourseWithLessons[];
}

export async function createCourse(course: {
  learnerId: string;
  topic: string;
  topicKey: string;
  title: string;
  description: string;
  modules: ModulePlan[];
  /** A world already painted for this plan (from the plan cache). */
  coverUrl?: string | null;
  /** That world's traced road. */
  worldRoad?: { x: number; y: number }[] | null;
  /** The shared plan this course comes from or seeds. */
  planKey?: string | null;
  /** A tailored course's brief and outcomes. */
  intake?: StoredIntake | null;
  outcomes?: string[] | null;
}) {
  const { data, error } = await supabase()
    .from("courses")
    .insert({
      learner_id: course.learnerId,
      topic: course.topic,
      topic_key: course.topicKey,
      title: course.title,
      description: course.description,
      modules: course.modules,
      ...(course.coverUrl ? { cover_url: course.coverUrl } : {}),
      ...(course.coverUrl && course.worldRoad ? { world_road: course.worldRoad } : {}),
      ...(course.planKey ? { plan_key: course.planKey } : {}),
      ...(course.intake ? { intake: course.intake } : {}),
      ...(course.outcomes?.length ? { outcomes: course.outcomes } : {}),
    })
    .select("*")
    .single();
  if (error) throw new Error(`createCourse: ${error.message}`);
  return data as CourseRow;
}

export async function updateCourse(
  id: number,
  patch: Partial<Pick<CourseRow, "current_module" | "status">>
) {
  const { error } = await supabase()
    .from("courses")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`updateCourse: ${error.message}`);
}

// ---------- Covers ----------

/** Stores a file in the public "covers" bucket and returns its URL. */
export async function uploadCover(path: string, bytes: Buffer, contentType: string) {
  const bucket = supabase().storage.from("covers");
  const { error } = await bucket.upload(path, bytes, { contentType, cacheControl: "31536000" });
  if (error) throw new Error(`uploadCover: ${error.message}`);
  return bucket.getPublicUrl(path).data.publicUrl;
}

/**
 * Stores a generated image, resized to `maxWidth` and saved as WebP (a ~1 MB
 * render becomes ~60-150 KB), so pages load fast without an image optimizer.
 */
export async function uploadImage(path: string, bytes: Buffer, maxWidth: number) {
  const { default: sharp } = await import("sharp");
  const webp = await sharp(bytes).resize({ width: maxWidth, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  return uploadCover(path.replace(/\.(png|jpe?g|webp)$/i, "") + ".webp", webp, "image/webp");
}

/**
 * Saves cover URLs onto a course without touching anything else: re-reads the
 * modules first so a concurrent change isn't lost, and leaves updated_at alone
 * (covers don't count as activity).
 */
export async function saveCovers(courseId: number, courseCover: string | null, moduleCovers: Record<number, string>) {
  const { data, error } = await supabase().from("courses").select("modules, cover_url").eq("id", courseId).single();
  if (error) throw new Error(`saveCovers: ${error.message}`);
  const modules = (data.modules as ModulePlan[]).map((m, i) => (moduleCovers[i] && !m.cover ? { ...m, cover: moduleCovers[i] } : m));
  const patch: { modules: ModulePlan[]; cover_url?: string } = { modules };
  if (courseCover && !data.cover_url) patch.cover_url = courseCover;
  const { error: updateError } = await supabase().from("courses").update(patch).eq("id", courseId);
  if (updateError) throw new Error(`saveCovers: ${updateError.message}`);
}

/** Every course lesson with its recorded quiz answers. */
export async function getCourseAttempts(courseId: number) {
  const { data, error } = await supabase()
    .from("lessons")
    .select("id, module_index, lesson_data, attempts(question_index, chosen, correct)")
    .eq("course_id", courseId)
    // A course started over leaves its old lessons off the path (resetCourse): they don't count.
    .not("module_index", "is", null)
    .order("module_index", { ascending: true });
  if (error) throw new Error(`getCourseAttempts: ${error.message}`);
  return (data ?? []) as {
    id: number;
    module_index: number | null;
    lesson_data: Lesson;
    attempts: AttemptRow[];
  }[];
}

// ---------- Lessons ----------
export async function saveLesson(
  learnerId: string,
  topic: string,
  lesson: unknown,
  score: number,
  placement?: { courseId: number; moduleIndex: number }
) {
  const { data, error } = await supabase()
    .from("lessons")
    .insert({
      learner_id: learnerId,
      topic,
      lesson_data: lesson,
      score,
      course_id: placement?.courseId ?? null,
      module_index: placement?.moduleIndex ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("saveLesson error:", error);
    return null;
  }
  return data.id as number;
}

export async function getLessonForLearner(lessonId: number, learnerId: string) {
  const { data, error } = await supabase()
    .from("lessons")
    .select(LESSON_COLUMNS)
    .eq("id", lessonId)
    .eq("learner_id", learnerId)
    .maybeSingle();
  if (error) throw new Error(`getLessonForLearner: ${error.message}`);
  return data as LessonRow | null;
}

/** Marks a lesson complete. Returns false if it was already complete. */
export async function markLessonCompleted(lessonId: number) {
  const { data, error } = await supabase()
    .from("lessons")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", lessonId)
    .is("completed_at", null)
    .select("id");
  if (error) throw new Error(`markLessonCompleted: ${error.message}`);
  return (data ?? []).length > 0;
}

export async function insertAttempts(
  learnerId: string,
  lessonId: number,
  attempts: AttemptRow[]
) {
  const { error } = await supabase()
    .from("attempts")
    .insert(attempts.map((a) => ({ ...a, learner_id: learnerId, lesson_id: lessonId })));
  if (error) throw new Error(`insertAttempts: ${error.message}`);
}

// ---------- Upsert progress ----------
export async function upsertProgress(
  learnerId: string,
  topic: string,
  status: "started" | "completed",
  lessonId?: number
) {
  const { error } = await supabase().from("progress").upsert(
    {
      learner_id: learnerId,
      topic,
      status,
      last_lesson_id: lessonId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "learner_id,topic" }
  );

  if (error) {
    console.error("upsertProgress error:", error);
    return false;
  }
  return true;
}

// ---------- Standalone lessons (made before courses existed) ----------
// Newest first, capped so a long history can't produce a huge response.
const LIBRARY_LIMIT = 50;

export async function getLearnerLessons(learnerId: string) {
  const { data, error } = await supabase()
    .from("lessons")
    .select("id, topic, score, created_at, lesson_data")
    .eq("learner_id", learnerId)
    .is("course_id", null)
    .order("created_at", { ascending: false })
    .limit(LIBRARY_LIMIT);

  if (error) {
    console.error("getLearnerLessons error:", error);
    return [];
  }
  return data ?? [];
}

/** Replaces a lesson's stored content (used to add its staging). */
export async function updateLessonData(lessonId: number, lesson: unknown) {
  const { error } = await supabase().from("lessons").update({ lesson_data: lesson }).eq("id", lessonId);
  if (error) throw new Error(`updateLessonData: ${error.message}`);
}

/** Guides already cast in a course's lessons, newest first (so a course keeps one guide and one portrait). */
export async function getCourseGuides(courseId: number, learnerId: string) {
  const { data, error } = await supabase()
    .from("lessons")
    .select("lesson_data")
    .eq("course_id", courseId)
    .eq("learner_id", learnerId)
    .order("id", { ascending: false });
  if (error) throw new Error(`getCourseGuides: ${error.message}`);
  return (data ?? []).flatMap((r) => {
    const guide = (r.lesson_data as { staging?: Staging } | null)?.staging?.guide;
    return guide ? [guide] : [];
  });
}

// ---------- Help and contact (migration 019) ----------

export type SupportKind = "question" | "problem" | "idea" | "billing" | "other";

/** Saves a message from the Help page: as the learner when signed in, with the server key otherwise. */
export async function insertSupportMessage(m: { learnerId: string | null; email: string | null; kind: SupportKind; message: string; page: string | null }) {
  const client = m.learnerId ? supabase() : adminSupabase();
  const { error } = await client.from("support_messages").insert({ learner_id: m.learnerId, email: m.email, kind: m.kind, message: m.message, page: m.page });
  if (error) throw new Error(`insertSupportMessage: ${error.message}`);
}

// ---------- Review: checks answered wrong (migration 019) ----------

/** The learner's lessons with a check they got wrong the first time, newest first, with what they chose. */
export async function lessonsWithMistakes(learnerId: string) {
  const { data, error } = await supabase()
    .from("lessons")
    .select("id, course_id, module_index, created_at, lesson_data, attempts!inner(question_index, chosen, correct, created_at)")
    .eq("learner_id", learnerId)
    .eq("attempts.correct", false)
    .order("id", { ascending: false })
    .limit(100);
  if (error) throw new Error(`lessonsWithMistakes: ${error.message}`);
  return (data ?? []) as unknown as {
    id: number;
    course_id: number | null;
    module_index: number | null;
    created_at: string;
    lesson_data: Lesson;
    attempts: { question_index: number; chosen: string; correct: boolean; created_at: string }[];
  }[];
}

export async function courseTitles(learnerId: string) {
  const { data, error } = await supabase().from("courses").select("id, title").eq("learner_id", learnerId);
  if (error) throw new Error(`courseTitles: ${error.message}`);
  return new Map((data ?? []).map((c) => [c.id as number, c.title as string]));
}

export async function listReviewClears(learnerId: string) {
  const { data, error } = await supabase().from("review_clears").select("lesson_id, question_index, cleared_at").eq("learner_id", learnerId);
  if (error) throw new Error(`listReviewClears: ${error.message}`);
  return new Map((data ?? []).map((c) => [`${c.lesson_id}:${c.question_index}`, c.cleared_at as string]));
}

export async function addReviewClear(learnerId: string, lessonId: number, questionIndex: number) {
  const { error } = await supabase()
    .from("review_clears")
    .upsert({ learner_id: learnerId, lesson_id: lessonId, question_index: questionIndex }, { onConflict: "learner_id,lesson_id,question_index", ignoreDuplicates: true });
  if (error) throw new Error(`addReviewClear: ${error.message}`);
}

// ---------- Lesson ratings (migration 019) ----------

/** A thumbs up (1) or down (-1) on one of the learner's own lessons; a second rating replaces the first. */
export async function rateLesson(learnerId: string, r: { lessonId: number; rating: 1 | -1; comment?: string }) {
  if (!(await getLessonForLearner(r.lessonId, learnerId))) return false;
  const { error } = await supabase()
    .from("lesson_ratings")
    .upsert(
      { learner_id: learnerId, lesson_id: r.lessonId, rating: r.rating, comment: r.comment || null, updated_at: new Date().toISOString() },
      { onConflict: "learner_id,lesson_id" }
    );
  if (error) throw new Error(`rateLesson: ${error.message}`);
  return true;
}

export async function getLessonRating(learnerId: string, lessonId: number) {
  const { data, error } = await supabase().from("lesson_ratings").select("rating, comment").eq("learner_id", learnerId).eq("lesson_id", lessonId).maybeSingle();
  if (error) throw new Error(`getLessonRating: ${error.message}`);
  return data as { rating: 1 | -1; comment: string | null } | null;
}

// ---------- Bookmarks (starred courses, migration 019) ----------

export async function listBookmarks(learnerId: string) {
  const { data, error } = await supabase().from("bookmarks").select("topic_key, topic").eq("learner_id", learnerId).order("created_at");
  if (error) throw new Error(`listBookmarks: ${error.message}`);
  return (data ?? []).map((b) => ({ key: b.topic_key as string, topic: b.topic as string }));
}

export async function addBookmarks(learnerId: string, marks: { key: string; topic: string }[]) {
  if (!marks.length) return;
  const { error } = await supabase()
    .from("bookmarks")
    .upsert(marks.map((m) => ({ learner_id: learnerId, topic_key: m.key, topic: m.topic })), { onConflict: "learner_id,topic_key", ignoreDuplicates: true });
  if (error) throw new Error(`addBookmarks: ${error.message}`);
}

export async function removeBookmark(learnerId: string, key: string) {
  const { error } = await supabase().from("bookmarks").delete().eq("learner_id", learnerId).eq("topic_key", key);
  if (error) throw new Error(`removeBookmark: ${error.message}`);
}

/** Tidies a course away (it still opens), or brings it back. */
export async function setCourseArchived(courseId: number, learnerId: string, archived: boolean) {
  const { error } = await supabase()
    .from("courses")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", courseId)
    .eq("learner_id", learnerId);
  if (error) throw new Error(`setCourseArchived: ${error.message}`);
}

/**
 * Starts a course over from lesson 1. Its lessons aren't deleted: they're
 * taken off the course's path (module_index null), so the learner's streak,
 * certificate, answers and mistakes to review are kept, and the course shows
 * every lesson as not started.
 */
export async function resetCourse(courseId: number, learnerId: string) {
  const { error: lessonsError } = await supabase()
    .from("lessons")
    .update({ module_index: null })
    .eq("course_id", courseId)
    .eq("learner_id", learnerId);
  if (lessonsError) throw new Error(`resetCourse: ${lessonsError.message}`);
  const { error } = await supabase()
    .from("courses")
    .update({ current_module: 0, status: "active", archived_at: null, updated_at: new Date().toISOString() })
    .eq("id", courseId)
    .eq("learner_id", learnerId);
  if (error) throw new Error(`resetCourse: ${error.message}`);
}

/** A course's cast (courses.voices, lib/voices.ts): who speaks in which voice. */
export async function getCourseCast(courseId: number, learnerId: string): Promise<Cast> {
  const { data, error } = await supabase().from("courses").select("voices").eq("id", courseId).eq("learner_id", learnerId).maybeSingle();
  if (error) throw new Error(`getCourseCast: ${error.message}`);
  return readCast(data?.voices);
}

/**
 * Adds characters to a course's cast. Re-reads first and never replaces someone
 * already cast (unless `replace`), so two lines voiced at once can't undo each other.
 */
export async function addToCourseCast(courseId: number, learnerId: string, members: Cast, replace = false) {
  const current = await getCourseCast(courseId, learnerId);
  const next = replace ? { ...current, ...members } : { ...members, ...current };
  const { error } = await supabase().from("courses").update({ voices: next }).eq("id", courseId).eq("learner_id", learnerId);
  if (error) throw new Error(`addToCourseCast: ${error.message}`);
  return next;
}

/** Records that a learner reached a step of a lesson (0 = opened it). Only their own lessons. */
export async function recordLessonView(learnerId: string, lessonId: number, step: number, stepCount: number) {
  const { data: lesson, error: findError } = await supabase()
    .from("lessons")
    .select("id")
    .eq("id", lessonId)
    .eq("learner_id", learnerId)
    .maybeSingle();
  if (findError) throw new Error(`recordLessonView: ${findError.message}`);
  if (!lesson) return false;
  const { error } = await supabase()
    .from("lesson_views")
    .insert({ learner_id: learnerId, lesson_id: lessonId, step, step_count: stepCount });
  if (error) throw new Error(`recordLessonView: ${error.message}`);
  return true;
}

// ---------- Plans, usage and reports ----------

export type SubscriptionRow = {
  learner_id: string;
  paddle_customer_id: string;
  paddle_subscription_id: string;
  status: "active" | "trialing" | "past_due" | "paused" | "canceled";
  price_id: string;
  plan: "monthly" | "yearly";
  current_period_end: string | null;
  canceled_at: string | null;
  /** The partner whose link the learner bought through, from the checkout. */
  referred_by?: string | null;
};

/** The learner's subscription, if they ever had one (rows are written by the Paddle webhook). */
export async function getSubscription(learnerId: string) {
  const { data, error } = await supabase().from("subscriptions").select("*").eq("learner_id", learnerId).maybeSingle();
  if (error) throw new Error(`getSubscription: ${error.message}`);
  return data as SubscriptionRow | null;
}

/** What the learner has used since `since`: lessons written, lessons painted, courses started. */
export async function getUsageSince(learnerId: string, since: Date) {
  const iso = since.toISOString();
  const count = async (table: "lessons" | "courses", painted = false) => {
    let q = supabase().from(table).select("id", { count: "exact", head: true }).eq("learner_id", learnerId).gte("created_at", iso);
    if (painted) q = q.not("lesson_data->staging", "is", null);
    const { count: n, error } = await q;
    if (error) throw new Error(`getUsageSince(${table}): ${error.message}`);
    return n ?? 0;
  };
  const [lessons, painted, courses] = await Promise.all([count("lessons"), count("lessons", true), count("courses")]);
  return { lessons, painted, courses };
}

/** Saves a learner's report of a mistake in one of their lessons. */
export async function insertLessonReport(
  learnerId: string,
  report: { lessonId: number; step: number; kind: "wrong_fact" | "confusing" | "broken" | "other"; message: string }
) {
  const owned = await getLessonForLearner(report.lessonId, learnerId);
  if (!owned) return false;
  const { error } = await supabase().from("lesson_reports").insert({
    learner_id: learnerId,
    lesson_id: report.lessonId,
    step: report.step,
    kind: report.kind,
    message: report.message,
  });
  if (error) throw new Error(`insertLessonReport: ${error.message}`);
  return true;
}

// Billing events arrive from Paddle with no signed-in learner, so they are
// written with the server's secret key. The webhook, the shared caches and the
// admin panel (lib/admin.ts, only after requireAdmin()) use this client.
let admin: SupabaseClient | null = null;

export function adminSupabase(): SupabaseClient {
  admin ??= createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false },
  });
  return admin;
}

/** Mirrors a subscription Paddle reported. Only the verified Paddle webhook calls this. */
export async function upsertSubscription(row: SubscriptionRow) {
  const { error } = await adminSupabase()
    .from("subscriptions")
    .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "learner_id" });
  if (error) throw new Error(`upsertSubscription: ${error.message}`);
}

// ---------- Creator partners (docs/CREATORS.md) ----------

export type Partner = { code: string; name: string; url: string | null; discount_code: string | null };
export type Companion = { slug: string; topic: string; title: string; blurb: string; video_url: string | null; partner: Partner };

const PARTNER_COLUMNS = "code, name, url, discount_code";

/** An active partner by referral code, or null. Readable signed out (only public columns). */
export async function getPartner(code: string) {
  const { data, error } = await supabase().from("partners").select(PARTNER_COLUMNS).eq("code", code).eq("active", true).maybeSingle();
  if (error) throw new Error(`getPartner: ${error.message}`);
  return data as Partner | null;
}

/** An active companion page with its partner, or null. Readable signed out. */
export async function getCompanion(slug: string) {
  const { data, error } = await supabase()
    .from("companions")
    .select(`slug, topic, title, blurb, video_url, partner:partners!inner(${PARTNER_COLUMNS})`)
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();
  if (error) throw new Error(`getCompanion: ${error.message}`);
  return data as unknown as Companion | null;
}

/** The partner who referred the learner, if any (the first referral is kept). */
export async function getReferral(learnerId: string) {
  const { data, error } = await supabase().from("profiles").select("referred_by").eq("id", learnerId).maybeSingle();
  if (error) throw new Error(`getReferral: ${error.message}`);
  return (data?.referred_by as string | null | undefined) ?? null;
}

// ---------- Shared course plans (the plan cache) ----------

export type CachedPlan = {
  topic_key: string;
  topic: string;
  title: string;
  description: string;
  modules: ModulePlan[];
  cover_url: string | null;
  world_road: { x: number; y: number }[] | null;
};

const PLAN_COLUMNS = "topic_key, topic, title, description, modules, cover_url, world_road";

/** The cached plan for a topic, if one was made with the current planning guide. */
export async function getCachedPlan(topicKey: string, plannerVersion: string) {
  const { data, error } = await supabase()
    .from("course_plans")
    .select(PLAN_COLUMNS)
    .eq("topic_key", topicKey)
    .eq("planner_version", plannerVersion)
    .maybeSingle();
  if (error) throw new Error(`getCachedPlan: ${error.message}`);
  return data as CachedPlan | null;
}

/** An embedding as pgvector text, "[0.1,0.2,…]". */
const asVector = (v: number[]) => `[${v.join(",")}]`;

/** The cached plans whose topics are closest in meaning, closest first. */
export async function matchCoursePlans(embedding: number[], plannerVersion: string, count = 3) {
  const { data, error } = await supabase().rpc("match_course_plans", { query: asVector(embedding), version: plannerVersion, max_results: count });
  if (error) throw new Error(`matchCoursePlans: ${error.message}`);
  return (data ?? []) as { topic_key: string; topic: string; title: string; description: string; similarity: number }[];
}

/** Whether the server can write shared rows (the plan cache, subscriptions). */
export const canWriteShared = () => !!env("SUPABASE_SECRET_KEY");

/** Caches a plan for its topic (server key only). An existing plan for the topic is kept. */
export async function cachePlan(plan: {
  topicKey: string;
  topic: string;
  title: string;
  description: string;
  modules: ModulePlan[];
  plannerVersion: string;
  embedding: number[] | null;
}) {
  const { error } = await adminSupabase().from("course_plans").upsert(
    {
      topic_key: plan.topicKey,
      topic: plan.topic,
      title: plan.title,
      description: plan.description,
      modules: plan.modules,
      planner_version: plan.plannerVersion,
      ...(plan.embedding ? { embedding: asVector(plan.embedding) } : {}),
    },
    { onConflict: "topic_key", ignoreDuplicates: true }
  );
  if (error) throw new Error(`cachePlan: ${error.message}`);
}

/** Saves a course world onto the shared plan the course came from, if it has none (server key only). */
export async function cachePlanCover(planKey: string, coverUrl: string) {
  const { error } = await adminSupabase()
    .from("course_plans")
    .update({ cover_url: coverUrl, updated_at: new Date().toISOString() })
    .eq("topic_key", planKey)
    .is("cover_url", null);
  if (error) throw new Error(`cachePlanCover: ${error.message}`);
}

/** Saves the road traced in a course's world ([] when tracing failed, so it isn't retried). */
export async function saveWorldRoad(courseId: number, road: { x: number; y: number }[]) {
  const { error } = await supabase().from("courses").update({ world_road: road }).eq("id", courseId);
  if (error) throw new Error(`saveWorldRoad: ${error.message}`);
}

/** Saves a world's traced road onto the shared plan whose world it is (server key only). */
export async function cachePlanRoad(planKey: string, coverUrl: string, road: { x: number; y: number }[]) {
  const { error } = await adminSupabase()
    .from("course_plans")
    .update({ world_road: road, updated_at: new Date().toISOString() })
    .eq("topic_key", planKey)
    .eq("cover_url", coverUrl);
  if (error) throw new Error(`cachePlanRoad: ${error.message}`);
}

/** A shared plan's lesson (any lesson number), if one was cached by the current lesson writer. */
export async function getSharedLesson(planKey: string, moduleIndex: number, lessonVersion: string) {
  const { data, error } = await supabase()
    .from("shared_lessons")
    .select("lesson, score")
    .eq("plan_key", planKey)
    .eq("module_index", moduleIndex)
    .eq("lesson_version", lessonVersion)
    .maybeSingle();
  if (error) throw new Error(`getSharedLesson: ${error.message}`);
  return data ? { lesson: data.lesson as Lesson, score: Number(data.score) } : null;
}

/** Caches a lesson for a shared plan; an existing one for that lesson and writer is kept (server key only). */
export async function cacheSharedLesson(planKey: string, moduleIndex: number, lesson: Lesson, score: number, lessonVersion: string) {
  const { error } = await adminSupabase()
    .from("shared_lessons")
    .upsert(
      { plan_key: planKey, module_index: moduleIndex, lesson_version: lessonVersion, lesson, score },
      { onConflict: "plan_key,module_index,lesson_version", ignoreDuplicates: true }
    );
  if (error) throw new Error(`cacheSharedLesson: ${error.message}`);
}

/**
 * Adds a staged shared lesson's scenes and "Go deeper" to the shared copy, so
 * later learners don't pay to paint them (server key only). Only fills a copy
 * that has no scenes yet.
 */
export async function addSharedLessonStaging(
  shared: { planKey: string; moduleIndex: number; version: string },
  extras: Pick<Lesson, "staging" | "resources">
) {
  const db = adminSupabase();
  const { data, error } = await db
    .from("shared_lessons")
    .select("lesson")
    .eq("plan_key", shared.planKey)
    .eq("module_index", shared.moduleIndex)
    .eq("lesson_version", shared.version)
    .maybeSingle();
  if (error) throw new Error(`addSharedLessonStaging: ${error.message}`);
  const cached = (data as { lesson?: Lesson } | null)?.lesson;
  if (!cached || cached.staging) return;
  const { error: updateError } = await db
    .from("shared_lessons")
    .update({ lesson: { ...cached, ...extras }, updated_at: new Date().toISOString() })
    .eq("plan_key", shared.planKey)
    .eq("module_index", shared.moduleIndex)
    .eq("lesson_version", shared.version);
  if (updateError) throw new Error(`addSharedLessonStaging: ${updateError.message}`);
}

/** The shared plan a course belongs to, if any. */
export async function getCoursePlanKey(courseId: number) {
  const { data, error } = await supabase().from("courses").select("plan_key").eq("id", courseId).maybeSingle();
  if (error) throw new Error(`getCoursePlanKey: ${error.message}`);
  return (data?.plan_key as string | null | undefined) ?? null;
}

// ---------- Runs (traces and costs) ----------

export type RunRecord = {
  kind: "learn" | "stage" | "cover";
  topic?: string | null;
  lessonId?: number | null;
  outcome?: string | null;
  ok: boolean;
  error?: string | null;
  ms: number;
  usage: { cost: number; calls: number; promptTokens: number; completionTokens: number };
  trace?: unknown[];
};

/** Records a run's trace, time and cost as the learner. Never throws: a run isn't failed by its log. */
export async function recordRun(learnerId: string, run: RunRecord) {
  try {
    const { error } = await supabase()
      .from("runs")
      .insert({
        learner_id: learnerId,
        kind: run.kind,
        topic: run.topic ?? null,
        lesson_id: run.lessonId ?? null,
        outcome: run.outcome ?? null,
        ok: run.ok,
        error: run.error ? run.error.slice(0, 2000) : null,
        ms: Math.round(run.ms),
        cost_usd: Number(run.usage.cost.toFixed(5)),
        calls: run.usage.calls,
        tokens_in: run.usage.promptTokens,
        tokens_out: run.usage.completionTokens,
        trace: run.trace ?? [],
      });
    if (error) console.error("recordRun:", error.message);
  } catch (e) {
    console.error("recordRun:", e);
  }
}

// ---------- Lesson jobs (lib/jobs.ts) ----------

export type JobRow = {
  id: string;
  learner_id: string;
  kind: "learn" | "ahead";
  topic: string;
  topic_key: string;
  status: "running" | "done" | "failed";
  result: unknown;
  error: string | null;
  ref: string | null;
  retryable: boolean | null;
  /** The learner's brief for a tailored course (with its materials' text), if any. */
  intake?: Intake | null;
  created_at: string;
  updated_at: string;
};

export async function insertJob(job: { learnerId: string; kind: JobRow["kind"]; topic: string; topicKey: string; intake?: Intake | null }) {
  const { data, error } = await supabase()
    .from("jobs")
    .insert({ learner_id: job.learnerId, kind: job.kind, topic: job.topic, topic_key: job.topicKey, ...(job.intake ? { intake: job.intake } : {}) })
    .select("*")
    .single();
  if (error) throw new Error(`insertJob: ${error.message}`);
  return data as JobRow;
}

export async function getJob(id: string, learnerId: string) {
  const { data, error } = await supabase().from("jobs").select("*").eq("id", id).eq("learner_id", learnerId).maybeSingle();
  if (error) throw new Error(`getJob: ${error.message}`);
  return data as JobRow | null;
}

/** The learner's running jobs, newest first (optionally for one topic). */
export async function runningJobs(learnerId: string, topicKey?: string) {
  let q = supabase().from("jobs").select("*").eq("learner_id", learnerId).eq("status", "running").order("created_at", { ascending: false }).limit(20);
  if (topicKey) q = q.eq("topic_key", topicKey);
  const { data, error } = await q;
  if (error) throw new Error(`runningJobs: ${error.message}`);
  return (data ?? []) as JobRow[];
}

export async function updateJob(id: string, patch: Partial<Pick<JobRow, "status" | "result" | "error" | "ref" | "retryable" | "intake">>) {
  const { error } = await supabase().from("jobs").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(`updateJob: ${error.message}`);
}

// ---------- Course materials (tailored courses) ----------

/** Saves a course's material passages with their embeddings. */
export async function insertMaterials(
  learnerId: string,
  courseId: number,
  rows: { source: string; chunkIndex: number; content: string; embedding: number[] | null }[]
) {
  if (!rows.length) return;
  const { error } = await supabase()
    .from("course_materials")
    .insert(
      rows.map((r) => ({
        learner_id: learnerId,
        course_id: courseId,
        source: r.source,
        chunk_index: r.chunkIndex,
        content: r.content,
        ...(r.embedding ? { embedding: asVector(r.embedding) } : {}),
      }))
    );
  if (error) throw new Error(`insertMaterials: ${error.message}`);
}

/** The passages of a course's materials closest in meaning to a query. */
export async function matchMaterials(courseId: number, embedding: number[], count = 5) {
  const { data, error } = await supabase().rpc("match_course_materials", { course: courseId, query: asVector(embedding), max_results: count });
  if (error) throw new Error(`matchMaterials: ${error.message}`);
  return (data ?? []) as { source: string; chunk_index: number; content: string; similarity: number }[];
}

/** The first passages of a course's materials, in order (when matching isn't possible). */
export async function firstMaterials(courseId: number, count = 4) {
  const { data, error } = await supabase()
    .from("course_materials")
    .select("source, chunk_index, content")
    .eq("course_id", courseId)
    .order("id", { ascending: true })
    .limit(count);
  if (error) throw new Error(`firstMaterials: ${error.message}`);
  return (data ?? []) as { source: string; chunk_index: number; content: string }[];
}

// ---------- certificates, notifications, browser push (migration 015) ----------

export type CertificateRow = {
  id: string;
  learner_id: string;
  course_id: number;
  learner_name: string;
  course_title: string;
  topic: string;
  levels: string[];
  lessons: number;
  minutes: number;
  accuracy: number | null;
  completed_at: string;
  created_at: string;
};

/** The learner's certificate for a course, if issued. */
export async function getCertificateForCourse(courseId: number) {
  const { data, error } = await supabase().from("certificates").select("*").eq("course_id", courseId).maybeSingle();
  if (error) throw new Error(`getCertificateForCourse: ${error.message}`);
  return data as CertificateRow | null;
}

/** The signed-in learner's certificates, newest first. */
export async function listCertificates(learnerId: string) {
  const { data, error } = await supabase().from("certificates").select("*").eq("learner_id", learnerId).order("completed_at", { ascending: false });
  if (error) throw new Error(`listCertificates: ${error.message}`);
  return (data ?? []) as CertificateRow[];
}

/** Saves a certificate; a course already certified keeps its first one. Returns the stored row. */
export async function insertCertificate(row: Omit<CertificateRow, "created_at">) {
  const { error } = await supabase().from("certificates").insert(row);
  if (error && error.code !== "23505") throw new Error(`insertCertificate: ${error.message}`);
  return getCertificateForCourse(row.course_id);
}

/** A certificate by its id, for its public page (server key: certificates can't be listed by anyone else). */
export async function getPublicCertificate(id: string) {
  if (!/^[A-Za-z0-9]{10,32}$/.test(id) || !canWriteShared()) return null;
  const { data, error } = await adminSupabase().from("certificates").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`getPublicCertificate: ${error.message}`);
  return data as CertificateRow | null;
}

export type NotificationKind = "lesson_ready" | "streak" | "certificate" | "reminder" | "recap";
export type NotificationRow = { id: number; kind: NotificationKind; title: string; body: string; href: string | null; read_at: string | null; created_at: string };

/** Saves a notification for the bell. Uses the learner's own client in a request, the server key otherwise (cron). */
export async function insertNotification(learnerId: string, n: { kind: NotificationKind; title: string; body: string; href: string | null }, asServer = false) {
  const client = asServer ? adminSupabase() : supabase();
  const { error } = await client.from("notifications").insert({ learner_id: learnerId, ...n });
  if (error) throw new Error(`insertNotification: ${error.message}`);
}

export async function listNotifications(learnerId: string, limit = 30) {
  const { data, error } = await supabase().from("notifications").select("id, kind, title, body, href, read_at, created_at").eq("learner_id", learnerId).order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(`listNotifications: ${error.message}`);
  return (data ?? []) as NotificationRow[];
}

/** Marks the learner's notifications read (all, or the ones given). */
export async function markNotificationsRead(learnerId: string, ids?: number[]) {
  let q = supabase().from("notifications").update({ read_at: new Date().toISOString() }).eq("learner_id", learnerId).is("read_at", null);
  if (ids?.length) q = q.in("id", ids);
  const { error } = await q;
  if (error) throw new Error(`markNotificationsRead: ${error.message}`);
}

export type PushSubscriptionRow = { endpoint: string; learner_id: string; p256dh: string; auth: string };

export async function savePushSubscription(row: PushSubscriptionRow) {
  const { error } = await supabase().from("push_subscriptions").upsert(row, { onConflict: "endpoint" });
  if (error) throw new Error(`savePushSubscription: ${error.message}`);
}

export async function deletePushSubscription(endpoint: string, asServer = false) {
  const { error } = await (asServer ? adminSupabase() : supabase()).from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) throw new Error(`deletePushSubscription: ${error.message}`);
}

export async function listPushSubscriptions(learnerId: string, asServer = false) {
  const { data, error } = await (asServer ? adminSupabase() : supabase()).from("push_subscriptions").select("endpoint, learner_id, p256dh, auth").eq("learner_id", learnerId);
  if (error) throw new Error(`listPushSubscriptions: ${error.message}`);
  return (data ?? []) as PushSubscriptionRow[];
}

/** Days (in the learner's time zone) on which they finished a lesson, newest first, for the streak. */
export async function completionTimes(learnerId: string, asServer = false) {
  const { data, error } = await (asServer ? adminSupabase() : supabase())
    .from("lessons")
    .select("completed_at")
    .eq("learner_id", learnerId)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(400);
  if (error) throw new Error(`completionTimes: ${error.message}`);
  return (data ?? []).map((r) => r.completed_at as string);
}

export type ReminderProfile = { id: string; display_name: string | null; timezone: string | null; reminders: boolean; last_reminded_on: string | null; last_recap_on: string | null };

/** Profiles that may get today's reminder (server key, for the cron route). */
export async function reminderCandidates() {
  const { data, error } = await adminSupabase().from("profiles").select("id, display_name, timezone, reminders, last_reminded_on, last_recap_on").eq("reminders", true).limit(5000);
  if (error) throw new Error(`reminderCandidates: ${error.message}`);
  return (data ?? []) as ReminderProfile[];
}

export async function markReminded(learnerId: string, day: string) {
  const { error } = await adminSupabase().from("profiles").update({ last_reminded_on: day }).eq("id", learnerId);
  if (error) throw new Error(`markReminded: ${error.message}`);
}

/** What the weekly recap needs (server key, for the cron route): lessons finished in the last 7 days, and the next lesson. */
export async function recapData(learnerId: string) {
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [{ data: week, error }, { data: course, error: courseError }] = await Promise.all([
    adminSupabase().from("lessons").select("minutes:lesson_data->estimatedMinutes").eq("learner_id", learnerId).gte("completed_at", since),
    adminSupabase()
      .from("courses")
      .select("title, modules, current_module")
      .eq("learner_id", learnerId)
      .eq("status", "active")
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (error) throw new Error(`recapData: ${error.message}`);
  if (courseError) throw new Error(`recapData: ${courseError.message}`);
  const lesson = course ? (course.modules as { title?: string }[])?.[course.current_module as number]?.title : undefined;
  return {
    week: (week ?? []).map((l) => ({ minutes: Number((l as { minutes: unknown }).minutes) })),
    next: course && lesson ? { course: course.title as string, lesson } : null,
  };
}

export async function markRecapped(learnerId: string, day: string) {
  const { error } = await adminSupabase().from("profiles").update({ last_recap_on: day }).eq("id", learnerId);
  if (error) throw new Error(`markRecapped: ${error.message}`);
}

/** The name a certificate carries: the profile's display name, else the account's (e.g. from Google). */
export async function learnerName(learnerId: string) {
  const profile = await getProfileBasics(learnerId).catch(() => null);
  if (profile?.display_name?.trim()) return profile.display_name.trim();
  const { data } = await supabase().auth.getUser().catch(() => ({ data: { user: null } }));
  const meta = data.user?.id === learnerId ? data.user.user_metadata?.full_name : null;
  return typeof meta === "string" && meta.trim() ? meta.trim().slice(0, 80) : "A Wondersity learner";
}

/** The learner's time zone and display name (own client in a request). */
export async function getProfileBasics(learnerId: string, asServer = false) {
  const { data, error } = await (asServer ? adminSupabase() : supabase()).from("profiles").select("display_name, timezone, reminders").eq("id", learnerId).maybeSingle();
  if (error) throw new Error(`getProfileBasics: ${error.message}`);
  return data as { display_name: string | null; timezone: string | null; reminders: boolean } | null;
}
