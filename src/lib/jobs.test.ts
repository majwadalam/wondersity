import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { JobRow } from "./db";
import { view } from "./jobs";

const row = (over: Partial<JobRow>): JobRow => ({
  id: "00000000-0000-0000-0000-000000000001",
  learner_id: "u1",
  kind: "learn",
  topic: "Stoicism",
  topic_key: "stoicism",
  status: "running",
  result: null,
  error: null,
  ref: null,
  retryable: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...over,
});

describe("job view", () => {
  it("shows a running job as running, and a finished one with its result", () => {
    assert.equal(view(row({})).status, "running");
    const done = view(row({ status: "done", result: { kind: "nothing_ahead", trace: [] } }));
    assert.equal(done.status, "done");
    assert.deepEqual(done.result, { kind: "nothing_ahead", trace: [] });
  });

  it("treats a job untouched past the route's limit as failed, with a plain message", () => {
    const old = new Date(Date.now() - 7 * 60 * 1000).toISOString();
    const v = view(row({ updated_at: old }));
    assert.equal(v.status, "failed");
    assert.equal(v.retryable, true);
    assert.match(v.error!, /taking longer/);
  });

  it("passes on a failed job's plain message and reference, never more", () => {
    const v = view(row({ status: "failed", error: "Our tutor is busy right now. Please try again in a minute.", ref: "a1b2c3d4", retryable: true }));
    assert.deepEqual([v.error, v.ref, v.retryable], ["Our tutor is busy right now. Please try again in a minute.", "a1b2c3d4", true]);
  });
});
