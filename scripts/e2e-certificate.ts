// Certificates, streaks and notifications end to end, through the running
// app's API, with a throwaway learner and no model calls: a two-lesson course
// is written straight to the database, both quizzes are answered through
// /api/attempts, and the script checks the streak, the certificate (its page
// and image), the bell's notifications and the reminder route's guard.
//
//   pnpm dev   # in another terminal
//   node --env-file=.env.local --import tsx scripts/e2e-certificate.ts [outDir]

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createClient, type Session } from "@supabase/supabase-js";
import { normalizeLesson } from "../src/lib/lessonDesign";
import { rawHistoryLesson } from "../src/lib/testFixtures";

const outDir = process.argv[2] ?? "research/runs/18-certificates";
mkdirSync(outDir, { recursive: true });
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

const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, detail = "") => {
  results.push([name, ok, detail]);
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` (${detail})` : ""}`);
};

async function main() {
  const email = `cert-${Date.now()}@wondersity.test`;
  const password = `Cert-${crypto.randomUUID()}`;
  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const id = created.user.id;
  const signed = await createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } }).auth.signInWithPassword({ email, password });
  const cookie = sessionCookie(signed.data.session!);
  const call = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
    const res = await fetch(BASE + path, { method, headers: { cookie, ...(body ? { "Content-Type": "application/json" } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
    const type = res.headers.get("content-type") ?? "";
    return { status: res.status, type, data: type.includes("json") ? await res.json() : type.startsWith("image/") ? Buffer.from(await res.arrayBuffer()) : await res.text() };
  };
  try {
    await call("PATCH", "/api/profile", { onboarded: true, ageConfirmed: true, displayName: "Ada Lovelace", timezone: "Asia/Karachi" });

    // A two-lesson course, written straight to the database.
    const normalized = normalizeLesson(rawHistoryLesson());
    if (!normalized.ok) throw new Error(normalized.error);
    const lesson = normalized.lesson;
    const level = (n: number) => ({ id: `level-${n}`, title: n === 1 ? "Causes" : "Consequences", description: "d", objective: "o" });
    const { data: course } = await admin
      .from("courses")
      .insert({
        learner_id: id,
        topic: "The French Revolution",
        topic_key: "the french revolution",
        title: "The French Revolution: Why 1789?",
        description: "d",
        modules: [
          { id: "level-1-module-1", title: "Debt and bread", goal: "g", description: "d", level: level(1) },
          { id: "level-2-module-1", title: "The Estates-General", goal: "g", description: "d", level: level(2) },
        ],
      })
      .select("id")
      .single();
    const lessonIds: number[] = [];
    for (const module_index of [0, 1]) {
      const { data } = await admin.from("lessons").insert({ learner_id: id, topic: "the french revolution", lesson_data: lesson, score: 8.5, course_id: course!.id, module_index }).select("id").single();
      lessonIds.push(data!.id);
    }
    const answers = lesson.questions.map((q, i) => ({ questionIndex: i, chosen: q.correctAnswer }));

    const first = await call("POST", "/api/attempts", { lessonId: lessonIds[0], answers });
    check("lesson 1 graded", first.status === 200 && first.data.correct === lesson.questions.length, `status ${first.status}`);
    check("streak starts at 1", first.data.rewards?.streak === 1, JSON.stringify(first.data.rewards));
    check("no certificate yet", first.data.rewards?.certificateId === null);

    const second = await call("POST", "/api/attempts", { lessonId: lessonIds[1], answers });
    const certId = second.data.rewards?.certificateId as string | null;
    check("course completed", second.data.course?.status === "completed");
    if (process.env.KEEP) console.log(`certificate page: ${BASE}/certificate/${certId}`);
    check("certificate issued", !!certId && /^[A-Za-z0-9]{14}$/.test(certId), String(certId));
    check("streak still 1 (same day)", second.data.rewards?.streak === 1);

    const again = await call("POST", "/api/attempts", { lessonId: lessonIds[1], answers });
    check("a retake doesn't issue another", again.data.rewards === null && again.data.firstCompletion === false);

    const notes = await call("GET", "/api/notifications");
    const certNote = notes.data.notifications?.find((n: { kind: string }) => n.kind === "certificate");
    check("bell has the certificate", !!certNote && certNote.href === `/certificate/${certId}`, `${notes.data.unread} unread`);
    await call("POST", "/api/notifications", {});
    check("marking read clears the badge", (await call("GET", "/api/notifications")).data.unread === 0);

    const list = await call("GET", "/api/certificates");
    check("listed for the learner", list.data.certificates?.length === 1 && list.data.certificates[0].id === certId);

    // The public page, opened by someone who isn't signed in.
    const page = await fetch(`${BASE}/certificate/${certId}`);
    const html = await page.text();
    check("public page opens signed out", page.status === 200 && html.includes("Ada Lovelace") && html.includes("Why 1789?"));
    check("page asks not to be indexed", /<meta name="robots" content="noindex/.test(html));
    check("unknown certificate is a 404", (await fetch(`${BASE}/certificate/NotARealCertificateId`)).status === 404);
    const img = await fetch(`${BASE}/certificate/${certId}/opengraph-image`);
    const png = Buffer.from(await img.arrayBuffer());
    check("share image is a PNG", img.status === 200 && (img.headers.get("content-type") ?? "").includes("image/png"), `${png.length} bytes`);
    writeFileSync(join(outDir, "certificate.png"), png);
    writeFileSync(join(outDir, "certificate-page.html"), html);

    const cronNoAuth = await fetch(`${BASE}/api/cron/reminders`);
    check("reminders refuse without the secret", cronNoAuth.status === 401);
    const cron = await fetch(`${BASE}/api/cron/reminders`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
    check("reminders run with it", cron.status === 200, JSON.stringify(await cron.json().catch(() => null)));
  } finally {
    // KEEP=1 leaves the learner and certificate in place to look at; run again without it to clean up.
    if (process.env.KEEP) console.log(`kept learner ${id}`);
    else for (const table of ["notifications", "push_subscriptions", "certificates", "attempts", "progress", "lesson_views", "runs", "jobs", "lessons", "courses"]) await admin.from(table).delete().eq("learner_id", id);
    if (!process.env.KEEP) {
      await admin.from("profiles").delete().eq("id", id);
      await admin.auth.admin.deleteUser(id);
    }
  }
  const failed = results.filter(([, ok]) => !ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  writeFileSync(join(outDir, "result.json"), JSON.stringify(results, null, 2));
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
