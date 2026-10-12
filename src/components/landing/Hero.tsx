"use client";

import {
  AnimatePresence,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useAppState, useStartCourse } from "../app/AppState";
import { EASE_OUT } from "../motion/presets";
import { Reveal } from "../Reveal";
import { HoverArrow } from "./HoverArrow";
import { Lines } from "./Primitives";

const SUGGESTIONS = [
  "Reading a cap table",
  "The Socratic method",
  "SQL window functions",
  "Byzantine iconoclasm",
];

// The course the hero walks across: the test account's Stoicism course as
// Wondersity planned it, three levels of three lessons. Its world was painted with
// the product's own world prompt for those levels
// (scripts/generate-landing-art.ts hero). Lesson titles aren't shown because
// the page only states what it knows: the course, its levels and what each
// level covers.
const COURSE = {
  title: "Stoicism: From Ideas to Daily Practice",
  levels: [
    {
      title: "The Stoic Worldview",
      covers: "Nature, the mind and what is in our control",
    },
    {
      title: "The Stoic Toolkit",
      covers: "The exercises the Stoics actually practised",
    },
    { title: "Living It", covers: "Emotions, other people and the real world" },
  ],
  lessons: 9,
};
const PER_LEVEL = COURSE.lessons / COURSE.levels.length;

// The painted road in hero.webp, traced by hand in % of the picture's width
// and height, left to right. The route and the stops sit on it.
const TRACE: [number, number][] = [
  [15.5, 29],
  [12.5, 33],
  [11.2, 37.5],
  [12.5, 42.5],
  [16.5, 45.5],
  [19.8, 49],
  [20, 54],
  [17.5, 59],
  [15, 64.5],
  [14.6, 70],
  [17, 75],
  [21, 78.5],
  [25, 81.5],
  [29.5, 83.5],
  [33, 81],
  [35.8, 75.5],
  [37.6, 69],
  [39, 61],
  [41, 54.5],
  [44, 51],
  [47.5, 51],
  [50.5, 53],
  [51.8, 58],
  [52.4, 64],
  [54, 70.5],
  [56.5, 75],
  [60.5, 78.5],
  [64.2, 77.8],
  [66.4, 73.5],
  [67, 67],
  [66.8, 60.5],
  [67.8, 55],
  [70.5, 51.8],
  [74.5, 50.6],
  [78.5, 51.2],
  [82.5, 53.5],
  [86, 58],
  [88.2, 63],
  [89.6, 68],
  [92, 72],
  [95.5, 74],
  [100, 75],
];
/** Which traced point each lesson's stop sits on. */
const STOP_AT = [2, 5, 12, 16, 19, 24, 29, 34, 39];

/** The route as a smooth curve (Catmull-Rom through the traced points), sampled densely. */
const ROUTE = (() => {
  const pts: [number, number][] = [];
  const stopIndex: number[] = [];
  for (let i = 0; i < TRACE.length - 1; i++) {
    const p0 = TRACE[Math.max(0, i - 1)];
    const p1 = TRACE[i];
    const p2 = TRACE[i + 1];
    const p3 = TRACE[Math.min(TRACE.length - 1, i + 2)];
    if (STOP_AT.includes(i)) stopIndex[STOP_AT.indexOf(i)] = pts.length;
    for (let k = 0; k < 8; k++) {
      const t = k / 8;
      const t2 = t * t;
      const t3 = t2 * t;
      const at = (a: number, b: number, c: number, d: number) =>
        0.5 *
        (2 * b +
          (-a + c) * t +
          (2 * a - 5 * b + 4 * c - d) * t2 +
          (-a + 3 * b - 3 * c + d) * t3);
      pts.push([
        at(p0[0], p1[0], p2[0], p3[0]),
        at(p0[1], p1[1], p2[1], p3[1]),
      ]);
    }
  }
  pts.push(TRACE[TRACE.length - 1]);
  // Rounded, so the server and the browser draw the same path.
  const r = (v: number) => Math.round(v * 100) / 100;
  const d = pts
    .map(([x, y], i) => `${i ? "L" : "M"} ${r(x)} ${r(y)}`)
    .join(" ");
  // Length along the route in the SVG's own units, which is what pathLength measures.
  const dist = pts.reduce<number[]>(
    (acc, p, i) =>
      i
        ? [
            ...acc,
            acc[i - 1] + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]),
          ]
        : [0],
    [],
  );
  const total = dist[dist.length - 1];
  return { d, along: stopIndex.map((i) => dist[i] / total) };
})();
const STOPS = STOP_AT.map((i) => ({ x: TRACE[i][0], y: TRACE[i][1] }));

// Places in the painting, pinned in % of the picture, with what each stands
// for. The meanings come from what each level covers (and one historical
// fact: the Stoics were named for the stoa where Zeno taught).
const PLACES: {
  x: number;
  y: number;
  name: string;
  note: string;
  below?: boolean;
  /** For places near an edge: which way the label runs from its pin. */
  align?: "start" | "end";
}[] = [
  { x: 7.5, y: 86, name: "The cosmos", note: "Nature as one ordered whole", align: "start" },
  { x: 26.5, y: 63, name: "The walled garden", note: "What is in our control" },
  {
    x: 61,
    y: 37,
    name: "The stoa",
    note: "Where Stoicism got its name",
    below: true,
  },
  { x: 54.6, y: 66.5, name: "The sundial", note: "A practice for every day" },
  { x: 72.5, y: 63, name: "Rough water", note: "Emotions" },
  { x: 85, y: 41, name: "The market", note: "Other people" },
  { x: 94.5, y: 85, name: "The long table", note: "Living it with others", align: "end", below: true },
];

// The pinned hero's scroll, 0 to 1: the words leave, the world rises to fill
// the screen, then the camera travels the road from lesson 1 to lesson 9.
const TEXT_OUT = 0.07;
// The world waits until the words have gone, so the two never overlap.
const RISE = [0.075, 0.32] as const;
const PAN = [0.34, 0.96] as const;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Progress through [a, b], eased out. */
const phase = (v: number, [a, b]: readonly [number, number]) => {
  const t = clamp01((v - a) / (b - a));
  return 1 - Math.pow(1 - t, 3);
};
const linear = (v: number, [a, b]: readonly [number, number]) =>
  clamp01((v - a) / (b - a));

/** How far along the route (0 to 1) the walk has got when the camera's view reaches world x (a fraction). */
function tipAt(worldX: number) {
  const xs = STOPS.map((s) => s.x / 100);
  if (worldX <= xs[0]) return 0;
  for (let i = 1; i < xs.length; i++) {
    if (worldX <= xs[i])
      return lerp(
        ROUTE.along[i - 1],
        ROUTE.along[i],
        (worldX - xs[i - 1]) / (xs[i] - xs[i - 1]),
      );
  }
  return 1;
}

export function Hero() {
  const reduced = useReducedMotion();
  return reduced ? <StillHero /> : <PinnedHero />;
}

// Topics too niche for a course anywhere else, shown one at a time in the hero tag.
const NICHE = [
  "Byzantine iconoclasm",
  "Sourdough hydration",
  "Freelance taxes",
  "Babylonian numbers",
  "Kubernetes networking",
  "Reading a cap table",
];

/** The hero tag: "Nobody teaches" and a niche topic that changes every few seconds. */
function NobodyTeaches() {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const t = setInterval(() => setI((n) => (n + 1) % NICHE.length), 2600);
    return () => clearInterval(t);
  }, [reduced]);
  return (
    <p className="flex justify-center">
      <motion.span
        layout
        transition={{ layout: { duration: 0.45, ease: EASE_OUT } }}
        className="inline-flex items-center gap-1.5 overflow-hidden rounded-full border border-accent/15 bg-accent-soft py-1.5 pr-3.5 pl-3.5 text-[13px] leading-none"
      >
        <motion.span layout="position" className="text-muted">
          Nobody teaches
        </motion.span>
        <span className="sr-only">courses for topics like {NICHE.join(", ")}</span>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={NICHE[i]}
            aria-hidden
            initial={{ y: "110%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "-110%", opacity: 0 }}
            transition={{ duration: 0.45, ease: EASE_OUT }}
            className="font-medium whitespace-nowrap text-accent-strong"
          >
            {NICHE[i]}
          </motion.span>
        </AnimatePresence>
      </motion.span>
    </p>
  );
}

/** The hero's words: what Wondersity does, and a box to start. */
function HeroCopy() {
  return (
    <>
      <Reveal delay={0}>
        <NobodyTeaches />
      </Reveal>
      <Lines
        as="h1"
        delay={80}
        lines={["Name any topic.", "Walk through its world."]}
        className="display-xl mx-auto mt-5 text-[44px] text-fg sm:text-[64px] lg:text-[76px] xl:text-[92px]"
      />
      <Reveal delay={360}>
        <p className="mx-auto mt-6 max-w-[46rem] text-[17px] leading-relaxed text-muted sm:text-[19px]">
          Too niche, too new, too scattered, or not at your level. Name it, for
          work or for curiosity, and Wondersity plans the course, teaches it hands-on,
          and checks what you understood.
        </p>
      </Reveal>
      <Reveal delay={480}>
        <ReplyForm id="hero-topic" light center />
      </Reveal>
    </>
  );
}

function PinnedHero() {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: section,
    offset: ["start start", "end end"],
  });
  // The scroll, smoothed by a spring: wheel steps and trackpad flicks glide instead of jumping.
  const p = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 32,
    mass: 0.5,
    restDelta: 0.0005,
  });

  // Everything that moves is computed here from the scroll and the measured
  // sizes, then written to motion values (no React render per frame).
  const textOpacity = useMotionValue(1);
  const textY = useMotionValue(0);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(0.4);
  const tip = useMotionValue(0);
  const radius = useMotionValue(28);
  const hintOpacity = useMotionValue(1);
  const panelOpacity = useMotionValue(0);
  const [level, setLevel] = useState(0);
  const size = useRef({ vw: 1440, stage: 760, worldW: 2216, worldH: 950, copyBottom: 560 });

  const update = useCallback(
    (v: number) => {
      const { vw, stage: h, worldW, worldH } = size.current;
      const wide = vw >= 768;
      // Small and centred under the words, peeking up from the bottom...
      const s0 = Math.min(wide ? 0.42 : 0.3, (0.9 * vw) / worldW);
      // ...its top edge just under the words (about 40px below the topic box's suggestions).
      const y0 = size.current.copyBottom + (wide ? 40 : 28) - (h - s0 * worldH);
      // ...then full size with its left edge on screen, then panned to its right edge.
      const rise = phase(v, RISE);
      const pan = linear(v, PAN);
      const s = lerp(s0, 1, rise);
      const left =
        v < PAN[0]
          ? lerp((vw - worldW * s0) / 2, 0, rise)
          : lerp(0, vw - worldW, pan);
      scale.set(s);
      // Rounded like a card while small (radius in the layer's own px, so it looks the same at any scale).
      radius.set(lerp(24 / s0, 0, rise));
      y.set(lerp(y0, 0, rise));
      x.set(left + (worldW * s) / 2 - vw / 2);

      textOpacity.set(1 - clamp01(v / TEXT_OUT));
      textY.set(-90 * phase(v, [0, TEXT_OUT]));
      hintOpacity.set(1 - clamp01(v / 0.05));
      panelOpacity.set(clamp01((v - (RISE[1] - 0.04)) / 0.05));

      // The walk's front moves across the screen as the camera pans (from 8% to 92%
      // of its width), so it starts before lesson 1 and ends after lesson 9.
      const t =
        v < PAN[0]
          ? 0
          : tipAt((lerp(0.08, 0.92, pan) * vw + (worldW - vw) * pan) / worldW);
      tip.set(v >= PAN[1] ? 1 : t);
      const reached = ROUTE.along.filter((a) => t >= a - 0.001).length;
      setLevel(
        Math.min(
          COURSE.levels.length - 1,
          Math.max(0, Math.floor((reached - 1) / PER_LEVEL)),
        ),
      );
    },
    [scale, radius, y, x, textOpacity, textY, hintOpacity, panelOpacity, tip],
  );
  useMotionValueEvent(p, "change", update);

  useEffect(() => {
    const measure = () => {
      if (!layer.current || !stage.current) return;
      size.current = {
        vw: window.innerWidth,
        stage: stage.current.offsetHeight,
        copyBottom: copy.current ? copy.current.offsetTop + copy.current.offsetHeight : 560,
        worldW: layer.current.offsetWidth,
        worldH: layer.current.offsetHeight,
      };
      update(p.get());
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (layer.current) ro.observe(layer.current);
    if (stage.current) ro.observe(stage.current);
    if (copy.current) ro.observe(copy.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [p, update]);

  return (
    <section ref={section} className="relative h-[230vh] bg-white md:h-[320vh]">
      {/* The site header (4rem) stays above; the stage is the rest of the screen. */}
      <div
        ref={stage}
        className="sticky top-16 h-[var(--hero-h)] overflow-hidden [--world-h:calc(var(--hero-h)*0.74)] md:[--world-h:calc(var(--hero-h)*1.2)]"
        style={{ "--hero-h": "calc(100svh - 4rem)" } as CSSProperties}
      >
        <motion.div
          ref={copy}
          style={{ opacity: textOpacity, y: textY }}
          className="relative z-10 mx-auto max-w-[1160px] px-5 pt-10 text-center sm:px-8 md:pt-[6vh]"
        >
          <HeroCopy />
        </motion.div>

        {/* The world: small under the words, then full screen and panning. */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
          <motion.div
            ref={layer}
            style={{
              x,
              y,
              scale,
              borderRadius: radius,
              transformOrigin: "50% 100%",
            }}
            className="relative h-[var(--world-h)] w-[calc(var(--world-h)*21/9)] min-w-[100vw] overflow-hidden"
          >
            <WorldMap tip={tip} />
          </motion.div>
        </div>

        <motion.p
          style={{ opacity: hintOpacity }}
          aria-hidden
          className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 font-mono text-[11px] tracking-[0.18em] text-white uppercase drop-shadow"
        >
          Scroll <span className="scroll-tick block h-6 w-px bg-white/70" />
        </motion.p>

        {/* Where the walk is: a band that fades down from the white header, over the sky. */}
        <motion.div
          style={{ opacity: panelOpacity }}
          // On wide screens the band fades out to the right, so places pinned there stay clear.
          className="absolute inset-x-0 top-0 bg-gradient-to-b from-white via-white/85 to-transparent pt-5 pb-12 sm:pt-6 md:[mask-image:linear-gradient(90deg,#000_40%,transparent_68%)]"
        >
          <Caption level={level} />
        </motion.div>
      </div>
    </section>
  );
}

/** The same hero with nothing pinned or moving: the words, then the whole map. */
function StillHero() {
  const done = useMotionValue(1);
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-[1160px] px-5 pt-14 text-center sm:px-8 sm:pt-20">
        <HeroCopy />
      </div>
      <div className="mx-auto max-w-[1160px] px-3 pt-14 pb-20 sm:px-8 sm:pt-16 sm:pb-24">
        <div className="-mx-3 overflow-x-auto px-3 pb-2 sm:mx-0 sm:px-0">
          <div className="relative aspect-[21/9] min-w-[720px] overflow-hidden rounded-3xl shadow-[var(--shadow-lg)]">
            <WorldMap tip={done} />
          </div>
        </div>
        <div className="mt-6 -mx-5 sm:-mx-8">
          <Caption level={COURSE.levels.length - 1} />
        </div>
      </div>
    </section>
  );
}

/** Where the walk is: the level it's crossing, in the page's display type. */
function Caption({ level }: { level: number }) {
  const l = COURSE.levels[level];
  const first = level * PER_LEVEL + 1;
  return (
    <div className="mx-auto max-w-[1160px] px-5 sm:px-8">
      <p className="font-mono text-[11px] tracking-[0.18em] text-accent uppercase sm:text-[12px]">
        Level {level + 1} of {COURSE.levels.length} · Lessons {first}–
        {first + PER_LEVEL - 1}
      </p>
      <div className="mt-1.5 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={level}
            initial={{ y: "105%" }}
            animate={{ y: 0 }}
            exit={{
              y: "-105%",
              transition: { duration: 0.2, ease: [0.4, 0, 1, 1] },
            }}
            transition={{ duration: 0.55, ease: EASE_OUT }}
          >
            <p className="display-xl text-[28px] leading-[1.08] text-fg sm:text-[36px] lg:text-[42px]">
              {l.title}
            </p>
            <p className="mt-1 text-[15px] text-muted">{l.covers}</p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/** The painted world with the walked route and the lesson stops on its road. */
function WorldMap({ tip }: { tip: MotionValue<number> }) {
  const maskId = useId().replace(/:/g, "");
  // A path drawn to length 0 still shows its round cap; hide it until the walk starts.
  const started = useTransform(tip, (t) => (t > 0.002 ? 1 : 0));
  return (
    // A box with the picture's exact shape, so traced points land on the road.
    <div className="absolute inset-x-0 bottom-0 aspect-[21/9]">
      {/* Three widths: the browser picks by the map's full-screen width and the screen's pixel density,
          so retina phones and desktops still get the full 4K picture and others load far less.
          The sizes are the layer's width once risen: 1.2 (wide) or 0.74 (phone) of the stage height, at 21:9. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- a plain srcset; next/image can't serve our own widths unoptimized */}
      <img
        src="/art/landing/hero.webp"
        srcSet="/art/landing/hero-2400.webp 2400w, /art/landing/hero-3600.webp 3600w, /art/landing/hero.webp 6336w"
        sizes="(min-width: 768px) calc((100vh - 4rem) * 2.8), calc((100vh - 4rem) * 1.73)"
        alt="A painted world for a course on Stoicism: a mountain under storm clouds and a quiet garden, then a sundial, an hourglass and a small temple, then a lively harbour town, joined by one winding road"
        fetchPriority="high"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div
        className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20"
        aria-hidden
      />
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        <defs>
          <mask
            id={maskId}
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width="100"
            height="100"
          >
            {/* No non-scaling stroke on the mask: Chrome would measure its length in screen pixels. */}
            <motion.path
              d={ROUTE.d}
              style={{ pathLength: tip, opacity: started }}
              fill="none"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </mask>
        </defs>
        <g mask={`url(#${maskId})`}>
          <path
            d={ROUTE.d}
            fill="none"
            stroke="white"
            strokeOpacity="0.95"
            strokeWidth="9"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={ROUTE.d}
            fill="none"
            stroke="#635bff"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      </svg>
      {PLACES.map((place) => (
        <Place key={place.name} place={place} tip={tip} />
      ))}
      {STOPS.map((_, i) => (
        <Stop key={i} i={i} tip={tip} />
      ))}
    </div>
  );
}

const ALIGN = {
  center: { box: "-translate-x-1/2 items-center text-center", stem: "" },
  start: { box: "-translate-x-3 items-start text-left", stem: "ml-3" },
  end: { box: "-translate-x-[calc(100%-0.75rem)] items-end text-right", stem: "mr-3" },
};

/** A pin on a place in the painting, with what it stands for; it appears as the walk comes near. */
function Place({
  place,
  tip,
}: {
  place: (typeof PLACES)[number];
  tip: MotionValue<number>;
}) {
  const from = Math.max(0.004, tipAt(place.x / 100) - 0.06);
  const opacity = useTransform(tip, (t) => clamp01((t - from) / 0.04));
  const y = useTransform(
    tip,
    (t) => (1 - clamp01((t - from) / 0.04)) * (place.below ? -8 : 8),
  );
  return (
    <motion.span
      style={{ left: `${place.x}%`, top: `${place.y}%`, opacity }}
      className="pointer-events-none absolute"
    >
      <span className="absolute -top-[5px] -left-[5px] h-2.5 w-2.5 rounded-full bg-white ring-[2.5px] ring-navy" />
      <motion.span
        style={{ y }}
        className={`absolute left-0 flex flex-col ${ALIGN[place.align ?? "center"].box} ${place.below ? "top-1.5" : "bottom-1.5 flex-col-reverse"}`}
      >
        <span className={`h-6 w-px bg-navy/70 ${ALIGN[place.align ?? "center"].stem}`} />
        <span className="rounded-lg bg-navy/90 px-2.5 py-1.5 whitespace-nowrap shadow-[var(--shadow-md)] backdrop-blur-sm">
          <span className="block text-[12px] font-semibold text-white sm:text-[13px]">
            {place.name}
          </span>
          <span className="block text-[11px] text-white/70 sm:text-[12px]">
            {place.note}
          </span>
        </span>
      </motion.span>
    </motion.span>
  );
}

function Stop({ i, tip }: { i: number; tip: MotionValue<number> }) {
  const a = ROUTE.along[i];
  const opacity = useTransform(tip, (t) => clamp01((t - a + 0.03) / 0.03));
  const scale = useTransform(
    tip,
    (t) => 0.5 + 0.5 * clamp01((t - a + 0.03) / 0.03),
  );
  const s = STOPS[i];
  const levelStart = i % PER_LEVEL === 0;
  return (
    <motion.span
      style={{ left: `${s.x}%`, top: `${s.y}%`, opacity, scale }}
      className="absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[16px] font-semibold text-fg shadow-[var(--shadow-md)] ring-[3px] ring-accent tabular-nums sm:h-14 sm:w-14 sm:text-lg"
    >
      {i + 1}
      {levelStart && (
        <span className="absolute -top-7 left-1/2 -translate-x-1/2 rounded-full bg-navy px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap text-white shadow-sm sm:text-[11px]">
          Level {i / PER_LEVEL + 1}
        </span>
      )}
    </motion.span>
  );
}

/** A topic, typed or picked, that starts a course. */
export function ReplyForm({
  id,
  light = false,
  center = false,
  onImage = false,
  suggestions = SUGGESTIONS,
}: {
  id: string;
  /** Topics offered under the box; each box on the page offers different ones. */
  suggestions?: string[];
  /** A white box (otherwise a translucent one for navy). */
  light?: boolean;
  center?: boolean;
  /** The text around the box sits on a dark picture. */
  onImage?: boolean;
}) {
  const darkText = light && !onImage;
  const { busy } = useAppState();
  const start = useStartCourse();
  const [topic, setTopic] = useState("");
  return (
    <div className={`mt-9 max-w-[34rem] ${center ? "mx-auto" : ""}`}>
      <form
        className={`flex items-center gap-2 rounded-2xl p-1.5 pl-5 ring-1 transition-shadow ${
          light
            ? "bg-white shadow-[var(--shadow-md)] ring-line-strong focus-within:ring-2 focus-within:ring-accent"
            : "bg-white/[0.07] ring-white/15 focus-within:ring-2 focus-within:ring-accent-on-dark"
        }`}
        onSubmit={(e) => {
          e.preventDefault();
          if (topic.trim()) start(topic);
          else document.getElementById(id)?.focus();
        }}
      >
        <label htmlFor={id} className="sr-only">
          What do you want to learn?
        </label>
        <input
          id={id}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="What do you want to learn?"
          autoComplete="off"
          maxLength={120}
          // The form's ring shows focus, so the input draws no outline of its own.
          className={`min-w-0 flex-1 bg-transparent text-[17px] input-bare outline-none py-3 ${
            light
              ? "text-fg placeholder:text-muted/70"
              : "text-white placeholder:text-white/40"
          }`}
        />
        <button
          type="submit"
          disabled={!!busy}
          className="btn-pill btn-pill-accent flex-shrink-0 rounded-xl px-5 py-3 text-[15px]"
        >
          <span>
            Start<span className="hidden sm:inline"> course</span>
          </span>
          <HoverArrow />
        </button>
      </form>
      <p
        className={`mt-3 text-[14px] ${darkText ? "text-muted" : "text-white/75"} ${center ? "text-center" : ""}`}
      >
        Try{" "}
        {suggestions.map((s, i) => (
          <span key={s}>
            <button
              type="button"
              onClick={() => setTopic(s)}
              className={`underline decoration-1 underline-offset-4 transition-colors ${
                darkText
                  ? "text-fg decoration-line-strong hover:decoration-fg"
                  : "text-white decoration-white/40 hover:decoration-white"
              }`}
            >
              {s}
            </button>
            {i < suggestions.length - 1 ? ", " : ". "}
          </span>
        ))}
        Free while in beta.
      </p>
    </div>
  );
}
