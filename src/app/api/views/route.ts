import { NextResponse } from "next/server";
import { z } from "zod";
import { asLearner } from "@/lib/auth";
import { recordLessonView } from "@/lib/db";
import {
  clientIp,
  rateLimit,
  serverError,
  tooManyRequests,
} from "@/lib/requestGuards";

const LIMIT_PER_IP = 120;
const LIMIT_WINDOW_MS = 60 * 1000;

const Body = z
  .object({
    lessonId: z.number().int().positive(),
    step: z.number().int().min(0).max(200),
    stepCount: z.number().int().min(1).max(201),
  })
  .refine((b) => b.step < b.stepCount);

/** Records how far a learner got in a lesson, to see where people stop. */
export async function POST(request: Request) {
  const limit = rateLimit(`views:${clientIp(request)}`, LIMIT_PER_IP, LIMIT_WINDOW_MS);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid view" }, { status: 400 });
  }

  const { lessonId, step, stepCount } = parsed.data;
  return asLearner(async (learnerId) => {
    try {
      const found = await recordLessonView(learnerId, lessonId, step, stepCount);
      if (!found) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
      return NextResponse.json({ ok: true });
    } catch (error) {
      return serverError(error, "Couldn't record the view.");
    }
  });
}
