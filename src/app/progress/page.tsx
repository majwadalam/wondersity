"use client";

import { Award, BookOpen, Crosshair, Flame, Map as MapIcon, Sprout, type LucideIcon } from "lucide-react";
import { CertificateList } from "@/components/app/Certificates";
import Image from "next/image";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useAppState } from "@/components/app/AppState";
import { courseArtSrc } from "@/components/app/CourseArt";
import { courseProgress } from "@/components/app/CourseCards";
import { HoverArrow } from "@/components/landing/HoverArrow";
import { learningStats } from "@/components/stats";
import type { Course } from "@/components/types";
import { isRemote } from "@/lib/remoteImage";

const noSubscribe = () => () => {};
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
/** Weeks shown in the activity heatmap (about six months). */
const LONG_WEEKS = 26;

export default function ProgressPage() {
  const { courses, loaded } = useAppState();
  const stats = learningStats(courses);
  const done = courses.reduce((n, c) => n + courseProgress(c).done, 0);
  const total = courses.reduce((n, c) => n + c.modules.length, 0);
  const minutes = courses.reduce(
    (n, c) => n + c.modules.reduce((m, mod, i) => m + (mod.lesson && (mod.lesson.completed || i < c.currentModule) ? mod.lesson.data.estimatedMinutes : 0), 0),
    0
  );

  const kpis = [
    { label: "Lessons finished", value: loaded ? `${done}` : "–", sub: total ? `of ${total} planned` : "none planned yet" },
    { label: "First-try accuracy", value: stats.accuracy === null ? "–" : `${stats.accuracy}%`, sub: "on graded checks" },
    { label: "Time learning", value: `${minutes}`, sub: "minutes" },
    { label: "Streak", value: `${stats.streak}`, sub: stats.streak === 1 ? "day" : "days" },
  ];

  return (
    <main className="mx-auto max-w-[1080px] px-5 pt-12 pb-24">
      <h1 className="display-xl font-display text-4xl text-fg sm:text-5xl">Your learning</h1>
      <p className="mt-3 text-lg text-muted">Everything here comes from lessons you&rsquo;ve finished and checks you&rsquo;ve answered.</p>

      {/* Key numbers */}
      <dl className="mt-10 grid grid-cols-2 overflow-hidden rounded-2xl bg-white ring-1 ring-line md:grid-cols-4">
        {kpis.map((k, i) => (
          <div key={k.label} className={`p-6 ${i ? "border-line md:border-l" : ""} ${i % 2 ? "border-l" : ""} ${i > 1 ? "border-t md:border-t-0" : ""}`}>
            <dt className="text-sm text-muted">{k.label}</dt>
            <dd className="mt-2 flex flex-wrap items-baseline gap-x-1.5">
              <span className="display-xl font-display text-4xl text-fg tabular-nums">{k.value}</span>
              <span className="text-sm text-muted">{k.sub}</span>
            </dd>
          </div>
        ))}
      </dl>

      <UpNext courses={courses} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Heatmap courses={courses} />
        <Badges courses={courses} done={done} streak={stats.streak} />
      </div>

      <CertificateList />

      <section className="mt-12">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-2xl text-fg">Courses</h2>
          <Link href="/courses" className="flex items-center gap-1 text-[15px] font-semibold text-accent">
            All courses <HoverArrow />
          </Link>
        </div>
        {courses.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-white p-8 text-center text-muted ring-1 ring-line">
            No courses yet.{" "}
            <Link href="/home?new=1" className="font-medium text-accent">
              Start one
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl bg-white ring-1 ring-line">
            {courses.map((c) => {
              const p = courseProgress(c);
              const art = c.cover ?? courseArtSrc(c.topic);
              return (
                <li key={c.id}>
                  <Link href={`/courses/${c.id}`} className="group flex items-center gap-4 p-4 hover:bg-canvas">
                    <span className="relative h-14 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-canvas">
                      <Image unoptimized={isRemote(art)} src={art} alt="" fill sizes="96px" className="object-cover" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-fg">{c.title}</span>
                      <span className="mt-1.5 flex items-center gap-3">
                        <span className="h-1.5 max-w-[240px] flex-1 overflow-hidden rounded-full bg-line">
                          <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(p.percent, 2)}%` }} />
                        </span>
                        <span className="text-xs text-muted tabular-nums">
                          {p.done}/{p.total}
                        </span>
                      </span>
                    </span>
                    <span className="text-muted transition-transform group-hover:translate-x-1">
                      <HoverArrow />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

/** The last 12 weeks: one square per day, filled by how many lessons were finished. */
function Heatmap({ courses }: { courses: Course[] }) {
  // Browser-only: "today" is the learner's local day.
  const today = useSyncExternalStore(noSubscribe, () => dayKey(new Date()), () => "");
  const counts = new Map<string, number>();
  for (const c of courses)
    for (const m of c.modules)
      if (m.lesson?.completedAt) {
        const k = dayKey(new Date(m.lesson.completedAt));
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
  const days: { key: string; n: number; label: string }[] = [];
  // Small fixed cells, so six months fits; on phones it scrolls sideways.
  const WEEKS = LONG_WEEKS;
  if (today) {
    // Columns are weeks (Sunday first), ending with the current week.
    const start = new Date();
    start.setDate(start.getDate() - start.getDay() - (WEEKS - 1) * 7);
    for (let i = 0; i < WEEKS * 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = dayKey(d);
      days.push({ key, n: counts.get(key) ?? 0, label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) });
    }
  }
  const tone = (n: number) => (n === 0 ? "bg-line/70" : n === 1 ? "bg-[#b9b5ff]" : n === 2 ? "bg-[#8a83ff]" : "bg-accent");
  const active = days.filter((d) => d.n > 0).length;
  return (
    <section className="min-w-0 rounded-2xl bg-white p-6 ring-1 ring-line">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold text-fg">Activity</h2>
        <span className="text-sm text-muted">
          {active} active day{active === 1 ? "" : "s"} in six months
        </span>
      </div>
      {/* Scrolls on its own on narrow screens, opening on the latest weeks (rtl wrapper). */}
      <div className="mt-5 overflow-x-auto pb-1 [direction:rtl]">
      <div className="grid w-max grid-flow-col grid-rows-7 gap-[3px] [direction:ltr]" role="img" aria-label={`Lessons finished per day over the last ${WEEKS} weeks`}>
        {days.map((d) => (
          <span key={d.key} title={`${d.label}: ${d.n} lesson${d.n === 1 ? "" : "s"}`} className={`h-3.5 w-3.5 rounded-[3px] ${tone(d.n)} ${d.key === today ? "ring-1 ring-fg/40" : ""}`} />
        ))}
      </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-xs text-muted">
        Less
        {[0, 1, 2, 3].map((n) => (
          <span key={n} className={`h-2.5 w-2.5 rounded-[2px] ${tone(n)}`} />
        ))}
        More
      </div>
    </section>
  );
}

/** Badges unlocked by real progress only. */
function Badges({ courses, done, streak }: { courses: Course[]; done: number; streak: number }) {
  const perfect = courses.some((c) => c.modules.some((m) => m.lesson?.quiz && m.lesson.quiz.correct === m.lesson.quiz.total));
  const list: { Icon: LucideIcon; title: string; text: string; on: boolean }[] = [
    { Icon: Sprout, title: "First lesson", text: "Finish a lesson", on: done >= 1 },
    { Icon: Crosshair, title: "Clean sweep", text: "Every check right first time", on: perfect },
    { Icon: Flame, title: "On a roll", text: "A 3-day streak", on: streak >= 3 },
    { Icon: BookOpen, title: "Curious mind", text: "Start 3 courses", on: courses.length >= 3 },
    { Icon: MapIcon, title: "Journey's end", text: "Finish a course", on: courses.some((c) => c.status === "completed") },
    { Icon: Award, title: "Ten down", text: "Finish 10 lessons", on: done >= 10 },
  ];
  const unlocked = list.filter((b) => b.on).length;
  return (
    <section className="min-w-0 rounded-2xl bg-white p-6 ring-1 ring-line">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold text-fg">Achievements</h2>
        <span className="text-sm text-muted tabular-nums">
          {unlocked}/{list.length}
        </span>
      </div>
      <ul className="mt-5 grid grid-cols-3 gap-3">
        {list.map(({ Icon, title, text, on }) => (
          <li key={title} className="flex flex-col items-center text-center" title={text}>
            <span
              className={`flex h-12 w-12 items-center justify-center rounded-full ${
                on ? "bg-gradient-to-br from-[#7a5cff] to-[#635bff] text-white shadow-[var(--shadow-md)]" : "bg-canvas text-muted/60 ring-1 ring-line"
              }`}
            >
              <Icon size={20} strokeWidth={1.75} />
            </span>
            <span className={`mt-2 text-xs font-medium ${on ? "text-fg" : "text-muted"}`}>{title}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The next lesson to take, front and centre: what an early dashboard should point at. */
function UpNext({ courses }: { courses: Course[] }) {
  const course = courses.find((c) => c.status === "active");
  if (!course) return null;
  const i = Math.min(course.currentModule, course.modules.length - 1);
  const m = course.modules[i];
  const art = m.cover ?? course.cover ?? courseArtSrc(course.topic);
  return (
    <Link href={`/courses/${course.id}${m.lesson ? `/${i + 1}` : ""}`} className="group shadow-card mt-6 flex flex-col overflow-hidden rounded-2xl bg-white sm:flex-row sm:items-center sm:gap-5 sm:p-3 sm:pr-6">
      <span className="relative h-40 w-full flex-shrink-0 overflow-hidden bg-canvas sm:h-24 sm:w-36 sm:rounded-xl">
        <Image unoptimized={isRemote(art)} src={art} alt="" fill sizes="144px" className="object-cover" />
      </span>
      <span className="min-w-0 flex-1 p-5 sm:p-0">
        <span className="block truncate text-sm font-medium text-accent">Up next · {course.title}</span>
        <span className="font-display mt-1 block text-xl text-fg sm:truncate">{m.title}</span>
        <span className="mt-1 hidden truncate text-sm text-muted sm:block">{m.goal}</span>
      </span>
      <span className="btn-pill btn-pill-dark mx-5 mb-5 justify-center sm:m-0">
        {m.lesson ? "Continue" : "Start"} <HoverArrow />
      </span>
    </Link>
  );
}
