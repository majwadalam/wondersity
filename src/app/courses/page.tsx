"use client";

import Image from "next/image";
import Link from "next/link";
import { useAppState } from "@/components/app/AppState";
import { courseArtSrc } from "@/components/app/CourseArt";
import { HoverArrow } from "@/components/landing/HoverArrow";
import type { Course } from "@/components/types";
import { isRemote } from "@/lib/remoteImage";
import { CATALOG, CatalogTile, CourseTile, courseProgress } from "@/components/app/CourseCards";
import { Reveal } from "@/components/Reveal";

export default function CoursesPage() {
  const { courses, loaded } = useAppState();
  const started = new Set(courses.map((c) => c.topic.trim().toLowerCase()));
  const explore = CATALOG.filter((c) => !started.has(c.topic.toLowerCase()));
  const modulesDone = courses.reduce((n, c) => n + courseProgress(c).done, 0);
  const current = courses.find((c) => c.status === "active");

  return (
    <main className="mx-auto max-w-[1080px] px-5 pt-12 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display-xl font-display text-4xl text-fg sm:text-5xl">Courses</h1>
          <p className="mt-3 text-lg text-muted">
            {courses.length} course{courses.length === 1 ? "" : "s"} · {modulesDone} lesson{modulesDone === 1 ? "" : "s"} finished
          </p>
        </div>
        <Link href="/home?new=1" className="btn-pill btn-pill-dark">
          New course <HoverArrow />
        </Link>
      </div>

      {current && <Featured course={current} />}

      {/* With a single course the banner above already shows it. */}
      {(!loaded || courses.length !== 1) && (
      <section className="mt-12" aria-labelledby="yours">
        <h2 id="yours" className="text-sm font-semibold text-fg">
          Your courses
        </h2>
        {!loaded ? (
          <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-64 rounded-2xl" />
            ))}
          </div>
        ) : courses.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-line-strong bg-surface p-8 text-center text-muted">
            No courses yet. Start one below, or name any topic on the{" "}
            <Link href="/home?new=1" className="font-medium text-accent hover:underline">
              Home
            </Link>{" "}
            page.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {courses.map((c, i) => (
              <Reveal key={c.id} group="courses" delay={i * 60} stagger={60}>
                <CourseTile course={c} />
              </Reveal>
            ))}
          </div>
        )}
      </section>
      )}

      {explore.length > 0 && (
        <section className="mt-14" aria-labelledby="explore">
          <h2 id="explore" className="text-sm font-semibold text-fg">
            Explore something new
          </h2>
          <p className="mt-1 text-sm text-muted">Choosing one plans your course and opens it.</p>
          <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {explore.map((c, i) => (
              <Reveal key={c.topic} group="explore" delay={i * 50} stagger={50} className="h-full">
                <CatalogTile topic={c.topic} blurb={c.blurb} />
              </Reveal>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

/** The course you're in, as a wide banner over its painted world. */
function Featured({ course }: { course: Course }) {
  const p = courseProgress(course);
  const art = course.cover ?? courseArtSrc(course.topic);
  const next = Math.min(course.currentModule, course.modules.length - 1);
  return (
    <Link href={`/courses/${course.id}`} className="group shadow-card relative mt-10 block h-72 overflow-hidden rounded-3xl bg-navy sm:h-80">
      <Image unoptimized={isRemote(art)} src={art} alt="" fill sizes="1080px" className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" priority />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a2540]/95 via-[#0a2540]/60 to-[#0a2540]/10 sm:bg-gradient-to-r sm:from-[#0a2540]/90 sm:via-[#0a2540]/50 sm:to-transparent" />
      <div className="relative flex h-full max-w-lg flex-col justify-end p-7 sm:p-9">
        <p className="text-sm font-medium text-white/70">Continue · lesson {next + 1} of {p.total}</p>
        <p className="display-xl font-display mt-2 text-3xl text-white sm:text-4xl">{course.title}</p>
        <p className="mt-2 line-clamp-1 text-white/75">{course.modules[next]?.title}</p>
        <div className="mt-5 flex items-center gap-4">
          <span className="btn-pill bg-white text-fg">
            Continue <HoverArrow />
          </span>
          <span className="flex items-center gap-2 text-sm text-white/75 tabular-nums">
            <span className="h-1.5 w-24 overflow-hidden rounded-full bg-white/25">
              <span className="block h-full rounded-full bg-white" style={{ width: `${Math.max(p.percent, 3)}%` }} />
            </span>
            {p.percent}%
          </span>
        </div>
      </div>
    </Link>
  );
}
