import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { journey, MAP_ASPECT } from "./journeyPath";
import { cleanRoad } from "./worldRoad";

// The road traced in the Game theory world (course 13), as Gemini returned it.
const traced = { points: [[231, 74], [342, 86], [439, 75], [537, 120], [610, 167], [691, 168], [762, 233], [799, 319], [783, 408], [736, 459], [837, 488], [876, 548], [822, 618], [726, 676], [695, 705], [674, 752], [642, 808], [578, 834], [537, 857]] };

describe("cleanRoad", () => {
  it("converts a traced road to % of the picture, left to right", () => {
    const road = cleanRoad(traced)!;
    assert.equal(road.length, 19);
    assert.deepEqual(road[0], { x: 7.4, y: 23.1 });
    assert.deepEqual(road[18], { x: 85.7, y: 53.7 });
    // Traced right to left, it is turned around.
    assert.deepEqual(cleanRoad({ points: [...traced.points].reverse() })![0], { x: 7.4, y: 23.1 });
  });

  it("drops traces that aren't a road across the map", () => {
    assert.equal(cleanRoad({ points: [[500, 100], [500, 200]] }), null); // too few points
    assert.equal(cleanRoad({ points: [[100, 400], [200, 420], [300, 440], [400, 460], [500, 480]] }), null); // too narrow
    assert.equal(cleanRoad({ points: [[100, 50], [100, 1200], [100, 300], [100, 400], [100, 500]] }), null); // off the picture
    assert.equal(cleanRoad({ points: [[100, 50], [900, 950], [100, 300], [100, 400], [100, 500]] }), null); // a jump
    assert.equal(cleanRoad({ nope: true }), null);
  });
});

describe("journey", () => {
  it("spaces stops evenly along the road's length", () => {
    const { curve, stops } = journey(cleanRoad(traced), 8);
    assert.equal(stops.length, 8);
    const gaps = stops.slice(1).map((s, i) => Math.hypot((s.x - stops[i].x) * MAP_ASPECT, s.y - stops[i].y));
    // Straight-line gaps are at most the distance along the road, and on a gently curving road close to it.
    assert.ok(Math.max(...gaps) / Math.min(...gaps) < 1.8, `uneven gaps: ${gaps.map((g) => g.toFixed(1))}`);
    // Each stop sits on the drawn curve, in order.
    stops.forEach((s, i) => assert.deepEqual({ x: s.x, y: s.y }, { x: curve[s.at].x, y: curve[s.at].y }, `stop ${i}`));
    assert.ok(stops.every((s, i) => i === 0 || s.at > stops[i - 1].at));
  });

  it("uses a default curve without a traced road", () => {
    for (const road of [null, []]) {
      const { stops } = journey(road, 5);
      assert.equal(stops.length, 5);
      assert.ok(stops[0].x < 15 && stops[4].x > 85);
    }
    assert.equal(journey(null, 1).stops.length, 1);
  });
});
