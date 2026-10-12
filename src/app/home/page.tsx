"use client";

import { ArrowRight, Flame, Target } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, useSyncExternalStore } from "react";
import { useAppState, useStartCourse } from "@/components/app/AppState";
import { courseArtSrc } from "@/components/app/CourseArt";
import { CATALOG, CatalogTile, courseProgress } from "@/components/app/CourseCards";
import { greeting, learningStats } from "@/components/stats";
import type { Course } from "@/components/types";
import { isRemote } from "@/lib/remoteImage";

// The signed-in home: today's goal and streak, the lesson to take next, a
// box to start any course, and the learner's other courses.

const noSubscribe = () => () => {};

export default function HomePage() {
  return (
    <Suspense>
      <Home />
    </Suspense>
  );
}

function Home() {
  const { courses, loaded, profile } = useAppState();
  const focusNew = useSearchParams().get("new") === "1";
  // Read on the client only, so the server's clock and time zone never show.
  const hour = useSyncExternalStore(noSubscribe, () => new Date().getHours(), () => 12);
  const today = useSyncExternalStore(noSubscribe, () => new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }), () => "");
  const stats = learningStats(courses);
  const goal = profile?.dailyGoalMinutes ?? 10;
  const minutesToday = stats.doneToday.reduce((n, d) => n + (d.course.modules[d.moduleIndex].lesson?.data.estimatedMinutes ?? 8), 0);
  const active = courses.filter((c) => c.status === "active");
  const first = profile?.displayName?.split(" ")[0];
  const started = new Set(courses.map((c) => c.topic.trim().toLowerCase()));
  const explore = CATALOG.filter((c) => !started.has(c.topic.toLowerCase())).slice(0, 4);

  return (
    <main className="mx-auto max-w-[1100px] px-5 pt-10 pb-24 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted">{today || "\u00a0"}</p>
          <h1 className="display-xl mt-1 text-[34px] text-fg sm:text-[40px]">
            {greeting(hour)}
            {first ? `, ${first}` : ""}.
          </h1>
        </div>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_320px]">
        {!loaded ? (
          <div className="skeleton h-[260px] rounded-2xl" />
        ) : active[0] && !focusNew ? (
          <ContinueCard course={active[0]} />
        ) : (
          <NewCourse autoFocus={focusNew || courses.length === 0} big />
        )}
        <Today minutes={minutesToday} goal={goal} streak={stats.streak} />
      </div>

      {loaded && active[0] && !focusNew && (
        <section className="mt-10">
          <h2 className="text-[15px] font-semibold text-fg">Start something new</h2>
          <div className="mt-3">
            <NewCourse />
          </div>
        </section>
      )}

      {active.length > 1 && (
        <section className="mt-12">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[15px] font-semibold text-fg">Your other courses</h2>
            <Link href="/courses" className="text-sm font-medium text-accent hover:underline">
              All courses
            </Link>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {active.slice(1, 7).map((c) => (
              <CourseRow key={c.id} course={c} />
            ))}
          </div>
        </section>
      )}

      {explore.length > 0 && (
        <section className="mt-12">
          <h2 className="text-[15px] font-semibold text-fg">Popular on Wondersity</h2>
          <div className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {explore.map((c) => (
              <CatalogTile key={c.topic} topic={c.topic} blurb={c.blurb} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

/** The next lesson of the most recent course, as the page's main action. */
function ContinueCard({ course }: { course: Course }) {
  const i = Math.min(course.currentModule, course.modules.length - 1);
  const m = course.modules[i];
  const { done, total, percent } = courseProgress(course);
  const art = m.cover ?? course.cover ?? courseArtSrc(course.topic);
  return (
    <Link
      href={m.lesson ? `/courses/${course.id}/${i + 1}` : `/courses/${course.id}`}
      className="group relative flex min-h-[260px] overflow-hidden rounded-2xl bg-navy text-white shadow-[var(--shadow-lg)]"
    >
      <Image unoptimized={isRemote(art)} src={art} alt="" fill sizes="(min-width: 1024px) 760px, 100vw" className="object-cover opacity-90 transition-transform duration-700 group-hover:scale-[1.03]" priority />
      <span className="absolute inset-0 bg-gradient-to-r from-[#0a2540] via-[#0a2540]/80 to-[#0a2540]/10" />
      <span className="relative flex max-w-lg flex-col justify-end p-7">
        <span className="text-xs font-semibold tracking-wide text-white/70 uppercase">Continue · {course.title}</span>
        <span className="mt-2 text-[26px] leading-tight font-semibold tracking-[-0.02em]">{m.title}</span>
        <span className="mt-2 line-clamp-2 text-[15px] text-white/75">{m.goal}</span>
        <span className="mt-5 flex items-center gap-4">
          <span className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-navy transition-transform group-hover:translate-x-0.5">
            {m.lesson ? (m.lesson.completed ? "Review lesson" : "Continue lesson") : "Open course"} <ArrowRight size={16} />
          </span>
          <span className="text-sm text-white/70 tabular-nums">
            {done} of {total} · {percent}%
          </span>
        </span>
      </span>
    </Link>
  );
}

/** Today's goal as a ring, plus the streak. */
function Today({ minutes, goal, streak }: { minutes: number; goal: number; streak: number }) {
  const pct = Math.min(1, minutes / goal);
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col rounded-2xl bg-white p-6 ring-1 ring-line">
      <p className="text-sm font-semibold text-fg">Today</p>
      <div className="mt-4 flex items-center gap-5">
        <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90" aria-hidden>
          <circle cx="40" cy="40" r={r} fill="none" stroke="var(--color-line)" strokeWidth="8" />
          <circle cx="40" cy="40" r={r} fill="none" stroke="var(--color-accent)" strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} className="transition-[stroke-dashoffset] duration-700" />
        </svg>
        <div>
          <p className="text-[28px] leading-none font-semibold tracking-[-0.02em] text-fg tabular-nums">
            {minutes}
            <span className="text-base font-medium text-muted"> / {goal} min</span>
          </p>
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted">
            <Target size={14} /> {pct >= 1 ? "Goal met. Nice." : "Daily goal"}
          </p>
        </div>
      </div>
      <div className="mt-auto flex items-center gap-3 border-t border-line pt-4">
        <span className={`flex h-9 w-9 items-center justify-center rounded-full ${streak ? "bg-[#fff1e6] text-[#f2711c]" : "bg-canvas text-muted"}`}>
          <Flame size={18} />
        </span>
        <p className="text-sm text-fg">
          <span className="font-semibold tabular-nums">{streak}-day streak</span>
          <span className="block text-xs text-muted">{streak ? "Finish a lesson today to keep it." : "Finish a lesson to start one."}</span>
        </p>
      </div>
    </div>
  );
}

function NewCourse({ autoFocus = false, big = false }: { autoFocus?: boolean; big?: boolean }) {
  const { busy } = useAppState();
  const start = useStartCourse();
  const [topic, setTopic] = useState("");
  return (
    <div className={big ? "flex min-h-[260px] flex-col justify-center rounded-2xl bg-white p-8 ring-1 ring-line" : ""}>
      {big && (
        <>
          <p className="text-2xl font-semibold tracking-[-0.02em] text-fg">What do you want to learn?</p>
          <p className="mt-1.5 text-[15px] text-muted">Name anything. Wondersity plans a course in under a minute and opens it.</p>
        </>
      )}
      <form
        className={`flex items-center gap-2 rounded-full bg-white p-1.5 pl-5 ring-1 ring-line focus-within:ring-2 focus-within:ring-accent ${big ? "mt-5" : ""}`}
        onSubmit={(e) => {
          e.preventDefault();
          start(topic);
        }}
      >
        <input
          value={topic}
          autoFocus={autoFocus}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="The Silk Road, black holes, jazz harmony…"
          maxLength={120}
          aria-label="What do you want to learn?"
          className="min-w-0 flex-1 bg-transparent py-2 text-[15px] text-fg outline-none placeholder:text-muted/80"
        />
        <button type="submit" disabled={!!busy || !topic.trim()} className="btn-pill btn-pill-dark flex-shrink-0">
          Plan course
        </button>
      </form>
    </div>
  );
}

function CourseRow({ course }: { course: Course }) {
  const { percent, done, total } = courseProgress(course);
  const art = course.cover ?? courseArtSrc(course.topic);
  return (
    <Link href={`/courses/${course.id}`} className="flex items-center gap-4 rounded-xl bg-white p-3 ring-1 ring-line transition-shadow hover:shadow-[var(--shadow-md)]">
      <span className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-canvas">
        <Image unoptimized={isRemote(art)} src={art} alt="" fill sizes="56px" className="object-cover" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-fg">{course.title}</span>
        <span className="mt-1.5 flex items-center gap-2">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
            <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(percent, 3)}%` }} />
          </span>
          <span className="text-xs text-muted tabular-nums">
            {done}/{total}
          </span>
        </span>
      </span>
    </Link>
  );
}
