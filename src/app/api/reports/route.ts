import { NextResponse } from "next/server";
import { z } from "zod";
import { asLearner } from "@/lib/auth";
import { insertLessonReport } from "@/lib/db";
import { clientIp, rateLimit, serverError, tooManyRequests } from "@/lib/requestGuards";

// A learner reports a mistake in one of their lessons. Reports are read with
// supabase/queries/metrics.sql and drive fixes to the writer and its checks.

const Body = z.object({
  lessonId: z.number().int().positive(),
  step: z.number().int().min(0).max(100),
  kind: z.enum(["wrong_fact", "confusing", "broken", "other"]),
  message: z.string().trim().max(1000),
});

export async function POST(request: Request) {
  const limit = rateLimit(`reports:${clientIp(request)}`, 20, 10 * 60 * 1000);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid report" }, { status: 400 });
  return asLearner(async (learnerId) => {
    try {
      const saved = await insertLessonReport(learnerId, parsed.data);
      if (!saved) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
      return NextResponse.json({ ok: true });
    } catch (error) {
      return serverError(error, "Couldn't send your report.");
    }
  });
}
