"use client";

import { Check, Lock, Play, Sparkles } from "lucide-react";
import Image from "next/image";
import { isRemote } from "@/lib/remoteImage";
import Link from "next/link";
import { useEffect, useState } from "react";
import { levelsOf, lessonLabel } from "@/lib/courseHierarchy";
import { HoverArrow } from "../landing/HoverArrow";
import type { Course } from "../types";

// Each level gets its own tint, so a lesson without its painting yet still
// looks like it belongs to its stretch of the course.
const LEVEL_TINTS = [
  ["#7a5cff", "#3aa0e8"],
  ["#3aa0e8", "#15be53"],
  ["#f2711c", "#e5484d"],
  ["#635bff", "#0a2540"],
];

/** A lesson's picture: its first painted scene, or a tinted card with its number. */
type Art = { src: string | null; level: number; number: number; locked: boolean; sizes: string; big?: boolean };

/**
 * A lesson's picture: its own first scene once staged. Until then, the part of
 * the course's painted world where its stop sits on the map, with its number.
 */
function LessonArt({ src, world, at, level, number, locked, sizes, big = false }: Art & { world: string | null; at: { x: number; y: number } }) {
  const dim = locked ? "opacity-70 grayscale-[60%]" : "";
  if (src) return <Image unoptimized={isRemote(src)} src={src} alt="" fill sizes={sizes} className={`object-cover ${dim}`} />;
  if (world) {
    // Stay above the bottom edge, which often carries painted titles.
    const x = at.x;
    const y = Math.min(at.y, 55);
    return (
      <>
        <Image
          unoptimized={isRemote(world)}
          src={world}
          alt=""
          fill
          sizes={sizes}
          className={`scale-[1.8] object-cover ${dim}`}
          style={{ objectPosition: `${x}% ${y}%`, transformOrigin: `${x}% ${y}%` }}
        />
        <span className="absolute inset-0 flex items-end bg-gradient-to-t from-black/45 via-transparent to-transparent p-4">
          <span className={`font-semibold tracking-[-0.04em] text-white tabular-nums drop-shadow ${big ? "text-7xl" : "text-5xl"}`}>
            {String(number).padStart(2, "0")}
          </span>
        </span>
      </>
    );
  }
  const [a, b] = LEVEL_TINTS[Math.max(0, level) % LEVEL_TINTS.length];
  return (
    <span className={`absolute inset-0 flex items-end p-4 ${locked ? "opacity-60 saturate-50" : ""}`} style={{ background: `radial-gradient(120% 90% at 100% 0%, ${b}cc, transparent 60%), linear-gradient(140deg, ${a}, #0a2540)` }}>
      <span className={`font-semibold tracking-[-0.04em] text-white/90 tabular-nums ${big ? "text-7xl" : "text-5xl"}`}>{String(number).padStart(2, "0")}</span>
    </span>
  );
}

// The course as a journey: lessons are stops on a road across the course's
// painted world, grouped into levels. Every state comes from saved progress:
// done = lesson completed, current = the course's current module, else locked.

type State = "done" | "current" | "locked";

// The course only moves past a lesson once it's finished, so anything before
// the current lesson is done even if a newer, unfinished copy of it was saved.
const stateOf = (course: Course, i: number): State =>
  course.modules[i].lesson?.completed || course.status === "completed" || i < course.currentModule
    ? "done"
    : i === course.currentModule
      ? "current"
      : "locked";

/** Where stop i of n sits on the map, in % of its width and height. */
function journeyStop(i: number, n: number) {
  const t = n === 1 ? 0.5 : i / (n - 1);
  // Rounded, so the server and the browser draw the same road.
  const r = (v: number) => Math.round(v * 100) / 100;
  return { x: r(7 + t * 86), y: r(54 + Math.sin(t * Math.PI * 2.2 + 0.4) * 20) };
}

export function CourseJourney({
  course,
  onStart,
  busy,
  painting,
  writingSince = null,
}: {
  course: Course;
  onStart: () => void;
  busy: boolean;
  painting: boolean;
  /** When the current lesson started being written, if it's being written now. */
  writingSince?: number | null;
}) {
  const levels = levelsOf(course);
  const hasLevels = !levels.every((l) => l.legacy);
  const n = course.modules.length;
  const current = Math.min(course.currentModule, n - 1);
  const [selected, setSelected] = useState(course.status === "completed" ? 0 : current);
  const points = course.modules.map((_, i) => journeyStop(i, n));
  const road = points.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");
  const doneUpTo = course.modules.reduce((last, _, i) => (stateOf(course, i) === "done" ? i : last), -1);
  const walked = points.slice(0, Math.min(doneUpTo + 2, n)).map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");
  const label = (i: number) => lessonLabel(levels, i);

  return (
    <div>
      {/* The world */}
      <div className="-mx-5 overflow-x-auto px-5 pb-2 sm:mx-0 sm:px-0">
        <div className="shadow-card relative aspect-[21/9] min-w-[720px] overflow-hidden rounded-3xl bg-[#e9eefc]">
          {course.cover ? (
            <Image unoptimized={isRemote(course.cover)} src={course.cover} alt={`An illustrated map of ${course.topic}`} fill sizes="(min-width: 1100px) 1080px, 100vw" className="object-cover" priority />
          ) : (
            <div className="world-placeholder absolute inset-0">
              {painting && (
                // Bottom corner: level labels run along the top.
                <span className="absolute right-4 bottom-4 z-10 flex items-center gap-2 rounded-full bg-white/85 px-3.5 py-1.5 text-xs font-medium text-fg shadow-sm backdrop-blur">
                  <Sparkles size={14} className="animate-pulse text-accent" /> Painting the world of this course…
                </span>
              )}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/25" aria-hidden />

          {/* The road, and the part already walked */}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
            <path d={road} fill="none" stroke="white" strokeOpacity="0.85" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            <path d={road} fill="none" stroke="#0a2540" strokeOpacity="0.25" strokeWidth="2" strokeDasharray="2 7" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            {doneUpTo >= 0 && <path d={walked} fill="none" stroke="#635bff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
          </svg>

          {/* Level names over their stretch of the road */}
          {hasLevels &&
            levels.map((l, li) => {
              // Centred over the level's stretch of road.
              const first = points[l.modules[0]];
              const last = points[l.modules[l.modules.length - 1]];
              const mid = { x: (first.x + last.x) / 2 };
              // As wide as the level's stretch of road (a little more for short ones), so labels never overlap.
              const width = Math.max(last.x - first.x + 100 / n, 12) - 2;
              return (
                <span
                  key={l.id}
                  className="absolute top-4 -translate-x-1/2 truncate rounded-full bg-white/90 px-3 py-1 text-center text-[11px] font-semibold whitespace-nowrap text-fg shadow-sm backdrop-blur"
                  style={{ left: `${mid.x}%`, maxWidth: `${width}%` }}
                  title={`Level ${li + 1} · ${l.title}`}
                >
                  Level {li + 1} · {l.title}
                </span>
              );
            })}

          {/* Stops */}
          {course.modules.map((m, i) => {
            const s = stateOf(course, i);
            const p = points[i];
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelected(i)}
                aria-label={`${label(i)}: ${m.title} (${s === "done" ? "done" : s === "current" ? "up next" : "locked"})`}
                aria-pressed={selected === i}
                title={m.title}
                className="group absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
              >
                {s === "current" && <span className="absolute -inset-2 animate-ping rounded-full bg-white/50" aria-hidden />}
                <span
                  className={`relative block h-14 w-14 overflow-hidden rounded-full bg-white shadow-[var(--shadow-md)] transition-transform group-hover:scale-110 ${
                    selected === i ? "ring-4 ring-white" : s === "current" ? "ring-[3px] ring-accent" : s === "done" ? "ring-[3px] ring-white" : "ring-2 ring-white/70"
                  }`}
                >
                  {m.cover ? (
                    <Image unoptimized={isRemote(m.cover)} src={m.cover} alt="" fill sizes="56px" className={`object-cover ${s === "locked" ? "opacity-90 saturate-[.35]" : ""}`} />
                  ) : (
                    <span className={`flex h-full w-full items-center justify-center text-lg font-semibold tabular-nums ${s === "locked" ? "text-muted" : "text-fg"}`}>{i + 1}</span>
                  )}
                </span>
                <span
                  className={`absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ring-2 ring-white ${
                    s === "done" ? "bg-good text-white" : s === "current" ? "bg-accent text-white" : "bg-fg/70 text-white"
                  }`}
                >
                  {s === "done" ? <Check size={11} strokeWidth={3} /> : s === "locked" ? <Lock size={9} strokeWidth={2.5} /> : i + 1}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <Spotlight
        course={course}
        index={selected}
        state={stateOf(course, selected)}
        label={label(selected)}
        level={levels.findIndex((l) => l.modules.includes(selected))}
        onStart={onStart}
        busy={busy}
        writingSince={writingSince}
      />

      {/* Chapters */}
      <div className="mt-14 space-y-12">
        {levels.map((l, li) => {
          const done = l.modules.filter((i) => stateOf(course, i) === "done").length;
          return (
            <section key={l.id} aria-labelledby={`level-${l.id}`}>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="max-w-2xl">
                  {hasLevels && <p className="text-sm font-semibold text-accent">Level {li + 1}</p>}
                  <h3 id={`level-${l.id}`} className="font-display mt-1 text-2xl text-fg">
                    {hasLevels ? l.title : "Lessons"}
                  </h3>
                  {l.objective && <p className="mt-1.5 text-[15px] text-muted">{l.objective}</p>}
                </div>
                <span className="flex items-center gap-2 text-sm text-muted tabular-nums">
                  <Ring value={done / l.modules.length} /> {done}/{l.modules.length}
                </span>
              </div>
              <div
                className={`-mx-5 mt-5 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:overflow-visible sm:px-0 sm:pb-0 ${
                  l.modules.length === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3"
                }`}
              >
                {l.modules.map((i) => {
                  const m = course.modules[i];
                  const s = stateOf(course, i);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setSelected(i);
                        document.getElementById("spotlight")?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }}
                      className={`group flex w-[68%] flex-shrink-0 snap-start flex-col justify-start overflow-hidden rounded-2xl bg-white text-left ring-1 transition-shadow hover:shadow-[var(--shadow-md)] sm:w-auto ${
                        selected === i ? "ring-2 ring-accent" : "ring-line"
                      }`}
                    >
                      <span className="art-zoom relative block aspect-[4/3] w-full flex-shrink-0 overflow-hidden bg-canvas">
                        <LessonArt src={m.cover} world={course.cover} at={journeyStop(i, course.modules.length)} level={li} number={i + 1} locked={s === "locked"} sizes="(min-width: 1024px) 260px, 50vw" />
                        <StateChip state={s} />
                      </span>
                      <span className="block p-3.5">
                        <span className="block text-xs text-muted">Lesson {i + 1}</span>
                        <span className="mt-0.5 line-clamp-2 block text-[15px] leading-snug font-semibold text-fg">{m.title}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

/** The selected stop, large: cover, objective, and the one action it allows. */
function Spotlight({
  course,
  index,
  state,
  label,
  level,
  onStart,
  busy,
  writingSince,
}: {
  course: Course;
  index: number;
  state: State;
  label: string;
  level: number;
  onStart: () => void;
  busy: boolean;
  writingSince: number | null;
}) {
  const m = course.modules[index];
  const href = m.lesson ? `/courses/${course.id}/${index + 1}` : null;
  const prev = index > 0 ? course.modules[index - 1].title : null;
  return (
    <div id="spotlight" className="shadow-card mt-6 grid overflow-hidden rounded-3xl bg-white sm:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="relative aspect-[4/3] overflow-hidden bg-canvas sm:aspect-auto sm:min-h-[260px]">
        <LessonArt src={m.cover} world={course.cover} at={journeyStop(index, course.modules.length)} level={level} number={index + 1} locked={false} sizes="(min-width: 640px) 450px, 100vw" big />
      </div>
      <div className="flex flex-col p-6 sm:p-8">
        <p className="text-sm font-medium text-muted">
          {label}
          {m.lesson?.data.estimatedMinutes ? ` · ${m.lesson.data.estimatedMinutes} min` : ""}
        </p>
        <h3 className="font-display mt-1 text-2xl leading-tight text-fg sm:text-[28px]">{m.title}</h3>
        <p className="mt-4 text-[15px] leading-relaxed text-fg">
          <span className="font-semibold text-accent">You&rsquo;ll be able to</span> {m.goal.charAt(0).toLowerCase() + m.goal.slice(1)}
        </p>
        {m.description && <p className="mt-2 text-[15px] leading-relaxed text-muted">{m.description}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-4 pt-6">
          {state === "locked" ? (
            <span className="flex items-center gap-2 text-sm text-muted">
              <Lock size={15} /> {prev ? `Unlocks after “${prev}”` : "Locked"}
            </span>
          ) : writingSince !== null && state === "current" && !m.lesson ? (
            <Writing since={writingSince} />
          ) : href ? (
            <Link href={href} className="btn-pill btn-pill-dark">
              {state === "done" ? "Review lesson" : "Continue lesson"} <HoverArrow />
            </Link>
          ) : (
            <button type="button" disabled={busy} onClick={onStart} className="btn-pill btn-pill-accent">
              <Play size={14} fill="currentColor" /> Start lesson
            </button>
          )}
          {m.lesson?.quiz && (
            <span className="text-sm text-muted">
              Checks {m.lesson.quiz.correct}/{m.lesson.quiz.total} right first time
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function StateChip({ state }: { state: State }) {
  if (state === "done")
    return (
      <span className="absolute top-2.5 left-2.5 flex items-center gap-1 rounded-full bg-good px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm">
        <Check size={11} strokeWidth={3} /> Done
      </span>
    );
  if (state === "current")
    return <span className="absolute top-2.5 left-2.5 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm">Up next</span>;
  return (
    <span className="absolute top-2.5 left-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-muted shadow-sm">
      <Lock size={12} />
    </span>
  );
}

function Ring({ value }: { value: number }) {
  const c = 2 * Math.PI * 8;
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
      <circle cx="10" cy="10" r="8" fill="none" stroke="var(--line)" strokeWidth="3" />
      <circle cx="10" cy="10" r="8" fill="none" stroke="var(--accent)" strokeWidth="3" strokeDasharray={`${c * value} ${c}`} strokeLinecap="round" transform="rotate(-90 10 10)" />
    </svg>
  );
}

/** The current lesson is being written: honest about how long it's taken. */
function Writing({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const secs = Math.max(0, Math.floor((now - since) / 1000));
  return (
    <span className="flex items-center gap-3 rounded-full bg-accent-soft py-2 pr-4 pl-2 text-sm text-accent-strong">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-accent/25 border-t-accent" aria-hidden />
      <span>
        <span className="font-semibold">Writing this lesson</span>
        <span className="text-accent-strong/70 tabular-nums">
          {" "}
          · {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")} · usually about a minute
        </span>
      </span>
    </span>
  );
}
