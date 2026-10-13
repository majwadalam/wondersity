import type { User } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { currentLearner } from "./auth";
import { adminSupabase } from "./db";
import { env } from "./env";

// The admin panel (/admin) reads every learner's rows with the server's secret
// key, so it is only for learners with the admin role (user_roles, migration
// 016). Anyone else, signed in or not, gets a 404: the panel doesn't admit it
// exists. Everything here runs on the server after requireAdmin(); nothing in
// this file is reachable from the browser.

export type Role = "admin";

/** Whether a user has the admin role. Read with the secret key, so it can't be faked by a session. */
export async function isAdmin(userId: string | null | undefined) {
  if (!userId || !env("SUPABASE_SECRET_KEY")) return false;
  const { data, error } = await db().from("user_roles").select("role").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(`isAdmin: ${error.message}`);
  return data?.role === "admin";
}

/** The signed-in admin, or a 404. Call first in every admin page, layout and action. */
export async function requireAdmin() {
  const session = await currentLearner();
  if (!session || !(await isAdmin(session.user.id))) notFound();
  return session.user;
}

/** Gives a user a role, or takes it away (role null). Only called after requireAdmin(). */
export async function setRole(userId: string, role: Role | null, actor: Actor) {
  const r = role
    ? await db().from("user_roles").upsert({ user_id: userId, role, granted_by: actor.id }, { onConflict: "user_id" })
    : await db().from("user_roles").delete().eq("user_id", userId);
  if (r.error) throw new Error(`setRole: ${r.error.message}`);
  const user = await getUser(userId);
  await logAction(actor, {
    action: role ? "grant_role" : "remove_role",
    targetType: "learner",
    targetId: userId,
    summary: role ? `Made ${user?.email ?? userId} an admin` : `Removed admin from ${user?.email ?? userId}`,
  });
}

/** Every user's role, by user id. */
export async function rolesById() {
  const r = await db().from("user_roles").select("user_id, role, created_at");
  return new Map((check("user_roles", r) ?? []).map((x) => [x.user_id as string, x as { role: Role; created_at: string }]));
}

const db = () => adminSupabase();

function check<T>(what: string, r: { data: T; error: { message: string } | null }) {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data;
}

const DAY = 86_400_000;
export const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString();

// ---------- Users ----------

export type AdminUser = {
  id: string;
  email: string | null;
  name: string | null;
  avatar: string | null;
  provider: string | null;
  createdAt: string;
  lastSignIn: string | null;
  onboarded: boolean;
  reason: string | null;
  referredBy: string | null;
  plan: string;
  role: Role | null;
};

/** Every account (auth.users) with its profile and plan, newest first. */
export async function listUsers(): Promise<AdminUser[]> {
  const users: User[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await db().auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  const [profiles, subs, roles] = await Promise.all([
    db().from("profiles").select("id, display_name, reason, onboarded_at, referred_by"),
    db().from("subscriptions").select("learner_id, plan, status"),
    rolesById(),
  ]);
  const profile = new Map((check("profiles", profiles) ?? []).map((p) => [p.id as string, p]));
  const sub = new Map((check("subscriptions", subs) ?? []).map((s) => [s.learner_id as string, s]));
  return users
    .map((u) => {
      const p = profile.get(u.id);
      const s = sub.get(u.id);
      const meta = u.user_metadata ?? {};
      return {
        id: u.id,
        email: u.email ?? null,
        name: (p?.display_name as string | null) || (meta.full_name as string | undefined) || (meta.name as string | undefined) || null,
        avatar: (meta.avatar_url as string | undefined) ?? null,
        provider: (u.app_metadata?.provider as string | undefined) ?? null,
        createdAt: u.created_at,
        lastSignIn: u.last_sign_in_at ?? null,
        onboarded: !!p?.onboarded_at,
        reason: (p?.reason as string | null) ?? null,
        referredBy: (p?.referred_by as string | null) ?? null,
        plan: s ? `${s.plan} · ${s.status}` : "free",
        role: roles.get(u.id)?.role ?? null,
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getUser(id: string) {
  const { data, error } = await db().auth.admin.getUserById(id);
  if (error || !data.user) return null;
  return data.user;
}

/** Email by user id, for labelling rows. */
export async function emailsById() {
  const users = await listUsers();
  return new Map(users.map((u) => [u.id, u.email ?? u.name ?? u.id.slice(0, 8)]));
}

// ---------- Runs and spend ----------

export type RunRow = {
  id: number;
  learner_id: string;
  kind: "learn" | "stage" | "cover";
  topic: string | null;
  lesson_id: number | null;
  outcome: string | null;
  ok: boolean;
  error: string | null;
  ms: number;
  cost_usd: number;
  calls: number;
  tokens_in: number;
  tokens_out: number;
  created_at: string;
};

export type TraceEntry = { step?: string; ms?: number; [key: string]: unknown };

const RUN_COLUMNS = "id, learner_id, kind, topic, lesson_id, outcome, ok, error, ms, cost_usd, calls, tokens_in, tokens_out, created_at";

export type RunFilter = { kind?: string; ok?: "ok" | "failed"; learner?: string; lesson?: number; since?: string; page?: number };
export const RUNS_PER_PAGE = 50;

/** Runs, newest first, filtered and paged. */
export async function listRuns(f: RunFilter = {}) {
  let q = db().from("runs").select(RUN_COLUMNS, { count: "exact" });
  if (f.kind) q = q.eq("kind", f.kind);
  if (f.ok) q = q.eq("ok", f.ok === "ok");
  if (f.learner) q = q.eq("learner_id", f.learner);
  if (f.lesson) q = q.eq("lesson_id", f.lesson);
  if (f.since) q = q.gte("created_at", f.since);
  const page = Math.max(0, f.page ?? 0);
  const r = await q.order("created_at", { ascending: false }).range(page * RUNS_PER_PAGE, page * RUNS_PER_PAGE + RUNS_PER_PAGE - 1);
  return { runs: (check("runs", r) ?? []).map(numeric) as RunRow[], total: r.count ?? 0 };
}

export async function getRun(id: number) {
  const r = await db().from("runs").select(`${RUN_COLUMNS}, trace`).eq("id", id).maybeSingle();
  const row = check("run", r);
  return row ? { ...(numeric(row) as RunRow), trace: (row.trace ?? []) as TraceEntry[] } : null;
}

// numeric columns arrive as strings from PostgREST.
function numeric<T extends { cost_usd?: unknown }>(row: T) {
  return { ...row, cost_usd: Number(row.cost_usd ?? 0) };
}

export type CostSteps = Record<string, { calls: number; in: number; out: number; cost: number }>;

/** Learn runs keep a run.cost entry at the end of their trace, split by step. */
export function costSteps(trace: TraceEntry[]): CostSteps | null {
  const last = trace.findLast((t) => t.step === "run.cost");
  return (last?.bySteps as CostSteps | undefined) ?? null;
}

type SpendRun = RunRow & { last: TraceEntry | null; cache: TraceEntry[] };

/**
 * Every run since a date with only the parts of its trace the overview needs:
 * the closing cost entry (spend by step) and the cache steps (hit rates).
 * Capped so a long window can't load an unbounded table.
 */
export async function spendSince(since: string, cap = 5000): Promise<SpendRun[]> {
  const rows: SpendRun[] = [];
  for (let from = 0; from < cap; from += 1000) {
    const r = await db()
      .from("runs")
      .select(`${RUN_COLUMNS}, last:trace->-1, trace`)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .range(from, from + 999);
    const page = check("runs", r) ?? [];
    for (const row of page as unknown as (RunRow & { last: TraceEntry | null; trace: TraceEntry[] })[]) {
      const { trace, ...rest } = row;
      rows.push({
        ...(numeric(rest) as RunRow),
        last: rest.last,
        cache: (trace ?? []).filter((t) => t.step === "plan_cache" || t.step === "lesson_cache" || t.step === "fast_path"),
      });
    }
    if (page.length < 1000) break;
  }
  return rows;
}

export function sumCost(runs: { cost_usd: number }[]) {
  return runs.reduce((n, r) => n + r.cost_usd, 0);
}

/** One value per UTC day for the last `days` days, oldest first, empty days included. */
export function byDay<T>(rows: T[], days: number, date: (r: T) => string, value: (r: T) => number = () => 1) {
  const out = new Map<string, { day: string; value: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * DAY).toISOString().slice(0, 10);
    out.set(day, { day, value: 0 });
  }
  for (const r of rows) {
    const d = out.get(date(r).slice(0, 10));
    if (d) d.value += value(r);
  }
  return [...out.values()];
}

/** Spend per UTC day. */
export const spendByDay = (runs: RunRow[], days: number) => byDay(runs, days, (r) => r.created_at, (r) => r.cost_usd);

/** Runs that wrote a new lesson (not resumed, not reused). */
export const isLessonRun = (r: RunRow) => r.kind === "learn" && (r.outcome === "lesson" || r.outcome === "ahead") && !!r.lesson_id;

export function groupSpend<K extends string>(runs: RunRow[], key: (r: RunRow) => K) {
  const g = new Map<K, { key: K; runs: number; usd: number; failed: number; ms: number[] }>();
  for (const r of runs) {
    const k = key(r);
    const e = g.get(k) ?? { key: k, runs: 0, usd: 0, failed: 0, ms: [] };
    e.runs++;
    e.usd += r.cost_usd;
    if (!r.ok) e.failed++;
    e.ms.push(r.ms);
    g.set(k, e);
  }
  return [...g.values()].sort((a, b) => b.usd - a.usd);
}

export function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
}

/** Spend by step (agent, write, review, …) from the learn runs' cost entries. */
export function spendBySteps(runs: SpendRun[]) {
  const total: CostSteps = {};
  for (const r of runs) {
    const steps = r.last?.step === "run.cost" ? (r.last.bySteps as CostSteps | undefined) : undefined;
    for (const [k, v] of Object.entries(steps ?? {})) {
      const t = (total[k] ??= { calls: 0, in: 0, out: 0, cost: 0 });
      t.calls += v.calls;
      t.in += v.in;
      t.out += v.out;
      t.cost += v.cost;
    }
  }
  return Object.entries(total)
    .map(([step, v]) => ({ step, ...v }))
    .sort((a, b) => b.cost - a.cost);
}

/** Plan and lesson cache hits from the learn runs' traces. */
export function cacheStats(runs: SpendRun[]) {
  const s = {
    plan: { exact: 0, similar: 0, miss: 0 },
    lesson: { hit: 0, miss: 0, ineligible: 0 },
    fastPath: 0,
  };
  for (const r of runs) {
    for (const t of r.cache) {
      if (t.step === "plan_cache") {
        if (t.hit === true) s.plan[t.via === "similar" ? "similar" : "exact"]++;
        else s.plan.miss++;
      } else if (t.step === "lesson_cache") {
        if (t.hit === true) s.lesson.hit++;
        else if (t.eligible === false) s.lesson.ineligible++;
        else s.lesson.miss++;
      } else if (t.step === "fast_path") s.fastPath++;
    }
  }
  return s;
}

// ---------- Counts ----------

/** Rows in a table, optionally only those created since a date, with a column set, or with a column equal to a value. */
export async function count(table: string, opts: { since?: string; notNull?: string; eq?: [string, string] } = {}) {
  let q = db().from(table).select("*", { count: "exact", head: true });
  if (opts.since) q = q.gte("created_at", opts.since);
  if (opts.notNull) q = q.not(opts.notNull, "is", null);
  if (opts.eq) q = q.eq(opts.eq[0], opts.eq[1]);
  const r = await q;
  if (r.error) throw new Error(`count ${table}: ${r.error.message}`);
  return r.count ?? 0;
}

// ---------- Courses and lessons ----------

export type AdminCourse = {
  id: number;
  learner_id: string;
  topic: string;
  title: string;
  description: string;
  modules: { title: string; goal?: string; level?: { title: string } }[];
  current_module: number;
  status: string;
  cover_url: string | null;
  plan_key: string | null;
  intake: Record<string, unknown> | null;
  outcomes: string[] | null;
  created_at: string;
  updated_at: string;
  lessons: { id: number; module_index: number | null; score: number | null; completed_at: string | null; created_at: string }[];
};

const COURSE_COLUMNS =
  "id, learner_id, topic, title, description, modules, current_module, status, cover_url, plan_key, intake, outcomes, created_at, updated_at, lessons(id, module_index, score, completed_at, created_at)";

export async function listCourses(learner?: string) {
  let q = db().from("courses").select(COURSE_COLUMNS);
  if (learner) q = q.eq("learner_id", learner);
  const r = await q.order("updated_at", { ascending: false }).limit(500);
  return (check("courses", r) ?? []) as unknown as AdminCourse[];
}

export async function getCourse(id: number) {
  const r = await db().from("courses").select(COURSE_COLUMNS).eq("id", id).maybeSingle();
  return check("course", r) as unknown as AdminCourse | null;
}

export type AdminLesson = {
  id: number;
  learner_id: string;
  topic: string;
  course_id: number | null;
  module_index: number | null;
  score: number | null;
  created_at: string;
  completed_at: string | null;
  lesson_data: Record<string, unknown>;
};

export async function getLesson(id: number) {
  const r = await db()
    .from("lessons")
    .select("id, learner_id, topic, course_id, module_index, score, created_at, completed_at, lesson_data")
    .eq("id", id)
    .maybeSingle();
  return check("lesson", r) as AdminLesson | null;
}

export async function lessonAttempts(lessonId: number) {
  const r = await db()
    .from("attempts")
    .select("question_index, chosen, correct, created_at")
    .eq("lesson_id", lessonId)
    .order("created_at");
  return (check("attempts", r) ?? []) as { question_index: number; chosen: string; correct: boolean; created_at: string }[];
}

export async function lessonViews(lessonId: number) {
  const r = await db().from("lesson_views").select("step, step_count, created_at").eq("lesson_id", lessonId).order("created_at");
  return (check("lesson_views", r) ?? []) as { step: number; step_count: number; created_at: string }[];
}

/** Every attempt (first answers only are recorded) for learners or lessons, for accuracy. */
export async function attemptsFor(filter: { learner?: string; lessons?: number[] }) {
  let q = db().from("attempts").select("lesson_id, question_index, correct, created_at, learner_id");
  if (filter.learner) q = q.eq("learner_id", filter.learner);
  if (filter.lessons) q = q.in("lesson_id", filter.lessons.length ? filter.lessons : [-1]);
  const r = await q.limit(5000);
  return (check("attempts", r) ?? []) as { lesson_id: number; question_index: number; correct: boolean; created_at: string; learner_id: string }[];
}

// ---------- Caches, jobs, reports, billing ----------

export async function listPlans() {
  const r = await db()
    .from("course_plans")
    .select("topic_key, topic, title, description, modules, cover_url, planner_version, lesson_version, created_at, updated_at")
    .order("updated_at", { ascending: false });
  return (check("course_plans", r) ?? []) as {
    topic_key: string;
    topic: string;
    title: string;
    description: string;
    modules: { title: string }[];
    cover_url: string | null;
    planner_version: string;
    lesson_version: string | null;
    created_at: string;
    updated_at: string;
  }[];
}

export async function listSharedLessons() {
  const r = await db().from("shared_lessons").select("plan_key, module_index, lesson_version, score, created_at");
  return (check("shared_lessons", r) ?? []) as { plan_key: string; module_index: number; lesson_version: string; score: number; created_at: string }[];
}

/** How many learner courses were made from each shared plan. */
export async function coursesPerPlan() {
  const r = await db().from("courses").select("plan_key").not("plan_key", "is", null);
  const n = new Map<string, number>();
  for (const c of check("courses", r) ?? []) n.set(c.plan_key as string, (n.get(c.plan_key as string) ?? 0) + 1);
  return n;
}

export type JobRow = {
  id: string;
  learner_id: string;
  kind: string;
  topic: string;
  status: string;
  error: string | null;
  ref: string | null;
  created_at: string;
  updated_at: string;
};

export async function listJobs(limit = 200) {
  const r = await db()
    .from("jobs")
    .select("id, learner_id, kind, topic, status, error, ref, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (check("jobs", r) ?? []) as JobRow[];
}

/** lib/jobs.ts treats a running job untouched for 6 minutes as failed. */
export const isStale = (j: JobRow) => j.status === "running" && Date.now() - Date.parse(j.updated_at) > 6 * 60_000;

export async function listSubscriptions() {
  const r = await db().from("subscriptions").select("*").order("updated_at", { ascending: false });
  return (check("subscriptions", r) ?? []) as Record<string, string | null>[];
}

export async function listPartners() {
  const [p, c, prof] = await Promise.all([
    db().from("partners").select("*").order("created_at", { ascending: false }),
    db().from("companions").select("*").order("created_at", { ascending: false }),
    db().from("profiles").select("referred_by").not("referred_by", "is", null),
  ]);
  const signups = new Map<string, number>();
  for (const r of check("profiles", prof) ?? []) signups.set(r.referred_by as string, (signups.get(r.referred_by as string) ?? 0) + 1);
  return {
    partners: (check("partners", p) ?? []) as Record<string, unknown>[],
    companions: (check("companions", c) ?? []) as Record<string, unknown>[],
    signups,
  };
}

/** Total spend over every run ever recorded (only the cost column is read). */
export async function allTimeSpend() {
  let total = 0;
  let runs = 0;
  for (let from = 0; ; from += 1000) {
    const r = await db().from("runs").select("cost_usd").order("id").range(from, from + 999);
    const page = check("runs", r) ?? [];
    for (const row of page) total += Number(row.cost_usd ?? 0);
    runs += page.length;
    if (page.length < 1000) break;
  }
  return { total, runs };
}

/** Every row of a table's columns, 1000 at a time (PostgREST's page size), up to a cap. */
export async function selectAll<T>(table: string, columns: string, eq?: [string, string], cap = 100_000): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < cap; from += 1000) {
    let q = db().from(table).select(columns);
    if (eq) q = q.eq(eq[0], eq[1]);
    const page = (check(table, await q.order("created_at").range(from, from + 999)) ?? []) as T[];
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

/** Saved lessons scoring under the bar (8 of 10): shown only when no version passed. */
export async function weakLessons() {
  const r = await db()
    .from("lessons")
    .select("id, learner_id, topic, course_id, module_index, score, created_at, title:lesson_data->>title")
    .lt("score", 8)
    .order("created_at", { ascending: false })
    .limit(500);
  return (check("lessons", r) ?? []) as unknown as { id: number; learner_id: string; topic: string; course_id: number | null; module_index: number | null; score: number; created_at: string; title: string }[];
}

/** Every mistake report, newest first. */
export async function allReports() {
  return (await selectAll<{ id: number; learner_id: string; lesson_id: number; step: number; kind: string; message: string | null; created_at: string }>(
    "lesson_reports",
    "id, learner_id, lesson_id, step, kind, message, created_at"
  )).reverse();
}

/** Every lesson rating, newest first (thumbs down are the ones to read). */
export async function allRatings() {
  return (await selectAll<{ learner_id: string; lesson_id: number; rating: number; comment: string | null; created_at: string; updated_at: string }>(
    "lesson_ratings",
    "learner_id, lesson_id, rating, comment, created_at, updated_at"
  )).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export type SupportMessage = { id: number; learner_id: string | null; email: string | null; kind: string; message: string; page: string | null; created_at: string; resolved_at: string | null };

/** Every message from the Help page, newest first. */
export async function allMessages() {
  return (await selectAll<SupportMessage>("support_messages", "id, learner_id, email, kind, message, page, created_at, resolved_at")).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Marks a Help message answered (or open again). */
export async function resolveMessage(actor: Actor, id: number, resolved: boolean) {
  const r = await db().from("support_messages").update({ resolved_at: resolved ? new Date().toISOString() : null }).eq("id", id).select("email, kind").maybeSingle();
  if (r.error) throw new Error(`resolveMessage: ${r.error.message}`);
  if (!r.data) throw new Error("That message no longer exists.");
  await logAction(actor, {
    action: resolved ? "resolve_message" : "reopen_message",
    targetType: "message",
    targetId: id,
    summary: `${resolved ? "Marked answered" : "Reopened"} a ${r.data.kind} message from ${r.data.email ?? "a learner"}`,
  });
}

/** Whether a timestamp falls within the last `days` days. */
export const isRecent = (iso: string, days: number) => Date.parse(iso) > Date.now() - days * DAY;

// ---------- Changes from the panel (each one logged in admin_actions) ----------

export type Actor = { id: string; email?: string | null };

/** Records a change made from the panel: who, what, and the before and after. */
export async function logAction(actor: Actor, a: { action: string; targetType: string; targetId: string | number; summary: string; before?: unknown; after?: unknown }) {
  const r = await db()
    .from("admin_actions")
    .insert({
      admin_id: actor.id,
      admin_email: actor.email ?? null,
      action: a.action,
      target_type: a.targetType,
      target_id: String(a.targetId),
      summary: a.summary,
      before: a.before ?? null,
      after: a.after ?? null,
    });
  if (r.error) throw new Error(`logAction: ${r.error.message}`);
}

export type AdminAction = {
  id: number;
  admin_email: string | null;
  action: string;
  target_type: string;
  target_id: string;
  summary: string;
  before: unknown;
  after: unknown;
  created_at: string;
};

export async function listActions(opts: { page?: number; target?: [string, string] } = {}) {
  let q = db().from("admin_actions").select("*", { count: "exact" });
  if (opts.target) q = q.eq("target_type", opts.target[0]).eq("target_id", opts.target[1]);
  const page = opts.page ?? 0;
  const r = await q.order("created_at", { ascending: false }).range(page * 50, page * 50 + 49);
  return { actions: (check("admin_actions", r) ?? []) as AdminAction[], total: r.count ?? 0 };
}

async function courseRow(id: number) {
  const r = await db().from("courses").select("id, learner_id, title, description, modules, current_module, status, outcomes, intake").eq("id", id).maybeSingle();
  const row = check("course", r);
  if (!row) throw new Error("That course no longer exists.");
  return row as { id: number; learner_id: string; title: string; description: string; modules: Record<string, unknown>[]; current_module: number; status: string; outcomes: string[] | null; intake: unknown };
}

async function lessonsOf(courseId: number) {
  const r = await db().from("lessons").select("id, module_index, completed_at").eq("course_id", courseId);
  return (check("lessons", r) ?? []) as { id: number; module_index: number | null; completed_at: string | null }[];
}

const touch = () => ({ updated_at: new Date().toISOString() });

/** A course's title and description. */
export async function editCourse(actor: Actor, id: number, next: { title: string; description: string }) {
  const before = await courseRow(id);
  const patch = { title: next.title, description: next.description };
  const r = await db().from("courses").update({ ...patch, ...touch() }).eq("id", id);
  if (r.error) throw new Error(`editCourse: ${r.error.message}`);
  await logAction(actor, {
    action: "edit_course",
    targetType: "course",
    targetId: id,
    summary: `Edited the course “${next.title}”`,
    before: { title: before.title, description: before.description },
    after: patch,
  });
}

/** A planned lesson's title and goal. Only lessons not written yet: a written one already teaches what it teaches. */
export async function editModule(actor: Actor, courseId: number, index: number, next: { title: string; goal: string }) {
  const course = await courseRow(courseId);
  if (!course.modules[index]) throw new Error("That lesson isn't in the course.");
  if ((await lessonsOf(courseId)).some((l) => l.module_index === index)) throw new Error("This lesson is already written; rewrite it instead.");
  const before = course.modules[index];
  const modules = course.modules.map((m, i) => (i === index ? { ...m, title: next.title, goal: next.goal } : m));
  const r = await db().from("courses").update({ modules, ...touch() }).eq("id", courseId);
  if (r.error) throw new Error(`editModule: ${r.error.message}`);
  await logAction(actor, {
    action: "edit_lesson_plan",
    targetType: "course",
    targetId: courseId,
    summary: `Changed lesson ${index + 1} of “${course.title}” to “${next.title}”`,
    before: { title: before.title, goal: before.goal },
    after: next,
  });
}

/** Moves the learner to a lesson: the next one they open is that one. */
export async function moveLearner(actor: Actor, courseId: number, index: number) {
  const course = await courseRow(courseId);
  if (index < 0 || index >= course.modules.length) throw new Error("That lesson isn't in the course.");
  const r = await db().from("courses").update({ current_module: index, status: "active", ...touch() }).eq("id", courseId);
  if (r.error) throw new Error(`moveLearner: ${r.error.message}`);
  await logAction(actor, {
    action: "move_learner",
    targetType: "course",
    targetId: courseId,
    summary: `Moved the learner in “${course.title}” from lesson ${course.current_module + 1} to lesson ${index + 1}`,
    before: { current_module: course.current_module, status: course.status },
    after: { current_module: index, status: "active" },
  });
}

/**
 * Deletes an unfinished lesson so the tutor writes a fresh one when the
 * learner next opens it (lib/harness.ts writes any lesson that's missing).
 * Its answers and views go with it. Finished lessons are kept: they're the
 * learner's record.
 */
export async function rewriteLesson(actor: Actor, lessonId: number) {
  const r0 = await db().from("lessons").select("id, course_id, module_index, completed_at, score, title:lesson_data->>title").eq("id", lessonId).maybeSingle();
  const lesson = check("lesson", r0) as { id: number; course_id: number | null; module_index: number | null; completed_at: string | null; score: number | null; title: string } | null;
  if (!lesson) throw new Error("That lesson no longer exists.");
  if (lesson.completed_at) throw new Error("The learner finished this lesson, so it's kept.");
  const r = await db().from("lessons").delete().eq("id", lessonId);
  if (r.error) throw new Error(`rewriteLesson: ${r.error.message}`);
  await logAction(actor, {
    action: "rewrite_lesson",
    targetType: "course",
    targetId: lesson.course_id ?? "none",
    summary: `Sent lesson ${(lesson.module_index ?? 0) + 1} (“${lesson.title}”) back to be rewritten`,
    before: { lessonId, title: lesson.title, score: lesson.score },
  });
  return lesson.course_id;
}

/** Deletes a learner's course with its lessons, answers and certificate. */
export async function deleteCourse(actor: Actor, id: number) {
  const course = await courseRow(id);
  const r = await db().from("courses").delete().eq("id", id);
  if (r.error) throw new Error(`deleteCourse: ${r.error.message}`);
  await logAction(actor, {
    action: "delete_course",
    targetType: "course",
    targetId: id,
    summary: `Deleted the course “${course.title}”`,
    before: { title: course.title, learner_id: course.learner_id, modules: course.modules.length, current_module: course.current_module },
  });
  return course.learner_id;
}

// Shared plans (the reuse cache).

export async function getPlan(key: string) {
  const r = await db()
    .from("course_plans")
    .select("topic_key, topic, title, description, modules, cover_url, planner_version, lesson_version, created_at, updated_at")
    .eq("topic_key", key)
    .maybeSingle();
  return check("course_plan", r) as { topic_key: string; topic: string; title: string; description: string; modules: Record<string, unknown>[]; cover_url: string | null; planner_version: string; created_at: string; updated_at: string } | null;
}

/** A shared plan's title and description. Courses already made from it keep their own copy. */
export async function editPlan(actor: Actor, key: string, next: { title: string; description: string }) {
  const before = await getPlan(key);
  if (!before) throw new Error("That plan no longer exists.");
  const r = await db().from("course_plans").update({ ...next, ...touch() }).eq("topic_key", key);
  if (r.error) throw new Error(`editPlan: ${r.error.message}`);
  await logAction(actor, { action: "edit_plan", targetType: "plan", targetId: key, summary: `Edited the shared plan “${next.title}”`, before: { title: before.title, description: before.description }, after: next });
}

/** A shared plan's lesson title and goal, for the next learners who get it. */
export async function editPlanModule(actor: Actor, key: string, index: number, next: { title: string; goal: string }) {
  const plan = await getPlan(key);
  if (!plan?.modules[index]) throw new Error("That lesson isn't in the plan.");
  const before = plan.modules[index];
  const modules = plan.modules.map((m, i) => (i === index ? { ...m, title: next.title, goal: next.goal } : m));
  const r = await db().from("course_plans").update({ modules, ...touch() }).eq("topic_key", key);
  if (r.error) throw new Error(`editPlanModule: ${r.error.message}`);
  await logAction(actor, {
    action: "edit_plan_lesson",
    targetType: "plan",
    targetId: key,
    summary: `Changed lesson ${index + 1} of the shared plan “${plan.title}” to “${next.title}”`,
    before: { title: before.title, goal: before.goal },
    after: next,
  });
}

/** Stops giving out a saved lesson; the next learner to reach it gets a freshly written one (which is saved again). */
export async function retireSharedLesson(actor: Actor, key: string, index: number, version: string) {
  const r = await db().from("shared_lessons").delete().eq("plan_key", key).eq("module_index", index).eq("lesson_version", version);
  if (r.error) throw new Error(`retireSharedLesson: ${r.error.message}`);
  await logAction(actor, { action: "retire_saved_lesson", targetType: "plan", targetId: key, summary: `Retired saved lesson ${index + 1} of “${key}”`, before: { index, version } });
}

/** Stops reusing a plan (and its saved lessons). Learners' courses made from it are untouched. */
export async function deletePlan(actor: Actor, key: string) {
  const plan = await getPlan(key);
  if (!plan) return;
  const r = await db().from("course_plans").delete().eq("topic_key", key);
  if (r.error) throw new Error(`deletePlan: ${r.error.message}`);
  await logAction(actor, { action: "delete_plan", targetType: "plan", targetId: key, summary: `Stopped reusing the plan “${plan.title}”`, before: { title: plan.title, modules: plan.modules.length } });
}

/**
 * A tailored course's brief: the goal, context, what they already know, and
 * the outcomes. Every lesson still to be written is briefed from these
 * (learnerBriefFor in lib/harness.ts), so this retailors the rest of the course.
 */
export async function editBrief(actor: Actor, id: number, next: { goal: string; context: string; known: string; outcomes: string[] }) {
  const course = await courseRow(id);
  const intake = course.intake as Record<string, unknown> | null;
  if (!intake) throw new Error("This course wasn't tailored, so it has no brief.");
  const updated = { ...intake, goal: next.goal, context: next.context || undefined, known: next.known || undefined };
  const r = await db().from("courses").update({ intake: updated, outcomes: next.outcomes, ...touch() }).eq("id", id);
  if (r.error) throw new Error(`editBrief: ${r.error.message}`);
  await logAction(actor, {
    action: "edit_brief",
    targetType: "course",
    targetId: id,
    summary: `Retailored “${course.title}”`,
    before: { goal: intake.goal, context: intake.context, known: intake.known, outcomes: course.outcomes },
    after: next,
  });
}
