// End-to-end test of a tailored course ("Tailor it") through the running
// app's HTTP API, with one throwaway learner:
//
//   1. uploads a notes file (/api/materials) and checks its text comes back
//   2. starts a course with a brief (/api/learn with intake) and waits for the job
//   3. checks what was saved: the course's brief and outcomes, the materials'
//      passages and embeddings, each level's outcome, the lesson, and that the
//      lesson brief carried material excerpts (the run's trace)
//
// The learner is kept with --keep (it prints a session cookie for a browser
// check); otherwise it and its data are deleted at the end.
//
//   pnpm dev   # in another terminal
//   node --env-file=.env.local --import tsx scripts/e2e-tailored.ts research/runs/14-tailored [slides.pdf] [--keep --cookie-file=/tmp/x.json]
//   node --env-file=.env.local --import tsx scripts/e2e-tailored.ts --delete <learner id>

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type Session } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
const ref = new URL(url).hostname.split(".")[0];

function sessionCookie(session: Session) {
  const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  const name = `sb-${ref}-auth-token`;
  if (value.length <= 3180) return [{ name, value }];
  return value.match(/.{1,3180}/g)!.map((v, i) => ({ name: `${name}.${i}`, value: v }));
}

async function cleanUp(id: string) {
  for (const table of ["attempts", "progress", "lesson_views", "lesson_reports", "runs", "jobs", "course_materials", "lessons", "courses"]) {
    await admin.from(table).delete().eq("learner_id", id);
  }
  await admin.from("profiles").delete().eq("id", id);
  await admin.auth.admin.deleteUser(id);
}

const NOTES = `# Week 3 notes: Cash flow (ACCT 101, Dr. Okafor)

[p. 1]
The cash flow statement has three sections: operating (CFO), investing (CFI) and financing (CFF).
We use the indirect method: start from net income, add back non-cash charges such as depreciation,
then adjust for changes in working capital. An increase in accounts receivable is subtracted, because
the sale was booked as revenue but the cash has not arrived.

[p. 2]
Free cash flow (FCF) in this course is defined as CFO minus capital expenditure (capex).
Example from class: Lagos Bakery Ltd had net income of 120, depreciation of 30, an increase in
receivables of 25 and capex of 60. CFO = 120 + 30 - 25 = 125, so FCF = 125 - 60 = 65.

[p. 3]
Warning signs Dr. Okafor wants us to spot: net income rising while CFO falls for several years;
receivables growing much faster than revenue; FCF negative while dividends are still paid.`;

async function main() {
  if (args[0] === "--delete") {
    await cleanUp(args[1]);
    console.log("deleted", args[1]);
    return;
  }
  const outDir = args.find((a) => !a.startsWith("--")) ?? "research/runs/14-tailored";
  const keep = args.includes("--keep");
  mkdirSync(outDir, { recursive: true });

  const email = `e2e-tailored-${Date.now()}@wondersity.test`;
  const password = `E2e-${crypto.randomUUID()}`;
  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const id = created.user.id;
  const anon = createClient(url, publishable, { auth: { persistSession: false } });
  const signed = await anon.auth.signInWithPassword({ email, password });
  if (!signed.data.session) throw signed.error ?? new Error("no session");
  const cookies = sessionCookie(signed.data.session);
  const cookie = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const checks: { check: string; ok: boolean; detail?: unknown }[] = [];
  const check = (name: string, ok: boolean, detail?: unknown) => {
    checks.push({ check: name, ok, detail });
    console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail !== undefined ? ` — ${JSON.stringify(detail).slice(0, 200)}` : ""}`);
  };

  try {
    await admin.from("profiles").upsert({ id, display_name: "E2E Tailored", onboarded_at: new Date().toISOString(), age_confirmed_at: new Date().toISOString() });

    // 1. Upload
    const form = new FormData();
    form.append("file", new Blob([NOTES], { type: "text/markdown" }), "week3-cash-flow.md");
    const up = await fetch(`${BASE}/api/materials`, { method: "POST", headers: { cookie }, body: form });
    const upData = await up.json();
    check("upload returns the file's text", up.ok && upData.text?.includes("Lagos Bakery"), { status: up.status, chars: upData.chars });
    const pdfPath = args.find((a) => a.endsWith(".pdf"));
    if (pdfPath) {
      const pdfForm = new FormData();
      pdfForm.append("file", new Blob([readFileSync(pdfPath)], { type: "application/pdf" }), "slides.pdf");
      const pdf = await fetch(`${BASE}/api/materials`, { method: "POST", headers: { cookie }, body: pdfForm });
      const pdfData = await pdf.json();
      check("PDF upload is read with page markers", pdf.ok && /\[p\. 1\]/.test(pdfData.text ?? ""), { status: pdf.status, pages: pdfData.pages });
    }
    const bad = new FormData();
    bad.append("file", new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }), "x.png");
    const badRes = await fetch(`${BASE}/api/materials`, { method: "POST", headers: { cookie }, body: bad });
    check("an image is refused", badRes.status === 415);

    // 2. Start the tailored course
    const topic = `Cash flow statements ${Date.now() % 10000}`;
    const intake = {
      goal: "Read a small company's cash flow statement and decide whether it's in trouble before I lend it money",
      purpose: "work",
      context: "I'm a loan officer at a microfinance bank in Lagos",
      level: "basics",
      cover: ["free cash flow", "warning signs in the accounts"],
      length: "short",
      materials: [{ name: upData.name, text: upData.text }],
    };
    const started = Date.now();
    const learn = await fetch(`${BASE}/api/learn`, { method: "POST", headers: { cookie, "Content-Type": "application/json" }, body: JSON.stringify({ topic, intake }) });
    const learnData = await learn.json();
    check("learn accepts the brief", learn.status === 202 && !!learnData.job?.id, { status: learn.status });
    const jobRow = (await admin.from("jobs").select("intake").eq("id", learnData.job.id).single()).data;
    check("the job carries the brief", !!jobRow?.intake?.goal);

    let job: { status: string; result?: Record<string, unknown>; error?: string } | null = null;
    while (Date.now() - started < 330_000) {
      await new Promise((r) => setTimeout(r, 4000));
      job = (await (await fetch(`${BASE}/api/jobs/${learnData.job.id}`, { headers: { cookie } })).json()).job;
      if (job && job.status !== "running") break;
    }
    const seconds = Math.round((Date.now() - started) / 1000);
    check("the job finishes", job?.status === "done", { status: job?.status, error: job?.error, seconds });

    // 3. What was saved
    const course = (await admin.from("courses").select("id, title, description, intake, outcomes, modules, plan_key").eq("learner_id", id).single()).data;
    check("course keeps the brief, without the materials' text", course?.intake?.goal === intake.goal && !JSON.stringify(course?.intake).includes("Lagos Bakery"), course?.intake?.materials);
    check("course has 2-4 outcomes", Array.isArray(course?.outcomes) && course.outcomes.length >= 2 && course.outcomes.length <= 4, course?.outcomes);
    check("every level names its outcome", (course?.modules ?? []).every((m: { level?: { outcome?: string } }) => !!m.level?.outcome));
    const covered = new Set((course?.modules ?? []).flatMap((m: { covers?: string[] }) => m.covers ?? []));
    check("every 'must cover' item is covered", intake.cover.every((c) => covered.has(c)), [...covered]);
    check("title and description don't talk about the brief or materials", !/\b(materials?|notes|supplied|uploaded|brief)\b/i.test(`${course?.title} ${course?.description}`), course?.description);
    check("short course has 4-5 lessons", course?.modules?.length >= 4 && course?.modules?.length <= 5, course?.modules?.length);
    check("not shared (no plan key)", !course?.plan_key);
    const mats = (await admin.from("course_materials").select("source, embedding").eq("course_id", course?.id)).data ?? [];
    check("materials saved as passages with embeddings", mats.length > 0 && mats.every((m) => !!m.embedding), { passages: mats.length });
    const jobAfter = (await admin.from("jobs").select("intake").eq("id", learnData.job.id).single()).data;
    check("the job's copy of the brief is cleared", jobAfter?.intake === null);
    const run = (await admin.from("runs").select("trace, cost_usd, ms").eq("learner_id", id).eq("kind", "learn").order("created_at", { ascending: false }).limit(1).single()).data;
    const trace = (run?.trace ?? []) as { step: string; [k: string]: unknown }[];
    const step = (name: string) => trace.find((t) => t.step === name);
    check("materials were outlined for the planner", !!step("materials_digest")?.ok, step("materials_digest"));
    check("the lesson was written with excerpts", ((step("material_excerpts")?.count as number) ?? 0) > 0, step("material_excerpts"));
    const lesson = (await admin.from("lessons").select("id, score, lesson_data").eq("learner_id", id).single()).data;
    check("lesson 1 saved", !!lesson, { score: lesson?.score, title: lesson?.lesson_data?.title });
    const text = JSON.stringify(lesson?.lesson_data ?? {});
    check("lesson draws on the learner's context or materials", /loan|lend|microfinance|Lagos|Okafor|week3|CFO/i.test(text));

    writeFileSync(
      join(outDir, "result.json"),
      JSON.stringify({ topic, intake: { ...intake, materials: intake.materials.map((m) => ({ name: m.name, chars: m.text.length })) }, seconds, cost: run?.cost_usd, checks, course, lesson: lesson?.lesson_data, trace }, null, 2)
    );
    console.log(`\n${checks.filter((c) => c.ok).length}/${checks.length} passed · ${seconds}s · $${run?.cost_usd ?? "?"} · ${outDir}/result.json`);
    if (keep) {
      // The session goes outside the repo (pass --cookie-file=<path>), for a browser check.
      const file = args.find((a) => a.startsWith("--cookie-file="))?.slice(14);
      if (file) writeFileSync(file, JSON.stringify(cookies));
      console.log(`kept learner ${id} (course ${course?.id})${file ? `; session cookies in ${file}` : ""}`);
    }
  } finally {
    if (!keep) await cleanUp(id);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
