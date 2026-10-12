import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import { subscriptionFromEvent, verifyPaddleSignature } from "./billing";

const secret = "pdl_ntfset_test_secret";
const body = JSON.stringify({ event_type: "subscription.created", data: { id: "sub_1" } });
const sign = (ts: number, payload = body, key = secret) => `ts=${ts};h1=${createHmac("sha256", key).update(`${ts}:${payload}`).digest("hex")}`;
const now = 1_760_000_000;

describe("verifyPaddleSignature", () => {
  it("accepts a correctly signed body", () => {
    assert.equal(verifyPaddleSignature(body, sign(now), secret, now), true);
  });

  it("rejects a tampered body, the wrong secret, a missing header and an old timestamp", () => {
    assert.equal(verifyPaddleSignature(body.replace("sub_1", "sub_2"), sign(now), secret, now), false);
    assert.equal(verifyPaddleSignature(body, sign(now, body, "other"), secret, now), false);
    assert.equal(verifyPaddleSignature(body, null, secret, now), false);
    assert.equal(verifyPaddleSignature(body, sign(now - 3600), secret, now), false);
    assert.equal(verifyPaddleSignature(body, "ts=abc;h1=00", secret, now), false);
  });

  it("accepts any of several signatures (during secret rotation)", () => {
    const header = `ts=${now};h1=${"0".repeat(64)};${sign(now).split(";")[1]}`;
    assert.equal(verifyPaddleSignature(body, header, secret, now), true);
  });
});

describe("subscriptionFromEvent", () => {
  const data = {
    id: "sub_1",
    status: "active",
    customer_id: "ctm_1",
    custom_data: { learnerId: "user-uuid" },
    items: [{ price: { id: "pri_year", billing_cycle: { interval: "year" } } }],
    current_billing_period: { ends_at: "2027-10-12T00:00:00Z" },
    scheduled_change: null,
    canceled_at: null,
  };

  it("maps a subscription event to the learner's row", () => {
    assert.deepEqual(subscriptionFromEvent({ event_type: "subscription.created", data }), {
      learner_id: "user-uuid",
      paddle_customer_id: "ctm_1",
      paddle_subscription_id: "sub_1",
      status: "active",
      price_id: "pri_year",
      plan: "yearly",
      current_period_end: "2027-10-12T00:00:00Z",
      canceled_at: null,
    });
  });

  it("records a scheduled cancellation", () => {
    const row = subscriptionFromEvent({
      event_type: "subscription.updated",
      data: { ...data, scheduled_change: { action: "cancel", effective_at: "2027-10-12T00:00:00Z" } },
    });
    assert.equal(row?.canceled_at, "2027-10-12T00:00:00Z");
  });

  it("credits the creator whose code came through checkout, ignoring malformed codes", () => {
    const withRef = subscriptionFromEvent({ event_type: "subscription.created", data: { ...data, custom_data: { learnerId: "user-uuid", ref: "HistoryHub" } } });
    assert.equal(withRef?.referred_by, "historyhub");
    const bad = subscriptionFromEvent({ event_type: "subscription.created", data: { ...data, custom_data: { learnerId: "user-uuid", ref: "no spaces allowed" } } });
    assert.equal(bad && "referred_by" in bad, false);
  });

  it("ignores other events and subscriptions with no learner", () => {
    assert.equal(subscriptionFromEvent({ event_type: "transaction.completed", data }), null);
    assert.equal(subscriptionFromEvent({ event_type: "subscription.created", data: { ...data, custom_data: null } }), null);
  });
});
