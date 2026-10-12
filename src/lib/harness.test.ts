import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { onSharedPath } from "./harness";

describe("onSharedPath", () => {
  it("keeps a learner on the shared path until they answer a check wrong", () => {
    assert.equal(onSharedPath([]), true);
    assert.equal(onSharedPath([{ attempts: [{ correct: true }, { correct: true }] }, { attempts: [] }]), true);
    assert.equal(onSharedPath([{ attempts: [{ correct: true }] }, { attempts: [{ correct: false }] }]), false);
  });
});
