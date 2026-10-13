import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chunks } from "./rich";

describe("chunks", () => {
  it("rebuilds a table written on one line", () => {
    const text =
      "Six deliveries: | Route | Weather | Time | |---|---|---| | Short | Dry | 18 minutes | | Short | Wet | 30 minutes | Which estimate fits?";
    assert.deepEqual(chunks(text), [
      { kind: "text", lines: ["Six deliveries:"] },
      {
        kind: "table",
        rows: [
          ["Route", "Weather", "Time"],
          ["Short", "Dry", "18 minutes"],
          ["Short", "Wet", "30 minutes"],
        ],
      },
      { kind: "text", lines: ["Which estimate fits?"] },
    ]);
  });

  it("leaves pipes without a separator row alone", () => {
    assert.deepEqual(chunks("a | b | c"), [{ kind: "text", lines: ["a | b | c"] }]);
  });
});
