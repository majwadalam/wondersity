"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTime, useTransform } from "motion/react";
import { useEffect, useId } from "react";

// The mascot: a small owl in a beret (Athena's owl, for an agora-themed app).
// While a lesson is staged it flies in front of an easel and paints the real
// picture onto the canvas, one brush stroke at a time, over a pencil sketch of
// it. The brush tip follows the same strokes that reveal the painting, so the
// owl is always painting where paint appears. Drawn in SVG with the colour
// tokens; with reduced motion the finished painting is shown, owl at rest.

const VIEW = { w: 360, h: 240 };
const CANVAS = { x: 70, y: 14, w: 220, h: 140 };
const STROKES = 6;
/** Share of each stroke's time spent painting; the rest moves to the next row. */
const DRAW = 0.82;
/** Seconds to paint the whole canvas (staging takes about half a minute). */
const PAINT_SECONDS = 25;
/** Where the brush tip sits in the owl's own coordinates. */
const TIP = { x: 41, y: -36 };
const PAINTS = ["var(--accent)", "var(--warn)", "var(--good)", "var(--accent-on-dark)"];

const rowY = (i: number) => CANVAS.y + (CANVAS.h / STROKES) * (i + 0.5);
const left = CANVAS.x - 4;
const right = CANVAS.x + CANVAS.w + 4;

/** Point `f` (0-1) along stroke `i`. Rows alternate direction, like a painter's back-and-forth. */
function strokePoint(i: number, f: number) {
  const x = i % 2 === 0 ? left + (right - left) * f : right - (right - left) * f;
  return { x, y: rowY(i) + 3.5 * Math.sin(x / 22 + i * 1.7) };
}

const strokePath = (i: number) =>
  Array.from({ length: 29 }, (_, k) => strokePoint(i, k / 28))
    .map((p, k) => `${k ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

const PATHS = Array.from({ length: STROKES }, (_, i) => strokePath(i));

/** Where the brush tip is at painting progress `p` (0 to STROKES). */
function tipAt(p: number) {
  if (p >= STROKES) return strokePoint(STROKES - 1, 1);
  const i = Math.floor(p);
  const f = p - i;
  if (f <= DRAW) return strokePoint(i, f / DRAW);
  // Between rows: lift off the canvas a little and drop to the next row's start.
  const t = (f - DRAW) / (1 - DRAW);
  const a = strokePoint(i, 1);
  const b = strokePoint(i + 1, 0);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t + 10 * Math.sin(Math.PI * t) };
}

/** After the painting is done: small touch-ups drifting over the canvas. */
function touchUp(seconds: number) {
  return {
    x: 180 + 62 * Math.sin(seconds / 2.3) + 3 * Math.sin(seconds * 9),
    y: 80 + 34 * Math.sin(seconds / 1.4) + 2 * Math.cos(seconds * 9),
  };
}

export function PaintingOwl({ src, className = "" }: { src: string | null; className?: string }) {
  const id = useId().replace(/:/g, "");
  const reduce = useReducedMotion();
  const progress = useMotionValue(0);
  const settle = useMotionValue(0);
  const time = useTime();

  useEffect(() => {
    if (reduce) {
      progress.set(STROKES);
      return;
    }
    const paint = animate(progress, STROKES, { duration: PAINT_SECONDS, ease: "linear" });
    let after: ReturnType<typeof animate> | undefined;
    paint.then(() => {
      after = animate(settle, 1, { duration: 1.6, ease: "easeInOut" });
    });
    return () => {
      paint.stop();
      after?.stop();
    };
  }, [reduce, progress, settle]);

  const tip = useTransform(() => {
    const p = tipAt(progress.get());
    const s = settle.get();
    if (!s) return p;
    const q = touchUp(time.get() / 1000);
    return { x: p.x + (q.x - p.x) * s, y: p.y + (q.y - p.y) * s };
  });
  const bob = useTransform(() => (reduce ? 0 : 2.5 * Math.sin(time.get() / 160)));
  const owlX = useTransform(() => tip.get().x - TIP.x);
  const owlY = useTransform(() => tip.get().y - TIP.y + bob.get());
  const shadowX = useTransform(() => owlX.get());
  const paint = useTransform(() => PAINTS[Math.min(Math.floor(progress.get()), STROKES - 1) % PAINTS.length]);

  return (
    <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className={`overflow-visible ${className}`} aria-hidden="true">
      <defs>
        <clipPath id={`${id}-canvas`}>
          <rect x={CANVAS.x} y={CANVAS.y} width={CANVAS.w} height={CANVAS.h} rx="4" />
        </clipPath>
        <filter id={`${id}-sketch`}>
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <mask id={`${id}-paint`} maskUnits="userSpaceOnUse" x="0" y="0" width={VIEW.w} height={VIEW.h}>
          {PATHS.map((d, i) => (
            <Stroke key={i} d={d} index={i} progress={progress} />
          ))}
        </mask>
        <linearGradient id={`${id}-blank`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--art-from)" />
          <stop offset="1" stopColor="var(--art-to)" />
        </linearGradient>
      </defs>

      {/* Ground shadows: the easel's, and the owl's following it. */}
      <ellipse cx="180" cy="233" rx="92" ry="4" fill="var(--fg)" opacity="0.06" />
      <motion.ellipse cx={0} cy="233" rx="18" ry="3" fill="var(--fg)" opacity="0.08" style={{ x: shadowX }} />

      {/* Easel */}
      <g stroke="var(--muted)" strokeOpacity="0.45" strokeWidth="5" strokeLinecap="round">
        <line x1="180" y1="10" x2="180" y2="230" />
        <line x1="150" y1="150" x2="118" y2="230" />
        <line x1="210" y1="150" x2="242" y2="230" />
      </g>
      <rect x="170" y="6" width="20" height="12" rx="3" fill="var(--muted)" opacity="0.55" />

      {/* Canvas: the pencil sketch, then the painting where the strokes have been. */}
      <g style={{ filter: "drop-shadow(0 6px 10px rgba(50, 50, 93, 0.16))" }}>
        <rect x={CANVAS.x} y={CANVAS.y} width={CANVAS.w} height={CANVAS.h} rx="4" fill="var(--surface)" />
      </g>
      <g clipPath={`url(#${id}-canvas)`}>
        {src && (
          <image
            href={src}
            x={CANVAS.x}
            y={CANVAS.y}
            width={CANVAS.w}
            height={CANVAS.h}
            preserveAspectRatio="xMidYMid slice"
            filter={`url(#${id}-sketch)`}
            opacity="0.16"
          />
        )}
        <g mask={`url(#${id}-paint)`}>
          {src ? (
            <image href={src} x={CANVAS.x} y={CANVAS.y} width={CANVAS.w} height={CANVAS.h} preserveAspectRatio="xMidYMid slice" />
          ) : (
            <rect x={CANVAS.x} y={CANVAS.y} width={CANVAS.w} height={CANVAS.h} fill={`url(#${id}-blank)`} />
          )}
        </g>
      </g>
      <rect x={CANVAS.x} y={CANVAS.y} width={CANVAS.w} height={CANVAS.h} rx="4" fill="none" stroke="var(--line)" />
      <rect x={CANVAS.x - 10} y={CANVAS.y + CANVAS.h} width={CANVAS.w + 20} height="8" rx="3" fill="var(--muted)" opacity="0.55" />

      <motion.g style={{ x: owlX, y: owlY }}>
        <Owl paint={paint} />
      </motion.g>
    </svg>
  );
}

function Stroke({ d, index, progress }: { d: string; index: number; progress: ReturnType<typeof useMotionValue<number>> }) {
  const length = useTransform(() => Math.min(1, Math.max(0, (progress.get() - index) / DRAW)));
  // A zero-length dash still draws a round cap, so unstarted strokes are hidden.
  const opacity = useTransform(() => (length.get() > 0 ? 1 : 0));
  return (
    <motion.path
      d={d}
      fill="none"
      stroke="white"
      strokeWidth={CANVAS.h / STROKES + 8}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ pathLength: length, opacity }}
    />
  );
}

/** The owl in its own coordinates: body centred on 0,0, brush tip at TIP. */
function Owl({ paint }: { paint: ReturnType<typeof useTransform<string, string>> }) {
  return (
    <g>
      {/* Back wing, flapping */}
      <ellipse className="owl-wing" cx="-23" cy="2" rx="7" ry="15" fill="var(--accent-strong)" />
      {/* Ear tufts and body */}
      <path d="M-20 -12 L-18 -29 L-7 -19 Z M20 -12 L18 -29 L7 -19 Z" fill="var(--accent)" />
      <ellipse cx="0" cy="5" rx="24" ry="27" fill="var(--accent)" />
      <ellipse cx="0" cy="14" rx="15" ry="16" fill="var(--accent-soft)" />
      <path
        d="M-6 9 l3 3 l3 -3 M2 9 l3 3 l3 -3 M-2 17 l3 3 l3 -3"
        fill="none"
        stroke="var(--accent)"
        strokeOpacity="0.35"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Eyes, looking up at the brush, with lids that blink */}
      {[-9, 9].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="-7" r="9.5" fill="var(--surface)" />
          <circle cx={cx + 2.5} cy="-9" r="4.5" fill="var(--fg)" />
          <circle cx={cx + 4} cy="-10.5" r="1.3" fill="var(--surface)" />
          <ellipse className="owl-lid" cx={cx} cy="-7" rx="10" ry="10" fill="var(--accent)" />
        </g>
      ))}
      <path d="M-3 0 L3 0 L0 5.5 Z" fill="var(--warn)" />
      {/* Beret */}
      <ellipse cx="3" cy="-24" rx="16" ry="5.5" transform="rotate(-12 3 -24)" fill="var(--fg)" />
      <circle cx="5" cy="-31" r="2.4" fill="var(--fg)" />
      {/* Feet, tucked up in flight */}
      <ellipse cx="-7" cy="31" rx="4" ry="2.5" fill="var(--warn)" />
      <ellipse cx="7" cy="31" rx="4" ry="2.5" fill="var(--warn)" />
      {/* Brush, held in the front wing */}
      <line x1="22" y1="-4" x2="36" y2="-28" stroke="var(--fg)" strokeWidth="3" strokeLinecap="round" />
      <line x1="35" y1="-26" x2="38" y2="-31" stroke="var(--line-strong)" strokeWidth="4" strokeLinecap="round" />
      <motion.path d="M36.5 -31 Q38 -37 41 -36 Q41.5 -32 39.5 -29.5 Z" style={{ fill: paint }} />
      <ellipse cx="21" cy="1" rx="6" ry="11" transform="rotate(30 21 1)" fill="var(--accent-strong)" />
    </g>
  );
}
