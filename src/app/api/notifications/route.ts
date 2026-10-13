import { NextResponse } from "next/server";
import { z } from "zod";
import { asLearner } from "@/lib/auth";
import { listNotifications, markNotificationsRead } from "@/lib/db";
import { serverError } from "@/lib/requestGuards";

// The bell: the learner's recent notifications, and marking them read.

export async function GET() {
  return asLearner(async (learnerId) => {
    try {
      const notifications = await listNotifications(learnerId);
      return NextResponse.json({ notifications, unread: notifications.filter((n) => !n.read_at).length });
    } catch (error) {
      return serverError(error, "Couldn't load your notifications.");
    }
  });
}

const Body = z.object({ ids: z.array(z.number().int().positive()).max(100).optional() });

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  return asLearner(async (learnerId) => {
    try {
      await markNotificationsRead(learnerId, parsed.data.ids);
      return NextResponse.json({ ok: true });
    } catch (error) {
      return serverError(error, "Couldn't update your notifications.");
    }
  });
}
