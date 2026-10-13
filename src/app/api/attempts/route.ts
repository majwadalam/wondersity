import { NextResponse } from "next/server";
import { rewardsAfterQuiz } from "@/lib/milestones";
import { z } from "zod";
import { asLearner } from "@/lib/auth";
import { startLessonJob } from "@/lib/jobs";
import { QuizError, recordQuiz } from "@/lib/progress";
import {
  clientIp,
  rateLimit,
  serverError,
  tooManyRequests,
} from "@/lib/requestGuards";

// Finishing a quiz can start the next lesson's job, which runs after the response.
export const maxDuration = 300;

const LIMIT_PER_IP = 60;
const LIMIT_WINDOW_MS = 60 * 1000;

const Body = z.object({
  lessonId: z.number().int().positive(),
  answers: z
    .array(z.object({ questionIndex: z.number().int().min(0), chosen: z.string().max(500) }))
    .min(1)
    .max(10),
});

/** Records a completed quiz: graded on the server, advances the course. */
export async function POST(request: Request) {
  const limit = rateLimit(`attempts:${clientIp(request)}`, LIMIT_PER_IP, LIMIT_WINDOW_MS);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid quiz submission" }, { status: 400 });
  }

  const { lessonId, answers } = parsed.data;
  return asLearner(async (learnerId) => {
    try {
      const result = await recordQuiz(learnerId, lessonId, answers);
      // The streak and, when this finished the course, the certificate (lib/milestones.ts).
      const rewards = result.firstCompletion
        ? await rewardsAfterQuiz(learnerId, result.course).catch((e) => {
            console.error("rewards after quiz:", e);
            return null;
          })
        : null;
      // If this quiz unlocked a lesson that isn't written yet, write it now on
      // the server (it sees these answers), whether or not the browser stays open.
      const course = result.course;
      const next = course?.status === "active" ? course.modules[course.currentModule] : null;
      if (course && next && !next.lesson) {
        await startLessonJob(learnerId, course.topic, "learn").catch((e) => console.error("couldn't start the next lesson", e));
      }
      return NextResponse.json({ ...result, rewards });
    } catch (error) {
      if (error instanceof QuizError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      return serverError(error, "Failed to save your quiz.");
    }
  });
}
