import { NextResponse } from "next/server";
import { asLearner } from "@/lib/auth";
import { getLessonJob } from "@/lib/jobs";
import { serverError } from "@/lib/requestGuards";

// One lesson job, as the browser watches it: running, done (with the
// tutor's result) or failed (with a plain message and a reference).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return asLearner(async (learnerId) => {
    try {
      const job = await getLessonJob(learnerId, id);
      return job ? NextResponse.json({ job }) : NextResponse.json({ error: "Not found" }, { status: 404 });
    } catch (error) {
      return serverError(error, "Couldn't check on your lesson.");
    }
  });
}
