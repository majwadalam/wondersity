import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cleanEmbeds, graphDraws, parseGraph, splitEmbeds } from "./embeds";

const parabola = "```graph\ny = k*x^2\ny = x^2\nx: -5 to 5, distance (m)\ny: 0 to 25, height (m)\nk: 0.5 to 3, steepness, start 1\ncaption: The dashed curve is \\(y = x^2\\).\n```";

describe("inline graphs", () => {
  it("parses a graph block", () => {
    const g = parseGraph(parabola.split("\n").slice(1, -1).join("\n"))!;
    assert.deepEqual(g.curves, ["k*x^2", "x^2"]);
    assert.deepEqual(g.x, { min: -5, max: 5, label: "distance (m)" });
    assert.deepEqual(g.slider, { min: 0.5, max: 3, label: "steepness", start: 1, step: 0.05 });
    assert.ok(graphDraws(g));
  });

  it("keeps good graphs and drops ones that don't draw, are malformed or are cut off", () => {
    const offScreen = "```graph\ny = x^2 + 1000\nx: -5 to 5\ny: 0 to 25\n```";
    const kWithoutSlider = "```graph\ny = k*x\nx: 0 to 5\ny: 0 to 5\n```";
    const unsafe = "```graph\ny = alert(1)\nx: 0 to 5\ny: 0 to 5\n```";
    const text = `Before.\n\n${parabola}\n\n${offScreen}\n\n${kWithoutSlider}\n\n${unsafe}\n\nAfter.\n\n\`\`\`graph\ny = x\nx: 0 to`;
    assert.equal(cleanEmbeds(text), `Before.\n\n${parabola}\n\nAfter.`);
  });

  it("splits text around graphs for drawing", () => {
    const parts = splitEmbeds(`One.\n\n${parabola}\n\nTwo.`);
    assert.deepEqual(parts.map((p) => p.kind), ["text", "graph", "text"]);
  });
});
