import { NextResponse } from "next/server";
import { z } from "zod";
import { asLearner } from "@/lib/auth";
import { getLessonRating, rateLesson } from "@/lib/db";
import { clientIp, rateLimit, serverError, tooManyRequests } from "@/lib/requestGuards";

// How a learner rated a lesson they finished: thumbs up or down, and an
// optional word about what was off. The admin panel lists them (Problems).

const Body = z.object({
  lessonId: z.number().int().positive(),
  rating: z.union([z.literal(1), z.literal(-1)]),
  comment: z.string().trim().max(500).optional(),
});

export async function GET(request: Request) {
  const lessonId = Number(new URL(request.url).searchParams.get("lessonId"));
  if (!Number.isInteger(lessonId) || lessonId <= 0) return NextResponse.json({ error: "Invalid lesson" }, { status: 400 });
  return asLearner(async (learnerId) => {
    try {
      return NextResponse.json({ rating: await getLessonRating(learnerId, lessonId) });
    } catch (error) {
      return serverError(error, "Couldn't load your rating.");
    }
  });
}

export async function POST(request: Request) {
  const limit = rateLimit(`ratings:${clientIp(request)}`, 40, 10 * 60 * 1000);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid rating" }, { status: 400 });
  return asLearner(async (learnerId) => {
    try {
      if (!(await rateLesson(learnerId, parsed.data))) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
      return NextResponse.json({ ok: true });
    } catch (error) {
      return serverError(error, "Couldn't save your rating.");
    }
  });
}
