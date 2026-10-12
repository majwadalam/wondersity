import { NextResponse } from "next/server";
import { asLearner } from "@/lib/auth";
import { getLearnerLessons } from "@/lib/db";
import {
  clientIp,
  rateLimit,
  serverError,
  tooManyRequests,
} from "@/lib/requestGuards";

const LIMIT_PER_IP = 60;
const LIMIT_WINDOW_MS = 60 * 1000;

export async function GET(request: Request) {
  const limit = rateLimit(`lessons:${clientIp(request)}`, LIMIT_PER_IP, LIMIT_WINDOW_MS);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

  return asLearner(async (learnerId) => {
    try {
      const lessons = await getLearnerLessons(learnerId);
      return NextResponse.json({ lessons });
    } catch (error) {
      return serverError(error, "Failed to load lessons.");
    }
  });
}
