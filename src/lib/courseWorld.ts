// Paints a course's world: one wide landscape the journey is drawn across,
// stored as the course cover (about $0.035, made once). Called by POST
// /api/covers (the browser opening a course) and by lesson jobs on the server
// (lib/jobs.ts), so a new course gets its world even if the browser closes.

import { generateImage, worldPrompt } from "./coverArt";
import { groupLevels } from "./courseHierarchy";
import { cachePlanCover, cachePlanRoad, canWriteShared, getCourseById, recordRun, saveCovers, saveWorldRoad, uploadImage } from "./db";
import { traceRoad } from "./worldRoad";
import type { CourseRow } from "./db";

/** The world's regions, one per level, as the road tracer is told them. */
const regionsOf = (course: CourseRow) => groupLevels(course.modules).filter((g) => !g.legacy).map((g) => g.title);
import { emptyUsage, withUsage } from "./model";

/** Paints the course's world if it has none; returns the course, or null if it isn't the learner's. Throws on failure. */
export async function paintCourseWorld(learnerId: string, courseId: number) {
  const started = Date.now();
  const usage = emptyUsage();
  try {
    const course = await getCourseById(courseId, learnerId);
    if (!course) return null;
    if (!course.cover_url) {
      // What each level is about, without its title, which the image model would write into the picture.
      const regions = groupLevels(course.modules).map((g) => (g.legacy ? `the world of ${course.title}` : (g.description || g.objective || g.title).replace(/\.$/, "")));
      const img = await withUsage(() => generateImage(worldPrompt(course.topic, regions), "21:9"), usage).then((r) => r.result);
      const world = await uploadImage(`course-${course.id}/world-${Date.now()}`, img.bytes, 2000);
      await saveCovers(course.id, world, {});
      // The next learner given this course's shared plan gets this world too (no-op if it has one).
      if (course.plan_key && canWriteShared()) await cachePlanCover(course.plan_key, world).catch((e) => console.error("cachePlanCover:", e));
      await recordRun(learnerId, { kind: "cover", topic: course.topic, outcome: "painted", ok: true, ms: Date.now() - started, usage });
    }
    const painted = await getCourseById(courseId, learnerId);
    // Trace the world's road once, including worlds painted before roads were traced.
    if (painted?.cover_url && painted.world_road == null) await traceWorldRoad(learnerId, painted, painted.cover_url);
    return await getCourseById(courseId, learnerId);
  } catch (error) {
    await recordRun(learnerId, { kind: "cover", outcome: "failed", ok: false, error: String(error), ms: Date.now() - started, usage });
    throw error;
  }
}

/** Traces and saves the road in a course's world; a failed trace saves [] and the page uses its default curve. */
async function traceWorldRoad(learnerId: string, course: CourseRow, coverUrl: string) {
  const { id: courseId, plan_key: planKey = null, topic } = course;
  const started = Date.now();
  const usage = emptyUsage();
  let road: { x: number; y: number }[] = [];
  let error: string | undefined;
  try {
    road = (await withUsage(() => traceRoad(coverUrl, regionsOf(course), Date.now() + 120_000), usage).then((r) => r.result)) ?? [];
  } catch (e) {
    error = String(e);
  }
  await saveWorldRoad(courseId, road);
  if (road.length && planKey && canWriteShared()) await cachePlanRoad(planKey, coverUrl, road).catch((e) => console.error("cachePlanRoad:", e));
  await recordRun(learnerId, { kind: "cover", topic, outcome: road.length ? "road" : "road_failed", ok: road.length > 0, error, ms: Date.now() - started, usage });
}
