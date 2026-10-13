import { NextResponse } from "next/server";
import { z } from "zod";
import { asLearner } from "@/lib/auth";
import { getLessonForLearner } from "@/lib/db";
import { lessonBlocks } from "@/lib/lessonBlocks";
import { MAX_ANSWER, gradeReflection } from "@/lib/reflectGrade";
import { clientIp, rateLimit, serverError, tooManyRequests } from "@/lib/requestGuards";

// Grades a written reflection against the lesson's model answer (lib/reflectGrade.ts).
// The question and model answer come from the saved lesson, never the request.

const LIMIT_PER_IP = 30;
const LIMIT_WINDOW_MS = 10 * 60 * 1000;

const Body = z.object({
  lessonId: z.number().int().positive(),
  block: z.number().int().min(0).max(200),
  answer: z.string().trim().min(20).max(MAX_ANSWER),
});

export async function POST(request: Request) {
  const limit = rateLimit(`reflect:${clientIp(request)}`, LIMIT_PER_IP, LIMIT_WINDOW_MS);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid answer" }, { status: 400 });
  const { lessonId, block, answer } = parsed.data;

  return asLearner(async (learnerId) => {
    try {
      const row = await getLessonForLearner(lessonId, learnerId);
      const b = row ? lessonBlocks(row.lesson_data)[block] : undefined;
      if (!row || b?.kind !== "reflect") return NextResponse.json({ error: "Not found" }, { status: 404 });
      const grade = await gradeReflection({ topic: row.topic, question: b.prompt, model: b.model, answer }, Date.now() + 40_000);
      return NextResponse.json({ grade });
    } catch (error) {
      return serverError(error, "Couldn't check your answer.");
    }
  });
}
