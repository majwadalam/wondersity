import { NextResponse } from "next/server";
import { z } from "zod";
import { currentLearner } from "@/lib/auth";
import { refFromCookieHeader } from "@/lib/referrals";
import { serverError } from "@/lib/requestGuards";

// The learner's profile: name, why they're here, daily goal, voice, and
// whether they've finished onboarding.

const Patch = z.object({
  displayName: z.string().trim().max(60).optional(),
  reason: z.string().max(40).optional(),
  dailyGoalMinutes: z.number().int().min(5).max(60).optional(),
  voiceOn: z.boolean().optional(),
  onboarded: z.literal(true).optional(),
  ageConfirmed: z.literal(true).optional(),
});

export async function GET() {
  const session = await currentLearner();
  if (!session) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  try {
    const { data, error } = await session.db.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ profile: view(session.user, data) });
  } catch (error) {
    return serverError(error, "Couldn't load your profile.");
  }
}

export async function PATCH(request: Request) {
  const session = await currentLearner();
  if (!session) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const parsed = Patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid profile" }, { status: 400 });
  const p = parsed.data;
  try {
    const row = {
      id: session.user.id,
      updated_at: new Date().toISOString(),
      ...(p.displayName !== undefined ? { display_name: p.displayName || null } : {}),
      ...(p.reason !== undefined ? { reason: p.reason } : {}),
      ...(p.dailyGoalMinutes !== undefined ? { daily_goal_minutes: p.dailyGoalMinutes } : {}),
      ...(p.voiceOn !== undefined ? { voice_on: p.voiceOn } : {}),
      ...(p.onboarded ? { onboarded_at: new Date().toISOString() } : {}),
      ...(p.ageConfirmed ? { age_confirmed_at: new Date().toISOString() } : {}),
    };
    // Finishing onboarding records the creator who referred the learner, if any:
    // only a real, active partner, and never replacing an earlier referral.
    const ref = p.onboarded ? refFromCookieHeader(request.headers.get("cookie")) : null;
    if (ref) {
      const [{ data: current }, { data: partner }] = await Promise.all([
        session.db.from("profiles").select("referred_by").eq("id", session.user.id).maybeSingle(),
        session.db.from("partners").select("code").eq("code", ref).eq("active", true).maybeSingle(),
      ]);
      if (partner && !current?.referred_by) Object.assign(row, { referred_by: ref, referred_at: new Date().toISOString() });
    }
    const { data, error } = await session.db.from("profiles").upsert(row).select("*").single();
    if (error) throw error;
    return NextResponse.json({ profile: view(session.user, data) });
  } catch (error) {
    return serverError(error, "Couldn't save your profile.");
  }
}

type Row = { display_name: string | null; reason: string | null; daily_goal_minutes: number; voice_on: boolean; onboarded_at: string | null } | null;

function view(user: { email?: string; user_metadata?: Record<string, unknown> }, row: Row) {
  const metaName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null;
  return {
    email: user.email ?? null,
    displayName: row?.display_name ?? metaName ?? null,
    avatarUrl: typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null,
    reason: row?.reason ?? null,
    dailyGoalMinutes: row?.daily_goal_minutes ?? 10,
    voiceOn: row?.voice_on ?? true,
    onboarded: !!row?.onboarded_at,
  };
}
