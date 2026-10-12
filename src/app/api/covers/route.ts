import { NextResponse } from "next/server";
import { z } from "zod";
import { asLearner } from "@/lib/auth";
import { generateImage, worldPrompt } from "@/lib/coverArt";
import { groupLevels } from "@/lib/courseHierarchy";
import { toCourseView } from "@/lib/courseView";
import { cachePlanCover, canWriteShared, getCourseById, recordRun, saveCovers, uploadImage } from "@/lib/db";
import { emptyUsage, withUsage } from "@/lib/model";
import { clientIp, rateLimit, serverError, tooManyRequests } from "@/lib/requestGuards";

// Paints a course's world: one wide landscape the journey is drawn across,
// stored as the course cover (about $0.035, made once). Lessons get no
// separate cover: a lesson shows its first scene once staged, and the world
// until then. A failure is not retried; the page falls back to built-in art.

export const maxDuration = 300;

const LIMIT_PER_IP = 6;
const LIMIT_WINDOW_MS = 10 * 60 * 1000;

const Body = z.object({
  courseId: z.number().int().positive(),
});

export async function POST(request: Request) {
  const limit = rateLimit(`covers:${clientIp(request)}`, LIMIT_PER_IP, LIMIT_WINDOW_MS);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { courseId } = parsed.data;

  return asLearner((learnerId) => paint(learnerId, courseId));
}

async function paint(learnerId: string, courseId: number) {
  const started = Date.now();
  const usage = emptyUsage();
  try {
    const course = await getCourseById(courseId, learnerId);
    if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

    if (!course.cover_url) {
      const regions = groupLevels(course.modules).map((g) => (g.legacy ? course.title : `${g.title}: ${g.description || g.objective}`));
      const img = await withUsage(() => generateImage(worldPrompt(course.topic, regions), "21:9"), usage).then((r) => r.result);
      const world = await uploadImage(`course-${course.id}/world-${Date.now()}`, img.bytes, 2000);
      await saveCovers(course.id, world, {});
      // The next learner given this course's shared plan gets this world too (no-op if it has one).
      if (course.plan_key && canWriteShared()) await cachePlanCover(course.plan_key, world).catch((e) => console.error("cachePlanCover:", e));
      await recordRun(learnerId, { kind: "cover", topic: course.topic, outcome: "painted", ok: true, ms: Date.now() - started, usage });
    }
    const fresh = await getCourseById(courseId, learnerId);
    return NextResponse.json({ course: fresh ? toCourseView(fresh) : null });
  } catch (error) {
    await recordRun(learnerId, { kind: "cover", outcome: "failed", ok: false, error: String(error), ms: Date.now() - started, usage });
    return serverError(error, "Couldn't make the course covers.");
  }
}
