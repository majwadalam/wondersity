"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { useAppState } from "@/components/app/AppState";
import { StarButton, courseProgress } from "@/components/app/CourseCards";
import { CourseJourney } from "@/components/app/CourseJourney";
import { levelsOf } from "@/lib/courseHierarchy";

export default function CoursePage() {
  const { id } = useParams<{ id: string }>();
  const { courses, loaded, learn, busy, ensureCovers, painting } = useAppState();
  const course = courses.find((c) => String(c.id) === id);

  // Paint the course's world and lesson covers the first time it's opened.
  useEffect(() => {
    if (course) ensureCovers(course);
  }, [course, ensureCovers]);

  if (!course) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-24 text-center">
        {loaded ? (
          <>
            <p className="font-display text-2xl text-fg">We couldn&rsquo;t find that course.</p>
            <Link href="/courses" className="mt-4 inline-block font-medium text-accent hover:underline">
              Back to your courses
            </Link>
          </>
        ) : (
          <div className="skeleton mx-auto h-[420px] rounded-3xl" />
        )}
      </main>
    );
  }

  const { total, done, percent } = courseProgress(course);
  const minutes = course.modules.reduce((n, m) => n + (m.lesson?.data.estimatedMinutes ?? 8), 0);
  const levels = levelsOf(course);
  const hasLevels = !levels.every((l) => l.legacy);

  return (
    <main className="mx-auto max-w-[1080px] px-5 pt-8 pb-24">
      <Link href="/courses" className="text-sm text-muted hover:text-fg">
        ← Courses
      </Link>

      <header className="mt-5 flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-muted">
            {hasLevels ? `${levels.length} levels · ` : ""}
            {total} lessons · about {minutes} min
          </p>
          <h1 className="display-xl font-display mt-2 text-4xl text-fg sm:text-5xl">{course.title}</h1>
          <p className="mt-3 text-lg leading-relaxed text-muted">{course.description}</p>
        </div>
        <StarButton topic={course.topic} />
      </header>

      <div className="mt-4 flex items-center gap-3">
        <span className="h-1.5 max-w-xs flex-1 overflow-hidden rounded-full bg-line">
          <span className="course-bar block h-full rounded-full bg-accent" style={{ width: `${Math.max(percent, 2)}%` }} />
        </span>
        <span className="text-sm text-muted tabular-nums">
          {done} of {total} done
        </span>
      </div>

      <div className="mt-8">
        <CourseJourney
          course={course}
          onStart={() => learn(course.topic)}
          busy={!!busy}
          painting={painting.has(course.id)}
          writingSince={busy?.courseId === course.id ? busy.startedAt : null}
        />
      </div>
    </main>
  );
}
