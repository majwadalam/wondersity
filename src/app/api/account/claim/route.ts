import { NextResponse } from "next/server";
import { z } from "zod";
import { currentLearner } from "@/lib/auth";
import { isValidLearnerId, serverError } from "@/lib/requestGuards";

// Progress made before accounts lives under an old learner id kept in that
// browser. GET lists what it holds, so the app can ask before moving it; POST
// moves it into the signed-in account (claim_browser_learner, migration 004),
// only after the learner says yes. See preview_browser_learner, migration 010.
const Body = z.object({ browserId: z.string().refine(isValidLearnerId) });

export async function GET(request: Request) {
  const session = await currentLearner();
  if (!session) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const browserId = new URL(request.url).searchParams.get("browserId") ?? "";
  if (!isValidLearnerId(browserId)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  try {
    const { data, error } = await session.db.rpc("preview_browser_learner", { old_id: browserId });
    if (error) throw error;
    return NextResponse.json({ courses: (data ?? []) as { topic: string; title: string }[] });
  } catch (error) {
    return serverError(error, "Couldn't check for earlier progress.");
  }
}

export async function POST(request: Request) {
  const session = await currentLearner();
  if (!session) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  try {
    const { data, error } = await session.db.rpc("claim_browser_learner", { old_id: parsed.data.browserId });
    if (error) throw error;
    return NextResponse.json({ courses: data ?? 0 });
  } catch (error) {
    return serverError(error, "Couldn't move your earlier progress.");
  }
}

/** Deletes everything the learner has saved (courses, lessons, answers, profile). */
export async function DELETE() {
  const session = await currentLearner();
  if (!session) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  try {
    const id = session.user.id;
    // Reports and step views go with their lessons (on delete cascade).
    for (const table of ["attempts", "progress", "runs", "lessons", "courses"] as const) {
      const { error } = await session.db.from(table).delete().eq("learner_id", id);
      if (error) throw error;
    }
    await session.db.from("profiles").delete().eq("id", id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Couldn't delete your data.");
  }
}
