"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { useAppState } from "@/components/app/AppState";
import { courseProgress } from "@/components/app/CourseCards";
import { CourseProgress } from "@/components/app/CourseProgress";
import { CourseJourney } from "@/components/app/CourseJourney";
import { CourseActions, CourseVoices } from "@/components/app/CourseOptions";
import { BackLink } from "@/components/app/BackLink";
import { CoursePageSkeleton } from "@/components/Skeletons";
import { levelsOf } from "@/lib/courseHierarchy";
import type { Course } from "@/components/types";

export default function CoursePage() {
  const { id } = useParams<{ id: string }>();
  const { courses, loaded, learn, busy, ensureCovers, painting } = useAppState();
  const course = courses.find((c) => String(c.id) === id);

  // Paint the course's world and lesson covers the first time it's opened.
  useEffect(() => {
    if (course) ensureCovers(course);
  }, [course, ensureCovers]);

  if (!course && !loaded) return <main><CoursePageSkeleton /></main>;
  if (!course) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-24 text-center">
        <p className="font-display text-2xl text-fg">We couldn&rsquo;t find that course.</p>
        <Link href="/courses" className="mt-4 inline-block font-medium text-accent hover:underline">
          Back to your courses
        </Link>
      </main>
    );
  }

  const { total } = courseProgress(course);
  const minutes = course.modules.reduce((n, m) => n + (m.lesson?.data.estimatedMinutes ?? 8), 0);
  const levels = levelsOf(course);
  const hasLevels = !levels.every((l) => l.legacy);

  return (
    <main className="mx-auto max-w-[1080px] px-5 pt-8 pb-24">
      <BackLink href="/courses">Courses</BackLink>
      {course.archived && (
        <p className="mt-4 rounded-xl bg-canvas px-4 py-2.5 text-sm text-muted ring-1 ring-line">This course is archived. You can still take it; unarchive it below to list it again.</p>
      )}

      <header className="mt-5 grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-muted">
            {hasLevels ? `${levels.length} levels · ` : ""}
            {total} lessons · about {minutes} min
          </p>
          <h1 className="display-xl font-display mt-2 text-4xl text-fg sm:text-5xl">{course.title}</h1>
          <p className="mt-3 text-lg leading-relaxed text-muted">{course.description}</p>
        </div>
        <CourseProgress course={course} onStart={() => learn(course.topic)} busy={!!busy} writing={busy?.courseId === course.id} />
      </header>

      {course.tailored && <TailoredFor tailored={course.tailored} />}

      <div className="mt-8">
        <CourseJourney
          course={course}
          onStart={() => learn(course.topic)}
          busy={!!busy}
          painting={painting.has(course.id)}
          writingSince={busy?.courseId === course.id ? busy.startedAt : null}
        />
      </div>

      <div className="mt-8 grid items-start gap-5 lg:grid-cols-2">
        {course.cast.length > 0 && <CourseVoices course={course} />}
        <CourseActions course={course} />
      </div>
    </main>
  );
}

/** What a tailored course was planned from: the learner's goal, the outcomes it builds to, their materials. */
function TailoredFor({ tailored }: { tailored: NonNullable<Course["tailored"]> }) {
  return (
    <section className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-line" aria-label="Your goal">
      <p className="text-sm font-semibold text-fg">Built for your goal</p>
      <p className="mt-1 text-[15px] leading-relaxed text-muted">&ldquo;{tailored.goal}&rdquo;</p>
      {tailored.outcomes.length > 0 && (
        <>
          <p className="mt-4 text-sm font-semibold text-fg">By the end you&rsquo;ll be able to</p>
          <ul className="mt-1.5 space-y-1 text-[15px] text-fg">
            {tailored.outcomes.map((o) => (
              <li key={o} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" aria-hidden />
                {o}
              </li>
            ))}
          </ul>
        </>
      )}
      {tailored.materials.length > 0 && <p className="mt-4 text-xs text-muted">Using your materials: {tailored.materials.join(", ")}</p>}
    </section>
  );
}
