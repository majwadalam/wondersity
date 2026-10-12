import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CachedPlan } from "./db";
import { MIN_SIMILARITY, findSharedPlan, type PlanCacheDeps } from "./planCache";

const stoicism: CachedPlan = { topic_key: "stoicism", topic: "Stoicism", title: "Stoicism in Practice", description: "d", modules: [], cover_url: "https://x/world.webp" };
const vector = Array.from({ length: 1536 }, () => 0.01);
const deadline = Date.now() + 60_000;

function deps(over: Partial<PlanCacheDeps> & { judged?: string[] } = {}): PlanCacheDeps {
  return {
    getCachedPlan: async (key) => (key === "stoicism" ? stoicism : null),
    matchCoursePlans: async () => [{ topic_key: "stoicism", topic: "Stoicism", title: stoicism.title, description: "d", similarity: 0.82 }],
    embed: async () => vector,
    judge: async (_topic, candidates) => candidates[0].topic_key,
    ...over,
  };
}

describe("findSharedPlan", () => {
  it("uses an exact topic match without embedding or asking a model", async () => {
    let embedded = false;
    const result = await findSharedPlan("Stoicism", "stoicism", deadline, deps({ embed: async () => ((embedded = true), vector) }));
    assert.equal(result.via, "exact");
    assert.equal(result.plan?.topic_key, "stoicism");
    assert.equal(embedded, false);
  });

  it("finds the same course worded differently, once the judge confirms it", async () => {
    const result = await findSharedPlan("stoic philosophy", "stoic philosophy", deadline, deps());
    assert.equal(result.via, "similar");
    assert.equal(result.plan?.title, "Stoicism in Practice");
    assert.deepEqual(result.embedding, vector);
  });

  it("doesn't share a plan the judge says is a different course", async () => {
    const result = await findSharedPlan("Stoicism for anxiety", "stoicism for anxiety", deadline, deps({ judge: async () => null }));
    assert.equal(result.plan, null);
    // The embedding is kept, so the new plan is cached with it.
    assert.deepEqual(result.embedding, vector);
  });

  it("doesn't ask the judge about topics that aren't close in meaning", async () => {
    let asked = false;
    const result = await findSharedPlan("knitting", "knitting", deadline, deps({
      matchCoursePlans: async () => [{ topic_key: "stoicism", topic: "Stoicism", title: "t", description: "d", similarity: MIN_SIMILARITY - 0.2 }],
      judge: async () => ((asked = true), "stoicism"),
    }));
    assert.equal(result.plan, null);
    assert.equal(asked, false);
  });

  it("falls back to planning fresh when embedding or matching fails", async () => {
    const noEmbed = await findSharedPlan("x topic", "x topic", deadline, deps({ embed: async () => { throw new Error("402"); } }));
    assert.equal(noEmbed.plan, null);
    assert.match(String(noEmbed.note.error), /embedding/);
    const noMatch = await findSharedPlan("x topic", "x topic", deadline, deps({ matchCoursePlans: async () => { throw new Error("db down"); } }));
    assert.equal(noMatch.plan, null);
  });
});
