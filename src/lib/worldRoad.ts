// Traces the road in a course's painted world with Gemini Pro (about
// $0.005, once per world), so the journey's stops sit on the painting's own
// road (components/app/CourseJourney.tsx, lib/journeyPath.ts). Gemini models
// are trained to point at things in pictures on a 0-1000 grid, so the reply is
// [y, x] pairs on that grid. The reply is checked in code; a trace that isn't a
// plausible left-to-right road is dropped and the page uses its default curve.

import { callStructured, type Deadline } from "./model";
import type { Point } from "./journeyPath";
import { env } from "./env";

const roadModel = () => env("ROAD_MODEL") || "google/gemini-3.1-pro-preview";

const schema = {
  type: "object",
  properties: { points: { type: "array", items: { type: "array", items: { type: "number" } } } },
  required: ["points"],
  additionalProperties: false,
};

/**
 * Checks a traced road and converts it to % of the picture: 5-40 points
 * inside the picture, running left to right from the left third to the right
 * third, so every level's region gets its stops. Returns null if it doesn't
 * look like a road across the map.
 */
export function cleanRoad(raw: unknown): Point[] | null {
  const pairs = (raw as { points?: unknown })?.points;
  if (!Array.isArray(pairs)) return null;
  const points: Point[] = [];
  for (const pair of pairs) {
    if (!Array.isArray(pair) || pair.length !== 2 || !pair.every((v) => typeof v === "number" && Number.isFinite(v))) return null;
    const [y, x] = pair as number[];
    if (x < 0 || x > 1000 || y < 0 || y > 1000) return null;
    const p = { x: Math.round(x) / 10, y: Math.round(y) / 10 };
    const last = points[points.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= 1) points.push(p);
  }
  if (points.length < 5 || points.length > 40) return null;
  // A step longer than half the map is a jump, not a road.
  for (let i = 1; i < points.length; i++) if (Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y) > 50) return null;
  const road = points[0].x > points[points.length - 1].x ? points.reverse() : points;
  // Runs 2026-10-12: traces that stopped at 55-67% of the width left the last level without stops.
  if (road[0].x > 30 || road[road.length - 1].x < 70) return null;
  return road;
}

/**
 * The road in the world at `imageUrl`, or null if it couldn't be traced (one
 * retry: traces vary between calls). Throws only on call failures.
 */
export async function traceRoad(imageUrl: string, regions: string[], deadline: Deadline): Promise<Point[] | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const data = await callStructured(
      `You trace paths on illustrated maps. You return points as [y, x], each normalized to 0-1000
(y down from the top edge, x right from the left edge).`,
      `This illustrated map is the world of a course. ${
        regions.length > 1 ? `From left to right it has ${regions.length} regions: ${regions.join("; ")}. ` : ""
      }A learner's journey follows the main road across it.
Trace that road from where it starts near the LEFT edge to where it ends near the RIGHT edge, following
its centre line through every region. Where roads branch, take the branch that keeps going right
towards the next region; don't turn off up a hill or into a dead end. Return 14-24 points in order.
Every point must lie ON the road surface (dirt road, stone path, bridge, square), not on buildings,
water or grass; where the road crosses water it does so on a bridge.`,
      schema,
      deadline,
      { model: roadModel(), images: [imageUrl], reasoningEffort: "low", timeoutMs: 60_000, maxTokens: 3_000 }
    );
    const road = cleanRoad(data);
    if (road) return road;
  }
  return null;
}
