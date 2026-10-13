// Stages a saved lesson as scenes with a guide (see lib/staging.ts): one
// model call for the script, then the scenes and the guide's portrait are
// painted in parallel and stored. A guide already painted for this course is
// reused, portrait and all. Alongside, the lesson's "Go deeper" resources are
// gathered (lib/enrichment.ts). Done once per lesson; the result is saved
// into the lesson, so reopening it costs nothing. Called by POST /api/stage
// (the browser opening a lesson) and by lesson jobs on the server (lib/jobs.ts).

import { generateImage, scenePrompt } from "./coverArt";
import {
  addSharedLessonStaging,
  canWriteShared,
  getCourseGuides,
  getLessonForLearner,
  getSubscription,
  getUsageSince,
  recordRun,
  updateLessonData,
  uploadImage,
} from "./db";
import { enrichLesson, type Resources } from "./enrichment";
import { env } from "./env";
import { lessonBlocks, type Lesson } from "./lessonBlocks";
import { callStructured, emptyUsage, withUsage } from "./model";
import { billingEnabled, canPaint, planFrom, windowStart } from "./plans";
import { STAGING_SCHEMA, STAGING_SYSTEM, normalizeStaging, stagingInput, type Staging } from "./staging";

// Staging writes a short script (a guide, a setting and a line per step), not
// a lesson; a small model does it for a fraction of the writer's cost (see
// ECONOMICS.md). STAGING_MODEL overrides it.
const stagingModel = () => env("STAGING_MODEL") ?? "openai/gpt-6-luna";

const portraitPrompt = (p: string) =>
  `${p}. Soft 3D matte clay sculpture, stylised and friendly, shoulders up, three-quarter view, centred. Soft studio light from the upper left. Seamless solid background #EEF0FF. Never a photoreal face. No text, letters or border.`;

export type StageResult =
  | { ok: true; staging: Staging; resources: Resources | null }
  /** error is shown to the learner; detail (the real reason) is only recorded with the run. */
  | { ok: false; status: number; error: string; detail?: string };

/**
 * Stages a lesson and records what it cost as a run. Throws on infrastructure
 * or provider failures; the caller decides how to report them.
 */
export async function stageLesson(learnerId: string, lessonId: number, topic: string): Promise<StageResult> {
  const started = Date.now();
  const usage = emptyUsage();
  try {
    const { result } = await withUsage(() => stageSavedLesson(learnerId, lessonId, topic), usage);
    if (usage.calls > 0) {
      await recordRun(learnerId, { kind: "stage", topic, lessonId, outcome: result.ok ? "staged" : `http ${result.status}`, ok: result.ok, error: result.ok ? undefined : (result.detail ?? result.error), ms: Date.now() - started, usage });
    }
    return result;
  } catch (error) {
    await recordRun(learnerId, { kind: "stage", topic, lessonId, outcome: "failed", ok: false, error: String(error), ms: Date.now() - started, usage });
    throw error;
  }
}

/** Stages a saved lesson (no cost recording; see stageLesson). */
export async function stageSavedLesson(learnerId: string, lessonId: number, topic: string): Promise<StageResult> {
  const row = await getLessonForLearner(lessonId, learnerId);
  if (!row) return { ok: false, status: 404, error: "Lesson not found" };
  const lesson = row.lesson_data as Lesson;
  const existing = lesson.staging;
  const complete = (st: Staging) => !!st.guide.portrait && st.images.every((i) => i.url);
  if (existing && complete(existing) && lesson.resources) return { ok: true, staging: existing, resources: lesson.resources };

  const deadline = Date.now() + 240_000;
  // Started first so it runs alongside the script and the paintings; it never fails the staging.
  const resources: Promise<Resources | null> = lesson.resources
    ? Promise.resolve(lesson.resources)
    : // A failure is saved as "nothing found", so it isn't retried (and paid for) on every visit.
      enrichLesson(topic, lesson, deadline).catch((e) => {
        console.error("enrichment failed:", e);
        return { videos: [], articles: [], books: [], images: [], at: new Date().toISOString() };
      });
  const blockCount = lessonBlocks(lesson).length;
  // A lesson already staged but missing a painting only gets the missing ones repainted.
  let staging: Staging | null = existing ?? null;
  let rejected = "";
  // The guide earlier lessons of this course used: kept if it still fits, and its portrait reused.
  const earlier = row.course_id ? (await getCourseGuides(row.course_id, learnerId)).find((g) => g.portrait) : undefined;
  // One retry: a malformed script is common enough to be worth it.
  for (let attempt = 0; attempt < 2 && !staging; attempt++) {
    const raw = await callStructured(STAGING_SYSTEM, stagingInput(lesson, topic, earlier), STAGING_SCHEMA, deadline, { timeoutMs: 90_000, model: stagingModel(), maxTokens: 10_000 });
    const result = normalizeStaging(raw, blockCount);
    if (result.ok) staging = result.staging;
    else {
      rejected = result.error;
      console.error("staging rejected:", result.error);
    }
  }
  if (!staging) {
    const found = await resources;
    if (found) await updateLessonData(lessonId, { ...lesson, resources: found });
    return { ok: false, status: 502, error: "Couldn't stage this lesson.", detail: `The guide's script was rejected twice. Last reason: ${rejected || "unknown"}` };
  }
  if (!staging.guide.portrait && earlier?.portrait && earlier.name === staging.guide.name) staging.guide.portrait = earlier.portrait;

  // Past the plan's painting allowance, the lesson keeps its guide and lines
  // but gets no new scenes; it's painted on a later visit once allowed again.
  const paint = !billingEnabled() || canPaint(planFrom(await getSubscription(learnerId)), await getUsageSince(learnerId, windowStart()));

  // Paint every missing scene and the portrait at once; a failed image just stays unset.
  const folder = `lesson-${lessonId}`;
  const stamp = Date.now();
  const s = staging;
  const results = await Promise.allSettled([
    ...s.images.map(async (img, i) => {
      if (img.url || !paint) return;
      const out = await generateImage(scenePrompt(img.setting ? `${img.setting}. ${img.prompt}` : img.prompt, topic), "16:9");
      img.url = await uploadImage(`${folder}/scene-${i + 1}-${stamp}`, out.bytes, 1600);
    }),
    (async () => {
      if (s.guide.portrait) return;
      const out = await generateImage(portraitPrompt(s.guide.portraitPrompt), "4:3");
      s.guide.portrait = await uploadImage(`${folder}/guide-${stamp}`, out.bytes, 256);
    })(),
  ]);
  for (const r of results) if (r.status === "rejected") console.error("stage image failed:", r.reason);

  const found = await resources;
  await updateLessonData(lessonId, { ...lesson, staging: s, ...(found ? { resources: found } : {}) });
  // A shared plan's lesson: once fully painted, its scenes and "Go deeper"
  // go into the shared copy, so the next learners don't pay to paint them.
  if (lesson.sharedFrom && complete(s) && canWriteShared()) {
    await addSharedLessonStaging(lesson.sharedFrom, { staging: s, ...(found ? { resources: found } : {}) }).catch((e) =>
      console.error("addSharedLessonStaging:", e)
    );
  }
  return { ok: true, staging: s, resources: found };
}
