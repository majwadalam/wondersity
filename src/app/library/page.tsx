"use client";

import { Star } from "lucide-react";
import Link from "next/link";
import { HoverArrow } from "@/components/landing/HoverArrow";
import { useState } from "react";
import { useAppState } from "@/components/app/AppState";
import { CATALOG, CatalogTile, CourseTile } from "@/components/app/CourseCards";
import { DocIcon } from "@/components/Icons";
import { LessonView } from "@/components/LessonView";
import { Reveal } from "@/components/Reveal";
import type { LessonRow } from "@/components/types";

export default function LibraryPage() {
  const { bookmarks, courseFor, library, loaded, submitQuiz } = useAppState();
  const [open, setOpen] = useState<LessonRow | null>(null);

  return (
    <main className="mx-auto max-w-[1080px] px-5 pt-12 pb-24">
      <h1 className="display-xl font-display text-4xl text-fg sm:text-5xl">Library</h1>
      <p className="mt-3 text-lg text-muted">Courses you&rsquo;ve starred, kept in one place.</p>

      {bookmarks.length === 0 ? (
        <div className="mt-10 flex flex-col items-center rounded-3xl bg-white px-6 py-16 text-center ring-1 ring-line">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <Star size={24} strokeWidth={1.75} />
          </span>
          <p className="font-display mt-5 text-2xl text-fg">Nothing starred yet</p>
          <p className="mt-2 max-w-sm text-muted">Tap the star on any course and it will wait for you here.</p>
          <Link href="/courses" className="btn-pill btn-pill-dark mt-7">
            Browse courses <HoverArrow />
          </Link>
        </div>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {bookmarks.map((b, i) => {
            const course = courseFor(b.topic);
            const blurb = CATALOG.find((c) => c.topic.toLowerCase() === b.key)?.blurb ?? "Saved for later.";
            return (
              <Reveal key={b.key} group="library" delay={i * 70} stagger={70}>
                {course ? <CourseTile course={course} /> : <CatalogTile topic={b.topic} blurb={blurb} />}
              </Reveal>
            );
          })}
        </div>
      )}

      {/* Older single lessons, from before courses existed */}
      {loaded && library.length > 0 && (
        <section className="mt-16">
          <h2 className="font-display text-2xl text-fg">Single lessons</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {library.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => setOpen(row)}
                  className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left ${open?.id === row.id ? "border-accent/60 bg-surface" : "border-line bg-surface/60 hover:border-accent/50"}`}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                    <DocIcon size={18} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-fg capitalize">{row.topic}</span>
                    <span className="block truncate text-xs text-muted">{row.lesson_data.title}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {open && (
            <div className="mx-auto max-w-3xl">
              <LessonView
                key={open.id}
                view={{
                  kind: "lesson",
                  key: open.id,
                  lesson: open.lesson_data,
                  lessonId: open.id,
                  score: open.score,
                  status: {},
                  course: null,
                  moduleIndex: null,
                  tutorNote: null,
                  trace: [{ step: "loaded_from_library", lessonId: open.id, topic: open.topic }],
                }}
                onSubmitQuiz={submitQuiz}
                onContinue={() => {}}
                onOpenModule={() => {}}
              />
            </div>
          )}
        </section>
      )}
    </main>
  );
}
