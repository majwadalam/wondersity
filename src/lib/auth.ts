import { NextResponse } from "next/server";
import { withDb } from "./db";
import { serverSupabase } from "./supabase/server";

/** The signed-in learner, or null. Verified with Supabase, not just read from the cookie. */
export async function currentLearner() {
  const db = await serverSupabase();
  const { data } = await db.auth.getUser();
  return data.user ? { db, user: data.user } : null;
}

/**
 * Runs an API handler as the signed-in learner: their id is the learner id,
 * and every database call inside runs as them. Signed out: 401.
 */
export async function asLearner(fn: (learnerId: string) => Promise<Response>): Promise<Response> {
  const session = await currentLearner();
  if (!session) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  return withDb(session.db, () => fn(session.user.id));
}
