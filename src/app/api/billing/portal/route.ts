import { NextResponse } from "next/server";
import { asLearner } from "@/lib/auth";
import { customerPortalUrl } from "@/lib/billing";
import { getSubscription } from "@/lib/db";
import { serverError } from "@/lib/requestGuards";

// A link to Paddle's customer portal: change plan, update the card, see
// invoices, cancel.

export async function POST() {
  return asLearner(async (learnerId) => {
    try {
      const sub = await getSubscription(learnerId);
      if (!sub) return NextResponse.json({ error: "You don't have a plan to manage." }, { status: 404 });
      return NextResponse.json({ url: await customerPortalUrl(sub.paddle_customer_id, sub.paddle_subscription_id) });
    } catch (error) {
      return serverError(error, "Couldn't open billing. Please try again.");
    }
  });
}
