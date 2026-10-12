import { NextResponse } from "next/server";
import { asLearner } from "@/lib/auth";
import { activeLessonJobs } from "@/lib/jobs";
import { serverError } from "@/lib/requestGuards";

// The learner's lesson jobs still running, so a reloaded page can follow them.
export async function GET() {
  return asLearner(async (learnerId) => {
    try {
      return NextResponse.json({ jobs: await activeLessonJobs(learnerId) });
    } catch (error) {
      return serverError(error, "Couldn't check on your lessons.");
    }
  });
}
