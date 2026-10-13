import { NextResponse } from "next/server";
import { currentLearner } from "@/lib/auth";
import { serverError } from "@/lib/requestGuards";

// "Download my data" (Settings): everything Wondersity keeps about the
// learner, as one JSON file. Read as the learner, so the row rules return only
// their own rows. Embeddings and run traces are left out: they're internal
// working data, not something a person can read.

export const maxDuration = 60;

const TABLES: [table: string, columns: string, key?: string][] = [
  ["courses", "id, topic, title, description, modules, current_module, status, intake, outcomes, voices, archived_at, created_at, updated_at"],
  ["lessons", "id, course_id, module_index, topic, score, created_at, completed_at, lesson_data"],
  ["attempts", "lesson_id, question_index, chosen, correct, created_at"],
  ["progress", "topic, status, updated_at"],
  ["lesson_views", "lesson_id, step, step_count, created_at"],
  ["lesson_reports", "lesson_id, step, kind, message, created_at"],
  ["lesson_ratings", "lesson_id, rating, comment, created_at, updated_at"],
  ["review_clears", "lesson_id, question_index, cleared_at"],
  ["bookmarks", "topic, created_at"],
  ["certificates", "id, course_id, learner_name, course_title, topic, lessons, minutes, accuracy, completed_at"],
  ["notifications", "kind, title, body, href, read_at, created_at"],
  ["course_materials", "course_id, source, chunk_index, content, created_at"],
  ["support_messages", "kind, message, page, created_at, resolved_at"],
  ["runs", "kind, topic, lesson_id, outcome, ok, ms, cost_usd, created_at"],
  ["subscriptions", "status, plan, current_period_end, canceled_at, started_at, updated_at"],
];

export async function GET() {
  const session = await currentLearner();
  if (!session) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  try {
    const id = session.user.id;
    const out: Record<string, unknown> = {
      exported_at: new Date().toISOString(),
      account: { id, email: session.user.email ?? null, created_at: session.user.created_at },
    };
    const { data: profile } = await session.db.from("profiles").select("*").eq("id", id).maybeSingle();
    out.profile = profile ?? null;
    for (const [table, columns] of TABLES) {
      const { data, error } = await session.db.from(table).select(columns).eq("learner_id", id);
      // A table this account can't read (or a column that moved) is noted, not fatal.
      out[table] = error ? { unavailable: true } : (data ?? []);
    }
    const day = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(out, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="wondersity-data-${day}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return serverError(error, "Couldn't prepare your data.");
  }
}
