// Paddle billing (Paddle is the merchant of record: it charges the learner,
// handles sales tax and VAT, and pays out). Checkout runs in the browser with
// Paddle.js; Paddle then reports subscription changes to /api/billing/webhook,
// which mirrors them into the subscriptions table. Plans are checked from that
// table (lib/plans.ts), never from anything the browser says.
//
// Server environment:
//   PADDLE_API_KEY         server API key (customer portal links)
//   PADDLE_WEBHOOK_SECRET  the notification destination's secret key
//   SUPABASE_SECRET_KEY    lets the webhook write subscription rows
// Browser environment (safe to expose):
//   NEXT_PUBLIC_PADDLE_CLIENT_TOKEN, NEXT_PUBLIC_PADDLE_PRICE_MONTHLY,
//   NEXT_PUBLIC_PADDLE_PRICE_YEARLY, NEXT_PUBLIC_PADDLE_ENV ("sandbox" or "production")

import { createHmac, timingSafeEqual } from "node:crypto";
import { env, requireEnv } from "./env";
import type { SubscriptionRow } from "./db";
import { cleanRefCode } from "./referrals";

// Paddle's SDKs allow 5 seconds; a little more tolerates clock skew. Replaying
// a genuine event inside this window only re-applies the same state.
const SIGNATURE_TOLERANCE_SEC = 300;

/**
 * Checks a webhook's Paddle-Signature header ("ts=…;h1=…") against the raw
 * body: HMAC-SHA256 of `${ts}:${body}` with the endpoint's secret, in hex.
 */
export function verifyPaddleSignature(rawBody: string, header: string | null, secret: string, nowSec = Date.now() / 1000) {
  if (!header) return false;
  const parts = header.split(";").map((p) => p.split("="));
  const ts = parts.find(([k]) => k === "ts")?.[1];
  const signatures = parts.filter(([k]) => k === "h1").map(([, v]) => v);
  if (!ts || !signatures.length || !/^\d+$/.test(ts)) return false;
  if (Math.abs(nowSec - Number(ts)) > SIGNATURE_TOLERANCE_SEC) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`${ts}:${rawBody}`).digest("hex"));
  return signatures.some((sig) => {
    const given = Buffer.from(sig ?? "");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

type PaddleSubscription = {
  id: string;
  status: string;
  customer_id: string;
  custom_data?: { learnerId?: string; ref?: string } | null;
  items?: { price?: { id?: string; billing_cycle?: { interval?: string } } }[];
  current_billing_period?: { ends_at?: string } | null;
  scheduled_change?: { action?: string; effective_at?: string } | null;
  canceled_at?: string | null;
};

const STATUSES = new Set(["active", "trialing", "past_due", "paused", "canceled"]);

/**
 * The subscriptions row for a Paddle subscription event, or null when the
 * event isn't one we track or doesn't say which learner it belongs to.
 * The learner id travels in custom_data, set when checkout was opened.
 */
export function subscriptionFromEvent(event: { event_type?: string; data?: PaddleSubscription }): SubscriptionRow | null {
  if (!event.event_type?.startsWith("subscription.") || !event.data) return null;
  const sub = event.data;
  const learnerId = sub.custom_data?.learnerId;
  const price = sub.items?.[0]?.price;
  if (!learnerId || !price?.id || !STATUSES.has(sub.status)) return null;
  const scheduledCancel = sub.scheduled_change?.action === "cancel";
  return {
    learner_id: learnerId,
    paddle_customer_id: sub.customer_id,
    paddle_subscription_id: sub.id,
    status: sub.status as SubscriptionRow["status"],
    price_id: price.id,
    plan: price.billing_cycle?.interval === "year" ? "yearly" : "monthly",
    // A canceled plan runs to the end of what was paid for.
    current_period_end: sub.current_billing_period?.ends_at ?? (scheduledCancel ? sub.scheduled_change?.effective_at ?? null : null),
    canceled_at: sub.canceled_at ?? (scheduledCancel ? sub.scheduled_change?.effective_at ?? null : null),
    // The creator whose link the learner bought through; checked against partners before saving.
    ...(cleanRefCode(sub.custom_data?.ref) ? { referred_by: cleanRefCode(sub.custom_data?.ref) } : {}),
  };
}

const apiBase = () => (env("NEXT_PUBLIC_PADDLE_ENV") === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com");

/** A one-time link to Paddle's customer portal, where the learner manages or cancels their plan. */
export async function customerPortalUrl(customerId: string, subscriptionId: string) {
  const response = await fetch(`${apiBase()}/customers/${encodeURIComponent(customerId)}/portal-sessions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${requireEnv("PADDLE_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ subscription_ids: [subscriptionId] }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Paddle portal ${response.status}: ${await response.text()}`);
  const data = await response.json();
  const url: string | undefined = data?.data?.urls?.general?.overview;
  if (!url) throw new Error("Paddle returned no portal link");
  return url;
}
