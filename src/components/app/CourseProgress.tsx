"use client";

import { Play } from "lucide-react";
import Link from "next/link";
import { levelsOf } from "@/lib/courseHierarchy";
import { HoverArrow } from "../landing/HoverArrow";
import type { Course } from "../types";
import { StarButton, courseProgress } from "./CourseCards";
import { LEVEL_TINTS, stateOf } from "./CourseJourney";

/**
 * Where the learner is in a course, at a glance: how much is done, each
 * level as a row of its lessons (done, up next, locked) in the level's colour,
 * and the one thing to do next. Everything shown comes from saved progress.
 */
export function CourseProgress({ course, onStart, busy, writing }: { course: Course; onStart: () => void; busy: boolean; writing: boolean }) {
  const { total, done, percent } = courseProgress(course);
  const levels = levelsOf(course);
  const hasLevels = !levels.every((l) => l.legacy);
  const rows = hasLevels ? levels.map((l, li) => ({ key: l.id, label: `Level ${li + 1}`, title: l.title, modules: l.modules, tint: LEVEL_TINTS[li % LEVEL_TINTS.length][0] })) : [{ key: "all", label: "Lessons", title: "", modules: course.modules.map((_, i) => i), tint: "var(--accent)" }];
  const finished = course.status === "completed" || done === total;
  const current = Math.min(course.currentModule, total - 1);
  const next = course.modules[current];
  const r = 26;
  const c = 2 * Math.PI * r;

  return (
    <aside className="shadow-card w-full rounded-3xl bg-white p-4 sm:p-5" aria-label="Your progress">
      <div className="flex items-start gap-4">
        <div className="relative h-16 w-16 flex-shrink-0">
          <svg viewBox="0 0 64 64" className="h-16 w-16" aria-hidden>
            <circle cx="32" cy="32" r={r} fill="none" stroke="var(--line)" strokeWidth="6" />
            {percent > 0 && <circle cx="32" cy="32" r={r} fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(c * percent) / 100} ${c}`} transform="rotate(-90 32 32)" className="course-bar" />}
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-fg tabular-nums">{percent}%</span>
        </div>
        <div className="min-w-0 pt-1.5">
          <p className="text-2xl leading-none font-semibold text-fg tabular-nums">
            {done}
            <span className="text-base font-medium text-muted"> / {total}</span>
          </p>
          <p className="mt-1.5 text-sm text-muted">{finished ? "Course complete" : "lessons done"}</p>
        </div>
        <StarButton topic={course.topic} className="ml-auto" />
      </div>

      <ul className="mt-4 space-y-2">
        {rows.map((row) => {
          const rowDone = row.modules.filter((i) => stateOf(course, i) === "done").length;
          return (
            <li key={row.key} className="flex items-center gap-3" title={row.title ? `${row.label} · ${row.title}` : undefined}>
              <span className="w-14 flex-shrink-0 text-xs font-semibold text-fg">{row.label}</span>
              <span className="flex flex-1 gap-1" aria-hidden>
                {row.modules.map((i) => {
                  const s = stateOf(course, i);
                  return (
                    <span
                      key={i}
                      className={`h-2 flex-1 rounded-full ${s === "current" ? "animate-pulse" : ""}`}
                      style={{ background: s === "locked" ? "var(--line)" : row.tint, opacity: s === "current" ? 0.45 : 1 }}
                    />
                  );
                })}
              </span>
              <span className="w-8 flex-shrink-0 text-right text-xs text-muted tabular-nums">
                {rowDone}/{row.modules.length}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-4">
        {finished ? (
          <Link href={`/courses/${course.id}/1`} className="btn-pill btn-pill-accent w-full justify-center">
            Review the course <HoverArrow />
          </Link>
        ) : next?.lesson ? (
          <Link href={`/courses/${course.id}/${current + 1}`} className="btn-pill btn-pill-accent w-full justify-center" title={next.title}>
            <span className="truncate">
              {done === 0 && current === 0 ? "Start" : "Continue"} lesson {current + 1}
            </span>
            <HoverArrow />
          </Link>
        ) : writing ? (
          <span className="flex w-full items-center justify-center rounded-full bg-canvas px-4 py-2.5 text-sm text-muted">Writing lesson {current + 1}…</span>
        ) : (
          <button type="button" disabled={busy} onClick={onStart} className="btn-pill btn-pill-accent w-full justify-center">
            <Play size={14} fill="currentColor" /> Start lesson {current + 1}
          </button>
        )}
        {!finished && next && <p className="mt-2 truncate text-center text-xs text-muted">{next.title}</p>}
      </div>
    </aside>
  );
}
