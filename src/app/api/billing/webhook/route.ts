import { NextResponse } from "next/server";
import { subscriptionFromEvent, verifyPaddleSignature } from "@/lib/billing";
import { getPartner, upsertSubscription } from "@/lib/db";
import { env } from "@/lib/env";

// Paddle reports subscription changes here. The body is checked against the
// Paddle-Signature header before anything is read from it; an unsigned or
// tampered request changes nothing.

export async function POST(request: Request) {
  const secret = env("PADDLE_WEBHOOK_SECRET");
  if (!secret) return NextResponse.json({ error: "Billing isn't set up." }, { status: 503 });

  const raw = await request.text();
  if (!verifyPaddleSignature(raw, request.headers.get("paddle-signature"), secret)) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  let event: Parameters<typeof subscriptionFromEvent>[0];
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const row = subscriptionFromEvent(event);
  // Events we don't track are acknowledged, so Paddle doesn't retry them.
  if (!row) return NextResponse.json({ ok: true, ignored: event.event_type ?? "unknown" });
  try {
    // A code that isn't an active partner is dropped rather than failing the event.
    if (row.referred_by && !(await getPartner(row.referred_by))) delete row.referred_by;
    await upsertSubscription(row);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Paddle webhook failed", error);
    // A 5xx makes Paddle retry later.
    return NextResponse.json({ error: "Couldn't save the subscription" }, { status: 500 });
  }
}
