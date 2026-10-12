import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cleanRefCode, refFromCookieHeader } from "./referrals";

describe("cleanRefCode", () => {
  it("accepts short lowercase codes and normalizes case and spaces", () => {
    assert.equal(cleanRefCode(" HistoryHub "), "historyhub");
    assert.equal(cleanRefCode("the-stoic-pod"), "the-stoic-pod");
  });

  it("rejects anything that can't be a code", () => {
    for (const bad of [null, undefined, "", "a", "-lead", "has space", "x".repeat(40), "a;b=c", "<script>"]) assert.equal(cleanRefCode(bad), null);
  });
});

describe("refFromCookieHeader", () => {
  it("finds the referral cookie among others", () => {
    assert.equal(refFromCookieHeader("sb-access=abc; agora_ref=historyhub; theme=light"), "historyhub");
    assert.equal(refFromCookieHeader("theme=light"), null);
    assert.equal(refFromCookieHeader(null), null);
    assert.equal(refFromCookieHeader("agora_ref=bad%20code"), null);
  });
});
