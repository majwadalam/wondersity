"use client";

import { Check, Pause, Play, RotateCcw } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

// Small live versions of real lesson activities, for the landing page.
// Each one does what it says: drag, order, predict, reply.

/** Drag the rate and the curve answers. */
export function CurveDemo() {
  const [rate, setRate] = useState(0.12);
  const path = useMemo(() => {
    const pts: string[] = [];
    for (let x = 0; x <= 100; x += 2) {
      const y = 1 / (1 + Math.exp(-rate * (x - 50)));
      pts.push(`${x === 0 ? "M" : "L"} ${10 + x * 1.85} ${84 - y * 76}`);
    }
    return pts.join(" ");
  }, [rate]);
  return (
    <div>
      <svg
        viewBox="0 0 200 90"
        className="w-full"
        aria-label={`An S-shaped curve; growth rate ${rate.toFixed(2)}`}
      >
        <path d="M10 84 H195 M10 4 V84" className="graph-axis" />
        <path d="M10 46 H195" stroke="#e5edf5" strokeDasharray="3 4" />
        <path d={path} className="graph-curve" />
      </svg>
      <label className="mt-3 flex items-center gap-3 text-xs text-muted">
        Growth rate
        <input
          type="range"
          min={0.04}
          max={0.4}
          step={0.01}
          value={rate}
          onChange={(e) => setRate(Number(e.target.value))}
          className="sim-range flex-1"
        />
        <span className="w-8 font-mono text-fg tabular-nums">
          {rate.toFixed(2)}
        </span>
      </label>
    </div>
  );
}

const EVENTS = [
  { y: "27 BC", t: "Augustus rules" },
  { y: "AD 117", t: "Empire at its peak" },
  { y: "AD 285", t: "Split in two" },
  { y: "AD 476", t: "The West falls" },
];
const SHUFFLED = [2, 0, 3, 1];

/** Tap the events in order. */
export function OrderDemo() {
  const [placed, setPlaced] = useState(0);
  const [miss, setMiss] = useState<number | null>(null);
  const [hint, setHint] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const done = placed === EVENTS.length;

  useEffect(() => () => clearTimeout(timer.current ?? undefined), []);

  function tap(i: number) {
    if (i < placed || done) return;
    clearTimeout(timer.current ?? undefined);
    if (i === placed) {
      setPlaced(placed + 1);
      setMiss(null);
      setHint(null);
    } else {
      // The wrong pick nudges and clears itself; the hint stays until the next tap.
      setMiss(i);
      setHint(i);
      timer.current = setTimeout(
        () => setMiss((m) => (m === i ? null : m)),
        700,
      );
    }
  }

  return (
    <div>
      <ol className="relative grid grid-cols-4 text-center">
        <span
          className="absolute top-3 right-[12.5%] left-[12.5%] h-0.5 bg-line"
          aria-hidden
        />
        <span
          className="absolute top-3 left-[12.5%] h-0.5 bg-accent transition-all duration-500"
          style={{ width: `${Math.max(0, placed - 1) * 25}%` }}
          aria-hidden
        />
        {EVENTS.map((e, i) => {
          const on = i < placed;
          return (
            <li key={e.y} className="relative flex flex-col items-center px-1">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors duration-300 ${
                  on
                    ? "border-accent bg-accent text-white"
                    : "border-line-strong bg-white"
                }`}
              >
                {on && <Check size={13} strokeWidth={3} />}
              </span>
              <span className="mt-2 font-mono text-[11px] text-muted">
                {e.y}
              </span>
              <span className="mt-1 flex min-h-[2.5em] items-start justify-center text-xs leading-tight font-medium text-fg">
                {on ? (
                  <span className="step-sheet">{e.t}</span>
                ) : (
                  <>
                    <span
                      className="mt-1.5 h-1.5 w-8 rounded-full bg-line"
                      aria-hidden
                    />
                    <span className="sr-only">Not placed yet</span>
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      {/* The chips and the hint while playing, one panel once done. */}
      <div className="mt-5 flex flex-col">
        {done ? (
          <div className="step-sheet flex items-center justify-between gap-3 rounded-2xl bg-accent-soft px-4 py-4">
            <span className="text-sm font-medium text-fg">
              In order. Rome took 500 years to fall.
            </span>
            <button
              type="button"
              onClick={() => {
                setPlaced(0);
                setHint(null);
              }}
              className="flex flex-shrink-0 items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-strong"
            >
              <RotateCcw size={13} /> Again
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap content-start gap-2">
              {SHUFFLED.filter((i) => i >= placed).map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => tap(i)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors ${
                    miss === i
                      ? "nudge bg-bad/10 text-bad ring-bad/30"
                      : "bg-white text-fg ring-line hover:ring-accent/40"
                  }`}
                >
                  {EVENTS[i].t}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted" aria-live="polite">
              {hint !== null
                ? `Not yet: something came before “${EVENTS[hint].t}”.`
                : placed === 0
                  ? "Tap the events in the order they happened."
                  : "Good. What came next?"}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/** Predict the output, then see why. */
export function CodeDemo() {
  const [pick, setPick] = useState<string | null>(null);
  const right = pick === "3";
  return (
    <div>
      <pre className="rounded-xl bg-navy p-4 font-mono text-[13px] leading-relaxed text-white/85">
        total = <span className="text-[#ffba27]">0</span>
        {"\n"}
        <span className="text-[#a9a4ff]">for</span> i{" "}
        <span className="text-[#a9a4ff]">in</span> range(
        <span className="text-[#ffba27]">3</span>):{"\n"}
        {"    "}total += i{"\n"}
        print(total)
      </pre>
      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs text-muted">It prints</span>
        {["3", "6", "0"].map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => setPick(o)}
            className={`h-8 w-10 rounded-lg font-mono text-sm ring-1 transition-colors ${
              pick === o
                ? right
                  ? "bg-good text-white ring-good"
                  : "bg-[#fdeeee] text-[#9b1c20] ring-bad/30"
                : "bg-white text-fg ring-line hover:ring-accent/40"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
      <p className="mt-2 min-h-4 text-xs text-muted" aria-live="polite">
        {pick === null
          ? "Pick what you think it prints."
          : right
            ? "Yes: range(3) is 0, 1, 2, and 0 + 1 + 2 = 3."
            : "Not quite. Which numbers does range(3) give you?"}
      </p>
    </div>
  );
}

const REPLIES = [
  {
    me: "No. Pleasure without real life isn't enough.",
    them: "Then something besides pleasure is good in itself. What is it?",
  },
  {
    me: "Yes, if it truly felt real.",
    them: "Even if everyone you love were only an illusion? Think carefully.",
  },
];

const ME =
  "w-fit max-w-[85%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-sm leading-snug text-white";
const THEM =
  "w-fit max-w-[85%] rounded-2xl rounded-bl-md bg-white px-4 py-2.5 text-sm leading-snug text-fg ring-1 ring-line";

/** Reply to the tutor and see it push back. */
export function DebateDemo() {
  const [reply, setReply] = useState<number | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <div className={`${ME} self-end`}>
        Pleasure is the only thing that&rsquo;s good in itself.
      </div>
      <div className={THEM}>
        Then would you plug into a machine that gave you endless pleasure,
        forever?
      </div>
      {reply === null ? (
        <div className="flex flex-col items-end gap-2 pt-1">
          <span className="font-mono text-[10px] tracking-[0.14em] text-muted uppercase">
            Your reply
          </span>
          <div className="flex flex-wrap justify-end gap-2">
            {REPLIES.map((r, i) => (
              <button
                key={r.me}
                type="button"
                onClick={() => setReply(i)}
                className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-accent ring-1 ring-accent/30 transition-colors hover:bg-accent-soft"
              >
                {r.me}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className={`${ME} step-sheet self-end`}>{REPLIES[reply].me}</div>
          <div
            className={`${THEM} step-sheet`}
            style={{ animationDelay: "180ms" }}
          >
            <span className="mb-0.5 block text-[11px] font-semibold text-accent">
              Socrates
            </span>
            {REPLIES[reply].them}
          </div>
          <button
            type="button"
            onClick={() => setReply(reply === 0 ? 1 : 0)}
            className="mt-1 flex items-center gap-1.5 self-start text-xs font-medium text-muted transition-colors hover:text-accent"
          >
            <RotateCcw size={13} /> Answer the other way
          </button>
        </>
      )}
    </div>
  );
}

/** Press play and hear the guide: a real recording made by the same voice the lessons use. */
export function VoiceDemo() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => () => audio.current?.pause(), []);

  function toggle() {
    if (!audio.current) {
      const a = new Audio("/audio/socrates-crito.m4a");
      a.ontimeupdate = () =>
        setProgress(a.duration ? a.currentTime / a.duration : 0);
      a.onended = () => {
        setPlaying(false);
        setProgress(0);
      };
      audio.current = a;
    }
    const a = audio.current;
    if (a.paused) {
      a.play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    } else {
      a.pause();
      setPlaying(false);
    }
  }

  const bars = [
    5, 9, 14, 8, 17, 11, 6, 13, 19, 10, 7, 15, 12, 6, 16, 9, 13, 7, 11, 5, 14,
    8, 10, 6,
  ];
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-canvas p-4 ring-1 ring-line">
      <span className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full ring-2 ring-white">
        <Image
          unoptimized
          src="/art/scenes/guide-socrates.webp"
          alt=""
          fill
          sizes="48px"
          className="scale-[1.6] object-cover object-[50%_30%]"
        />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-fg">Socrates</p>
        <div className="mt-1.5 flex h-6 items-center gap-[3px]" aria-hidden>
          {bars.map((h, i) => (
            <span
              key={i}
              className={`w-[3px] rounded-full transition-colors ${i / bars.length < progress ? "bg-accent" : "bg-line-strong"} ${playing ? "animate-pulse" : ""}`}
              style={{ height: h, animationDelay: `${(i % 6) * 90}ms` }}
            />
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause Socrates" : "Hear Socrates"}
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-navy text-white transition-transform hover:scale-105"
      >
        {playing ? (
          <Pause size={16} fill="currentColor" />
        ) : (
          <Play size={16} fill="currentColor" className="ml-0.5" />
        )}
      </button>
    </div>
  );
}
