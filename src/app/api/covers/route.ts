import { NextResponse } from "next/server";
import { z } from "zod";
import { asLearner } from "@/lib/auth";
import { toCourseView } from "@/lib/courseView";
import { paintCourseWorld } from "@/lib/courseWorld";
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
  try {
    const course = await paintCourseWorld(learnerId, courseId);
    if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
    return NextResponse.json({ course: toCourseView(course) });
  } catch (error) {
    return serverError(error, "Couldn't make the course covers.");
  }
}
