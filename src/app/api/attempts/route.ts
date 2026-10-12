import { NextResponse } from "next/server";
import { z } from "zod";
import { asLearner } from "@/lib/auth";
import { QuizError, recordQuiz } from "@/lib/progress";
import {
  clientIp,
  rateLimit,
  serverError,
  tooManyRequests,
} from "@/lib/requestGuards";

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
      return NextResponse.json(await recordQuiz(learnerId, lessonId, answers));
    } catch (error) {
      if (error instanceof QuizError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      return serverError(error, "Failed to save your quiz.");
    }
  });
}
