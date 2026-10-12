// Paints a course's world: one wide landscape the journey is drawn across,
// stored as the course cover (about $0.035, made once). Called by POST
// /api/covers (the browser opening a course) and by lesson jobs on the server
// (lib/jobs.ts), so a new course gets its world even if the browser closes.

import { generateImage, worldPrompt } from "./coverArt";
import { groupLevels } from "./courseHierarchy";
import { cachePlanCover, canWriteShared, getCourseById, recordRun, saveCovers, uploadImage } from "./db";
import { emptyUsage, withUsage } from "./model";

/** Paints the course's world if it has none; returns the course, or null if it isn't the learner's. Throws on failure. */
export async function paintCourseWorld(learnerId: string, courseId: number) {
  const started = Date.now();
  const usage = emptyUsage();
  try {
    const course = await getCourseById(courseId, learnerId);
    if (!course) return null;
    if (!course.cover_url) {
      const regions = groupLevels(course.modules).map((g) => (g.legacy ? course.title : `${g.title}: ${g.description || g.objective}`));
      const img = await withUsage(() => generateImage(worldPrompt(course.topic, regions), "21:9"), usage).then((r) => r.result);
      const world = await uploadImage(`course-${course.id}/world-${Date.now()}`, img.bytes, 2000);
      await saveCovers(course.id, world, {});
      // The next learner given this course's shared plan gets this world too (no-op if it has one).
      if (course.plan_key && canWriteShared()) await cachePlanCover(course.plan_key, world).catch((e) => console.error("cachePlanCover:", e));
      await recordRun(learnerId, { kind: "cover", topic: course.topic, outcome: "painted", ok: true, ms: Date.now() - started, usage });
    }
    return await getCourseById(courseId, learnerId);
  } catch (error) {
    await recordRun(learnerId, { kind: "cover", outcome: "failed", ok: false, error: String(error), ms: Date.now() - started, usage });
    throw error;
  }
}
