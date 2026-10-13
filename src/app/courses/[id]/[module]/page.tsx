"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { stageLesson, useAppState } from "@/components/app/AppState";
import type { VoiceControl } from "@/components/lesson/Scene";
import { LessonView } from "@/components/LessonView";
import { PaintingOwl } from "@/components/mascot/PaintingOwl";
import { BackLink } from "@/components/app/BackLink";
import { courseArtSrc } from "@/components/app/CourseArt";
import type { View } from "@/components/types";
import { levelsOf, lessonLabel } from "@/lib/courseHierarchy";
import type { Staging } from "@/lib/staging";

export default function ModulePage() {
  const { id, module } = useParams<{ id: string; module: string }>();
  const router = useRouter();
  const { courses, loaded, learn, busy, submitQuiz, moduleRun, prefetchState, prepareAhead } = useAppState();
  const course = courses.find((c) => String(c.id) === id);
  const index = Number(module) - 1;

  // While this lesson is taken, write the next one so it's ready on finishing.
  const takingCurrent = !!course && index === course.currentModule && !!course.modules[index]?.lesson;
  useEffect(() => {
    if (takingCurrent && course) prepareAhead(course);
  }, [takingCurrent, course, prepareAhead]);

  if (!course || !(index >= 0 && index < course.modules.length)) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
        {loaded ? (
          <>
            <p className="font-display text-2xl text-fg">That lesson doesn&rsquo;t exist.</p>
            <Link href="/courses" className="mt-4 inline-block font-medium text-accent hover:underline">
              Back to your courses
            </Link>
          </>
        ) : (
          <div className="skeleton mx-auto h-64 rounded-2xl" />
        )}
      </main>
    );
  }

  const saved = course.modules[index].lesson;
  const run = moduleRun(course.id, index);
  const lesson = saved?.data ?? run?.lesson;

  // Not written yet: offer to write it if it's the current module.
  if (!lesson) {
    const isCurrent = index === course.currentModule;
    return (
      <main className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <BackLink href={`/courses/${course.id}`}>{course.title}</BackLink>
        <div className="card mt-8 p-10 text-center">
          <p className="text-sm font-medium text-muted">{lessonLabel(levelsOf(course), index)}</p>
          <p className="font-display mt-2 text-2xl text-fg">{course.modules[index].title}</p>
          <p className="mx-auto mt-3 max-w-md text-sm text-fg">
            <span className="font-semibold text-accent">Objective:</span> {course.modules[index].goal}
          </p>
          <p className="mt-3 text-muted">
            {isCurrent ? "This lesson hasn’t been written yet." : "Finish the earlier lessons to unlock this one."}
          </p>
          {isCurrent && (
            <button type="button" disabled={!!busy} onClick={() => learn(course.topic)} className="btn-primary mt-6 rounded-xl px-6 py-3 font-semibold">
              Write this lesson
            </button>
          )}
        </div>
      </main>
    );
  }

  const lessonId = saved?.id ?? run?.lessonId ?? null;
  const view: Extract<View, { kind: "lesson" }> = {
    kind: "lesson",
    key: lessonId ?? index,
    lesson,
    lessonId,
    score: saved?.score ?? run?.score ?? null,
    status: run?.status ?? {},
    course,
    moduleIndex: index,
    tutorNote: run?.tutorNote ?? null,
    trace: run?.trace ?? [{ step: "opened_module", courseId: course.id, module: index + 1, lessonId }],
  };

  return (
    <main className="lesson-page">
      <StagedLesson
        key={view.key}
        view={view}
        // The module's own cover (older courses), else the course's world, else its catalog art.
        cover={course.modules[index].cover ?? course.cover ?? courseArtSrc(course.topic)}
        render={(v, voice) => (
          <LessonView
            view={v}
            voice={voice}
            onSubmitQuiz={submitQuiz}
            nextModuleState={prefetchState(course.topic)}
            onContinue={(topic) => learn(topic)}
            onOpenModule={(c, i) => router.push(`/courses/${c.id}/${i + 1}`)}
            exitHref={`/courses/${course.id}`}
          />
        )}
      />
    </main>
  );
}

// ---------- staging and voice ----------

const VOICE_KEY = "agora:voice";
const voiceSubscribers = new Set<() => void>();
const readVoice = () => {
  try {
    return localStorage.getItem(VOICE_KEY) !== "off";
  } catch {
    return true;
  }
};

/** The guide's voice: on by default, remembered per browser, one fetch per line. */
function useVoice(learnerId: string, lessonId: number | null): VoiceControl | null {
  const enabled = useSyncExternalStore(
    (cb) => {
      voiceSubscribers.add(cb);
      return () => voiceSubscribers.delete(cb);
    },
    readVoice,
    () => false
  );
  const urls = useRef(new Map<number, Promise<string | null>>());
  const toggle = useCallback(() => {
    try {
      localStorage.setItem(VOICE_KEY, readVoice() ? "off" : "on");
    } catch {
      /* storage blocked: the toggle just won't stick */
    }
    voiceSubscribers.forEach((cb) => cb());
  }, []);
  const urlFor = useCallback(
    (step: number) => {
      if (!lessonId || !learnerId) return Promise.resolve(null);
      let p = urls.current.get(step);
      if (!p) {
        p = fetch(`/api/voice?lessonId=${lessonId}&step=${step}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => d?.url ?? null)
          .catch(() => null);
        urls.current.set(step, p);
      }
      return p;
    },
    [learnerId, lessonId]
  );
  return useMemo(() => (lessonId ? { enabled, toggle, urlFor } : null), [enabled, toggle, urlFor, lessonId]);
}

/**
 * Stages the lesson as scenes the first time it's opened (the server saves
 * it, so this happens once), then shows it. If staging fails, the lesson is
 * shown as it is: it was already checked and works without scenes.
 */
function StagedLesson({
  view,
  cover,
  render,
}: {
  view: Extract<View, { kind: "lesson" }>;
  cover: string | null;
  render: (view: Extract<View, { kind: "lesson" }>, voice: VoiceControl | null) => React.ReactNode;
}) {
  const { learnerId } = useAppState();
  const [staging, setStaging] = useState<Staging | null>(view.lesson.staging ?? null);
  const [resources, setResources] = useState(view.lesson.resources ?? null);
  const [failed, setFailed] = useState(false);
  const voice = useVoice(learnerId, view.lessonId);
  const needed = !staging && !failed && view.lessonId !== null && !!view.course;
  // Staged but a painting failed last time: repair it quietly while the lesson runs.
  // Lessons staged before "Go deeper" existed get their resources the same way.
  const repair =
    !!staging && (!staging.guide.portrait || staging.images.some((i) => !i.url) || !resources) && view.lessonId !== null && !!view.course;

  useEffect(() => {
    if (!(needed || repair) || !learnerId) return;
    let live = true;
    stageLesson(view.lessonId!, view.course!.topic).then((st) => {
      if (!live) return;
      if (st) {
        setStaging(st.staging);
        if (st.resources) setResources(st.resources);
      }
      else if (needed) setFailed(true);
    });
    return () => {
      live = false;
    };
    // Runs once per lesson: `repair` flips to false after the fix lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needed, learnerId, view.lessonId, view.course]);

  if (needed) return <SettingTheScene title={view.lesson.title} cover={cover} />;
  const lesson = { ...view.lesson, ...(staging ? { staging } : {}), ...(resources ? { resources } : {}) };
  return <>{render({ ...view, lesson }, staging ? voice : null)}</>;
}

function SettingTheScene({ title, cover }: { title: string; cover: string | null }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-6 text-center">
      <PaintingOwl src={cover} className="w-full max-w-[22rem]" />
      <p className="font-display mt-4 text-2xl text-fg">Setting the scene</p>
      <p className="mt-2 max-w-sm text-[15px] text-muted">
        Casting your guide and painting the scenes for &ldquo;{title}&rdquo;. This takes about half a minute, once.
      </p>
    </div>
  );
}
