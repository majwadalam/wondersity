import { NextResponse } from "next/server";
import { asLearner } from "@/lib/auth";
import { startLessonJob } from "@/lib/jobs";
import {
  MAX_TOPIC_LENGTH,
  cleanTopic,
  clientIp,
  rateLimit,
  serverError,
  tooManyRequests,
} from "@/lib/requestGuards";

// The tutor runs as a background job after this responds (lib/jobs.ts), within
// the route's 5 minutes, so the lesson is finished even if the browser closes.
export const maxDuration = 300;

// Each new module costs several model calls, so keep this tight (resuming an
// unfinished module is free but goes through the same route).
const LIMIT_PER_IP = 12;
const LIMIT_WINDOW_MS = 10 * 60 * 1000;

export async function POST(request: Request) {
  const limit = rateLimit(`learn:${clientIp(request)}`, LIMIT_PER_IP, LIMIT_WINDOW_MS);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
  }
  const { topic: rawTopic, ahead } = (body ?? {}) as Record<string, unknown>;

  const topic = cleanTopic(rawTopic);
  if (!topic) {
    return NextResponse.json(
      { error: `Topic is required (max ${MAX_TOPIC_LENGTH} characters)` },
      { status: 400 }
    );
  }

  return asLearner(async (learnerId) => {
    try {
      // ahead: write the lesson after the one the learner is taking, so it's ready when they finish.
      const job = await startLessonJob(learnerId, topic, ahead === true ? "ahead" : "learn");
      return NextResponse.json({ job }, { status: 202 });
    } catch (error) {
      return serverError(error, "Failed to start your lesson. Please try again.");
    }
  });
}
