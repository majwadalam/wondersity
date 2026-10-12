"use client";

import Image from "next/image";
import { isRemote } from "@/lib/remoteImage";
import Link from "next/link";
import type { Course } from "../types";
import { useAppState, useStartCourse } from "./AppState";
import { CourseArt } from "./CourseArt";

/** Topics to explore before the learner has a course on them. */
export const CATALOG = [
  { topic: "Stoicism", blurb: "Calm, clear thinking in a chaotic world." },
  { topic: "Black holes", blurb: "Where gravity bends light and time." },
  { topic: "Game theory", blurb: "Strategy, incentives and smart choices." },
  { topic: "Photosynthesis", blurb: "How plants turn sunlight into life." },
  { topic: "Jazz harmony", blurb: "Why some chords sound like longing." },
  { topic: "Machine learning", blurb: "How computers learn from examples." },
  { topic: "The French Revolution", blurb: "Bread, ideas and a falling crown." },
  { topic: "The fall of Rome", blurb: "How the greatest empire came apart." },
  { topic: "Supply and demand", blurb: "The invisible tug-of-war behind prices." },
];

/** ★ toggle that saves a course (or topic) to the Library. */
export function StarButton({ topic, className = "" }: { topic: string; className?: string }) {
  const { isBookmarked, toggleBookmark } = useAppState();
  const on = isBookmarked(topic);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? `Remove ${topic} from your library` : `Save ${topic} to your library`}
      title={on ? "Saved to Library" : "Save to Library"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleBookmark(topic);
      }}
      className={`star-btn flex h-9 w-9 items-center justify-center rounded-full border ${
        on ? "border-accent bg-accent text-white" : "border-line bg-surface/90 text-muted shadow-sm hover:border-line-strong hover:text-fg"
      } ${className}`}
      data-on={on || undefined}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
        <path
          d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"
          fill={on ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

export function courseProgress(course: Course) {
  const total = course.modules.length;
  // Lessons before the current one are finished, even if a newer unfinished copy was saved.
  const done =
    course.status === "completed"
      ? total
      : course.modules.filter((m, i) => m.lesson?.completed || i < course.currentModule).length;
  return { total, done, percent: total ? Math.round((done / total) * 100) : 0 };
}

/** A course the learner has: art, title, progress, star. Links to its welcome page. */
export function CourseTile({ course }: { course: Course }) {
  const { total, done, percent } = courseProgress(course);
  const finished = course.status === "completed";

  // The star is a sibling of the link (a button can't live inside a link).
  return (
    <div className="relative h-full">
      <Link
        href={`/courses/${course.id}`}
        className="course-tile group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface"
      >
        <div className="art-zoom relative aspect-[16/10] overflow-hidden bg-canvas">
          {course.cover ? (
            <Image unoptimized={isRemote(course.cover)} src={course.cover} alt="" fill sizes="(min-width: 1024px) 33vw, 100vw" className="object-cover" />
          ) : (
            <CourseArt topic={course.topic} />
          )}
          <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-fg shadow-sm backdrop-blur">
            {finished ? "Completed ✓" : done ? "In progress" : "Just started"}
          </span>
        </div>
        <div className="flex flex-1 flex-col p-5">
          <p className="text-xs font-medium text-muted">{course.topic}</p>
          <h3 className="font-display mt-1 text-lg leading-snug text-fg">{course.title}</h3>
          <p className="mt-2 line-clamp-2 text-sm text-muted">{course.description}</p>
          <div className="mt-auto pt-5">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>
                {done} of {total} lessons
              </span>
              <span className="font-semibold text-fg tabular-nums">{percent}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-canvas ring-1 ring-line ring-inset">
              <div className="course-bar h-full rounded-full bg-accent" style={{ width: `${Math.max(percent, 3)}%` }} />
            </div>
          </div>
        </div>
      </Link>
      <StarButton topic={course.topic} className="absolute top-3 right-3 z-10" />
    </div>
  );
}

/** A topic to explore. Opens the learner's course if they have one, else starts it. */
export function CatalogTile({ topic, blurb }: { topic: string; blurb: string }) {
  const { courseFor, busy } = useAppState();
  const start = useStartCourse();
  const course = courseFor(topic);
  const body = (
    <>
      <div className="art-zoom relative aspect-[4/3] w-full flex-shrink-0 overflow-hidden rounded-2xl bg-canvas">
        <CourseArt topic={topic} sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw" />
      </div>
      <div className="flex flex-1 flex-col px-1 pt-3.5 text-left">
        <h3 className="font-display text-base text-fg">{topic}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted">{blurb}</p>
        <p className="mt-auto pt-2 text-sm font-semibold text-accent opacity-80 transition-opacity group-hover:opacity-100">
          {course ? "Open course →" : "Start course →"}
        </p>
      </div>
    </>
  );
  const className =
    "catalog-tile group flex h-full flex-col justify-start text-left disabled:cursor-wait";
  return (
    <div className="relative h-full">
      {course ? (
        <Link href={`/courses/${course.id}`} className={className}>
          {body}
        </Link>
      ) : (
        <button
          type="button"
          disabled={!!busy}
          onClick={() => start(topic)}
          className={`${className} w-full`}
        >
          {body}
        </button>
      )}
      <StarButton topic={topic} className="absolute top-3 right-3 z-10" />
    </div>
  );
}
