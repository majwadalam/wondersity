import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConfigError } from "./env";
import { ModelHttpError } from "./model";
import { FAILURE_COPY, failureKind, serverError } from "./requestGuards";

// What OpenRouter actually sent when the key's spending limit was reached.
const keyLimit = new ModelHttpError(
  403,
  '{"error":{"message":"Key limit exceeded (total limit). Manage it using https://openrouter.ai/workspaces/default/keys/0059 $10.08 of $10.00 used","code":403}}'
);

describe("serverError", () => {
  it("never sends the error, provider response, URLs or limits to the browser", async () => {
    const original = console.error;
    console.error = () => {};
    try {
      const res = serverError(keyLimit, "Failed to generate lesson.");
      const text = await res.text();
      for (const leak of ["openrouter", "Key limit", "$10", "workspaces", "403", "OPENROUTER", "hint", "details"]) {
        assert.ok(!text.includes(leak), `leaked: ${leak}`);
      }
      const body = JSON.parse(text);
      assert.equal(body.error, FAILURE_COPY.unavailable);
      assert.equal(body.code, "unavailable");
      assert.equal(body.retryable, false);
      assert.match(body.ref, /^[0-9a-f]{8}$/);
      assert.equal(res.status, 503);
    } finally {
      console.error = original;
    }
  });

  it("logs the real error on the server under the same reference", () => {
    const logged: unknown[][] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => logged.push(args);
    try {
      serverError(keyLimit, "x");
      assert.match(String(logged[0][0]), /^\[[0-9a-f]{8}\] unavailable/);
      assert.equal(logged[0][1], keyLimit);
    } finally {
      console.error = original;
    }
  });
});

describe("failureKind", () => {
  it("tells busy, unavailable, failed checks and other failures apart", () => {
    assert.equal(failureKind(new ModelHttpError(429, "rate limited")), "busy");
    assert.equal(failureKind(new ModelHttpError(503, "down")), "busy");
    assert.equal(failureKind(new ModelHttpError(402, "no credit")), "unavailable");
    assert.equal(failureKind(new ConfigError("OPENROUTER_API_KEY is not set")), "unavailable");
    assert.equal(failureKind(new Error("Every version of the lesson had factual errors: …")), "quality");
    assert.equal(failureKind(Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" })), "busy");
    assert.equal(failureKind(new Error("getCourse: relation does not exist")), "server");
  });
});
