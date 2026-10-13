// The journey across a course's world: the road the stops sit on, as points in
// % of the picture's width and height. A road traced from the painting
// (lib/worldRoad.ts) is used when there is one; otherwise a default curve.
// The road is drawn as a smooth curve through its points, and stops are spaced
// evenly along its length, so they follow the road instead of jumping across it.

export type Point = { x: number; y: number };

/** The map's width over its height (the world is painted and shown at 21:9). */
export const MAP_ASPECT = 21 / 9;

/** A gentle default road from left to right, for worlds without a traced one. */
export function defaultRoad(): Point[] {
  return Array.from({ length: 9 }, (_, i) => {
    const t = i / 8;
    return { x: 5 + t * 90, y: 56 + Math.sin(t * Math.PI * 2.2 + 0.4) * 18 };
  });
}

/** Points on a Catmull-Rom curve through the road's points, `per` per segment. */
export function smooth(points: Point[], per = 16): Point[] {
  if (points.length < 3) return points;
  const at = (i: number) => points[Math.max(0, Math.min(points.length - 1, i))];
  const out: Point[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    for (let s = 0; s < per; s++) {
      const t = s / per;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

/** Distance along the curve to each of its points, measured in true proportions (x stretched to the map's aspect). */
function lengths(curve: Point[]) {
  const acc = [0];
  for (let i = 1; i < curve.length; i++) {
    const dx = (curve[i].x - curve[i - 1].x) * MAP_ASPECT;
    const dy = curve[i].y - curve[i - 1].y;
    acc.push(acc[i - 1] + Math.hypot(dx, dy));
  }
  return acc;
}

const round = (v: number) => Math.round(v * 100) / 100;

/**
 * The journey for n stops: the smoothed road, each stop's position (evenly
 * spaced by length, a little in from both ends) and the index on the curve
 * where each stop sits, so the walked part can be drawn up to a stop.
 * Rounded, so the server and the browser draw the same road.
 */
export function journey(road: Point[] | null | undefined, n: number) {
  const curve = smooth(road && road.length >= 2 ? road : defaultRoad()).map((p) => ({ x: round(p.x), y: round(p.y) }));
  const acc = lengths(curve);
  const total = acc[acc.length - 1] || 1;
  const margin = n === 1 ? 0.5 : 0.04;
  const stops = Array.from({ length: n }, (_, i) => {
    const target = total * (n === 1 ? 0.5 : margin + ((1 - 2 * margin) * i) / (n - 1));
    let k = acc.findIndex((d) => d >= target);
    if (k < 0) k = curve.length - 1;
    return { ...curve[k], at: k };
  });
  return { curve, stops };
}

/** An SVG path through points (in the 0-100 viewBox). */
export const pathOf = (points: Point[]) => points.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");
