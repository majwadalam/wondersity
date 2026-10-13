import { NextResponse } from "next/server";
import { z } from "zod";
import { asLearner } from "@/lib/auth";
import { deletePushSubscription, savePushSubscription } from "@/lib/db";
import { serverError } from "@/lib/requestGuards";

// Saves (or removes) this browser's Web Push subscription (lib/push.ts).

const Subscription = z.object({
  endpoint: z.string().url().startsWith("https://").max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
});

export async function POST(request: Request) {
  const parsed = Subscription.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  const { endpoint, keys } = parsed.data;
  return asLearner(async (learnerId) => {
    try {
      await savePushSubscription({ endpoint, learner_id: learnerId, p256dh: keys.p256dh, auth: keys.auth });
      return NextResponse.json({ ok: true });
    } catch (error) {
      return serverError(error, "Couldn't turn on notifications.");
    }
  });
}

export async function DELETE(request: Request) {
  const parsed = z.object({ endpoint: z.string().url().max(1000) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  return asLearner(async () => {
    try {
      await deletePushSubscription(parsed.data.endpoint);
      return NextResponse.json({ ok: true });
    } catch (error) {
      return serverError(error, "Couldn't turn off notifications.");
    }
  });
}
