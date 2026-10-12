import { NextResponse } from "next/server";
import { z } from "zod";
import { asLearner } from "@/lib/auth";
import { stageLesson } from "@/lib/lessonStaging";
import { clientIp, rateLimit, serverError, tooManyRequests } from "@/lib/requestGuards";

// Stages a saved lesson (scenes, guide, lines, "Go deeper"; see
// lib/lessonStaging.ts). Lesson jobs stage new lessons on the server; this
// route covers lessons opened before they were staged, or with a painting missing.

export const maxDuration = 300;

const LIMIT_PER_IP = 12;
const LIMIT_WINDOW_MS = 10 * 60 * 1000;

const Body = z.object({
  lessonId: z.number().int().positive(),
  topic: z.string().min(1).max(120),
});

export async function POST(request: Request) {
  const limit = rateLimit(`stage:${clientIp(request)}`, LIMIT_PER_IP, LIMIT_WINDOW_MS);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { lessonId, topic } = parsed.data;

  return asLearner(async (learnerId) => {
    try {
      const result = await stageLesson(learnerId, lessonId, topic);
      return result.ok
        ? NextResponse.json({ staging: result.staging, resources: result.resources })
        : NextResponse.json({ error: result.error }, { status: result.status });
    } catch (error) {
      return serverError(error, "Couldn't set the scene for this lesson.");
    }
  });
}
