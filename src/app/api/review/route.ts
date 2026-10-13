import { NextResponse } from "next/server";
import { z } from "zod";
import { asLearner } from "@/lib/auth";
import { addReviewClear, courseTitles, getLessonForLearner, lessonsWithMistakes, listReviewClears } from "@/lib/db";
import type { Lesson } from "@/lib/lessonBlocks";
import { clientIp, rateLimit, serverError, tooManyRequests } from "@/lib/requestGuards";
import { gradeRetry, reviewItems } from "@/lib/review";

// Review: the checks a learner got wrong the first time (GET), and trying one
// again (POST), graded here against the saved lesson. A right answer marks it
// cleared; the first, graded answer is never changed (lib/review.ts).

const Retry = z.object({
  lessonId: z.number().int().positive(),
  questionIndex: z.number().int().min(0).max(20),
  chosen: z.string().max(1000),
  reveal: z.boolean().optional(),
});

export async function GET() {
  return asLearner(async (learnerId) => {
    try {
      const [rows, titles, clears] = await Promise.all([lessonsWithMistakes(learnerId), courseTitles(learnerId), listReviewClears(learnerId)]);
      return NextResponse.json({ items: reviewItems(rows, titles, clears) });
    } catch (error) {
      return serverError(error, "Couldn't load your mistakes.");
    }
  });
}

export async function POST(request: Request) {
  const limit = rateLimit(`review:${clientIp(request)}`, 120, 10 * 60 * 1000);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);
  const parsed = Retry.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid answer" }, { status: 400 });
  const { lessonId, questionIndex, chosen, reveal } = parsed.data;
  return asLearner(async (learnerId) => {
    try {
      const row = await getLessonForLearner(lessonId, learnerId);
      const result = row ? gradeRetry(row.lesson_data as Lesson, questionIndex, chosen, reveal) : null;
      if (!result) return NextResponse.json({ error: "Question not found" }, { status: 404 });
      if (result.correct) await addReviewClear(learnerId, lessonId, questionIndex);
      return NextResponse.json(result);
    } catch (error) {
      return serverError(error, "Couldn't check your answer.");
    }
  });
}
