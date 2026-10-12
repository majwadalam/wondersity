"use client";

import { AppError } from "./app/AppState";

import { motion } from "motion/react";
import { Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { APPROACHES, isInteractive, lessonBlocks } from "@/lib/lessonBlocks";
import { HarnessTrace } from "./HarnessTrace";
import { Lottie } from "./motion/Lottie";
import { LessonBlock } from "./lesson/LessonBlock";
import { SceneHeader, SpeakButton, type VoiceControl } from "./lesson/Scene";
import { Burst, ProgressFill } from "./motion/primitives";
import { GoDeeper } from "./lesson/GoDeeper";
import { ReportMistake } from "./lesson/ReportMistake";
import { spring } from "./motion/presets";
import type { Answer, Course, PrefetchState, QuizResult, View } from "./types";
import { levelsOf, lessonLabel } from "@/lib/courseHierarchy";

const PASS_SCORE = 8;

type Submission =
  | { state: "idle" }
  | { state: "saving" }
  | { state: "done"; result: QuizResult }
  | { state: "error"; message: string };

/** "Mystery first: open with…" → "Mystery first". */
const approachLabel = (key?: string) =>
  key && key in APPROACHES ? APPROACHES[key as keyof typeof APPROACHES].split(":")[0] : null;

/**
 * A lesson, one step per screen: an intro, then each block in order, then the
 * finish. Every step stays mounted (only the current one is shown) so going
 * back keeps what the learner did. Continue opens once a check is answered;
 * practice can be skipped, checks can't, because they're graded.
 */
export function LessonView({
  view,
  onSubmitQuiz,
  nextModuleState,
  onContinue,
  exitHref = "/courses",
  voice = null,
}: {
  view: Extract<View, { kind: "lesson" }>;
  onSubmitQuiz: (lessonId: number, answers: Answer[]) => Promise<QuizResult>;
  /** Whether the next module is being written in the background. */
  nextModuleState?: PrefetchState;
  onContinue: (topic: string) => void;
  onOpenModule: (course: Course, moduleIndex: number) => void;
  /** Where the close button goes. */
  exitHref?: string;
  /** Speaks the guide's lines, when the lesson is staged. */
  voice?: VoiceControl | null;
}) {
  const { lesson, lessonId, score, status, course, moduleIndex, tutorNote, trace } = view;
  // The ordered teaching blocks; older lessons are rebuilt in their original order.
  const blocks = lessonBlocks(lesson);
  // Scenes with a guide, once the lesson has been staged.
  const staging = lesson.staging && lesson.staging.steps.length >= blocks.length + 1 ? lesson.staging : null;
  const [answers, setAnswers] = useState<Record<number, { chosen: string; correct: boolean }>>({});
  const [doneBlocks, setDoneBlocks] = useState<Set<number>>(() => new Set());
  const markDone = (i: number) => setDoneBlocks((s) => (s.has(i) ? s : new Set(s).add(i)));
  const [submission, setSubmission] = useState<Submission>({ state: "idle" });
  // Steps: 0 = intro, 1..blocks.length = blocks, last = finish.
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<"forward" | "back">("forward");
  const lastStep = blocks.length + 1;

  const answered = Object.keys(answers).length;
  const correctCount = Object.values(answers).filter((a) => a.correct).length;
  const total = lesson.questions.length;
  const checkOrder = blocks.flatMap((b) => (b.kind === "check" ? [b.ref] : []));
  const approach = approachLabel(lesson.approach);
  const currentMod = course && moduleIndex !== null ? course.modules[moduleIndex] : null;
  const level = course && currentMod ? levelsOf(course)[currentMod.level] : null;
  const levelTitle = level && !level.legacy ? level.title : null;
  const kicker = currentMod && moduleIndex !== null && course ? lessonLabel(levelsOf(course), moduleIndex) : null;
  // The harness trace is for developers: shown only with ?trace in the URL.
  const showTrace = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).has("trace"),
    () => false
  );

  // Each new step starts at the top of the page.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
  }, [step]);

  // Records each step reached for the first time (0 = opened), to see where
  // learners stop. Fire and forget: a lost view never gets in the lesson's way.
  const furthest = useRef<{ lessonId: number | null; step: number }>({ lessonId: null, step: -1 });
  useEffect(() => {
    if (lessonId === null) return;
    if (furthest.current.lessonId === lessonId && step <= furthest.current.step) return;
    furthest.current = { lessonId, step };
    fetch("/api/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId, step, stepCount: lastStep + 1 }),
      keepalive: true,
    }).catch(() => {});
  }, [lessonId, step, lastStep]);

  async function submit(all: typeof answers) {
    if (lessonId === null) return;
    setSubmission({ state: "saving" });
    try {
      const result = await onSubmitQuiz(
        lessonId,
        Object.entries(all).map(([i, a]) => ({ questionIndex: Number(i), chosen: a.chosen }))
      );
      setSubmission({ state: "done", result });
    } catch (e) {
      // Server messages are plain (AppError); a network failure's raw text is never shown.
      setSubmission({ state: "error", message: e instanceof AppError ? e.message : "Couldn't save your answers. Check your connection and try again." });
    }
  }

  // Checks sit through the lesson; the module is saved once the last one is answered.
  function handleAnswer(i: number, chosen: string, correct: boolean) {
    if (answers[i]) return;
    const next = { ...answers, [i]: { chosen, correct } };
    setAnswers(next);
    if (Object.keys(next).length === total) submit(next);
  }

  function go(to: number) {
    setDir(to > step ? "forward" : "back");
    setStep(Math.max(0, Math.min(lastStep, to)));
  }

  // What the bottom button does on this step.
  const block = step >= 1 && step <= blocks.length ? blocks[step - 1] : null;
  const blockIndex = step - 1;
  const isCheck = block?.kind === "check";
  const checkAnswered = isCheck && !!answers[block.ref];
  const practice = !!block && isInteractive(block) && !isCheck;
  const practiceDone = practice && doneBlocks.has(blockIndex);
  const canContinue = step < lastStep && (!isCheck || checkAnswered);
  const continueLabel = step === 0 ? "Start" : practice && !practiceDone ? "Skip" : step === blocks.length ? "Finish" : "Continue";
  const tone = (isCheck && checkAnswered && answers[block.ref].correct) || practiceDone ? "good" : undefined;
  const unanswered = checkOrder.filter((q) => !answers[q]);
  // The lesson's own summary, repeated at the end as what the learner takes away.
  const recap = blocks.flatMap((b) => (b.kind === "summary" ? b.points : [])).slice(0, 4);

  return (
    <article id="lesson" className="min-h-screen overflow-x-clip bg-surface">
      {/* Top bar: close, progress through the steps, count. */}
      <div className="app-header sticky top-0 z-20 border-b border-line">
        <div className={`mx-auto flex h-14 items-center gap-4 px-4 sm:px-6 ${staging ? "max-w-6xl" : "max-w-3xl"}`}>
          <Link href={exitHref} aria-label="Close lesson" className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-canvas hover:text-fg">
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
              <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
            </svg>
          </Link>
          <div
            className="flex flex-1 gap-1"
            role="progressbar"
            aria-label="Lesson progress"
            aria-valuemin={0}
            aria-valuemax={lastStep}
            aria-valuenow={step}
          >
            {Array.from({ length: lastStep }, (_, i) => {
              return (
                <span
                  key={i}
                  className={`h-2 flex-1 rounded-full transition-colors duration-300 ${
                    i < step ? "bg-accent" : "bg-canvas ring-1 ring-line ring-inset"
                  }`}
                />
              );
            })}
          </div>
          <span className="text-xs font-medium text-muted tabular-nums">
            {Math.min(step + 1, lastStep + 1)}/{lastStep + 1}
          </span>
          {lessonId !== null && <ReportMistake lessonId={lessonId} step={step} />}
          {staging && voice && (
            <button
              type="button"
              onClick={voice.toggle}
              aria-pressed={voice.enabled}
              aria-label={voice.enabled ? "Turn the guide's voice off" : "Turn the guide's voice on"}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors ${
                voice.enabled ? "bg-accent-soft text-accent ring-accent/20" : "bg-surface text-muted ring-line hover:text-fg"
              }`}
            >
              {voice.enabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              {voice.enabled ? "Voice on" : "Voice off"}
            </button>
          )}
        </div>
      </div>

      <div className={`mx-auto px-4 pb-40 sm:px-6 ${staging ? "max-w-6xl pt-4 sm:pt-8" : "max-w-2xl pt-10"}`}>
        {/* Intro */}
        {staging && step === 0 && (
          <p className="sr-only">Your guide for this lesson is {staging.guide.name}, {staging.guide.role}.</p>
        )}
        <Step active={step === 0} dir={dir}>
          <WithScene scene={staging && <SceneHeader staging={staging} step={0} active={step === 0} voice={voice} />}>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
            {kicker && <span className="font-medium text-fg">{kicker}</span>}
            {levelTitle && (
              <>
                <span aria-hidden>·</span>
                <span>{levelTitle}</span>
              </>
            )}
            <span aria-hidden>·</span>
            <span>
              {lesson.estimatedMinutes} min{total > 0 && `, ${total} ${total === 1 ? "check" : "checks"}`}
            </span>
          </p>
          <h1 className="font-display mt-4 text-3xl leading-tight text-fg sm:text-4xl">{lesson.title}</h1>
          <div className="mt-6 rounded-2xl border border-line bg-canvas p-5">
            <p className="text-xs font-semibold text-accent">Objective</p>
            <p className="mt-1 text-[17px] leading-relaxed text-fg">{lesson.objective}</p>
            {approach && (
              <p className="mt-3 border-t border-line pt-3 text-sm text-muted">
                How you&rsquo;ll learn: <span className="font-medium text-fg">{approach}</span>
              </p>
            )}
          </div>
          {tutorNote && (
            <div className="mt-6 flex gap-3 rounded-2xl border border-line p-5">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white">T</span>
              <div>
                <p className="text-xs font-semibold text-muted">Your tutor</p>
                <p className="mt-1 text-[15px] leading-relaxed text-fg">{tutorNote}</p>
              </div>
            </div>
          )}
          {status.resumed && (
            <Notice>Picking up where you left off: you haven&rsquo;t finished this lesson&rsquo;s checks yet.</Notice>
          )}
          {status.passed === false && score != null && (
            <Notice>
              This is the agent&rsquo;s best attempt: it scored {score}/10, below the {PASS_SCORE}/10
              quality bar, after revision.
            </Notice>
          )}
          {status.saved === false && (
            <Notice>
              This lesson couldn&rsquo;t be saved, so your progress on it won&rsquo;t be kept. You can
              still study it now.
            </Notice>
          )}
          </WithScene>
        </Step>

        {/* Blocks */}
        {blocks.map((b, i) => (
          <Step key={i} active={step === i + 1} dir={dir}>
            <WithScene scene={staging && <SceneHeader staging={staging} step={i + 1} active={step === i + 1} voice={voice} />}>
              <LessonBlock
                block={b}
                lesson={lesson}
                checkNumber={b.kind === "check" ? checkOrder.indexOf(b.ref) + 1 : 0}
                checkCount={checkOrder.length}
                onDone={() => markDone(i)}
                onAnswer={handleAnswer}
              />
            </WithScene>
          </Step>
        ))}

        {/* Finish */}
        <Step active={step === lastStep} dir={dir}>
          <section aria-label="Finish the lesson">
            {total === 0 ? (
              <p className="text-sm text-muted">
                This lesson was saved before quizzes were required, so it has no questions. Search the
                topic again for a course with quizzes.
              </p>
            ) : (
              <>
                {answered === total ? (
                  staging?.images[0]?.url ? (
                    <div className="relative">
                      <div className="relative overflow-hidden rounded-3xl bg-navy">
                        {/* Bookends the lesson: back to the scene it opened on. */}
                        {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized WebP from storage */}
                        <img src={staging.images[0].url} alt="" className="scene-pan aspect-[21/9] w-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0a2540]/95 via-[#0a2540]/30 to-transparent" />
                        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                          <p className="flex items-center gap-1.5 text-sm font-medium text-white/85">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-good text-[11px] text-white">✓</span>
                            Lesson complete
                          </p>
                          <h2 className="display-xl font-display mt-1 text-2xl text-white sm:text-4xl">{lesson.title}</h2>
                        </div>
                      </div>
                      <Lottie name="confetti" className="pointer-events-none absolute -top-10 left-1/2 h-64 w-[min(36rem,100%)] -translate-x-1/2" />
                      {staging.farewell && (
                        <figure className="mt-5 flex items-start gap-4 rounded-2xl bg-canvas p-5 ring-1 ring-line">
                          {staging.guide.portrait && (
                            // eslint-disable-next-line @next/next/no-img-element -- pre-sized WebP from storage
                            <img src={staging.guide.portrait} alt="" className="h-12 w-12 flex-shrink-0 rounded-full object-cover ring-2 ring-white" />
                          )}
                          <div className="min-w-0">
                            <figcaption className="flex items-center gap-2 text-xs font-semibold text-muted">
                              {staging.guide.name}
                              {voice && <SpeakButton voice={voice} step={staging.steps.length} active={step === lastStep} tone="light" />}
                            </figcaption>
                            <blockquote className="mt-1 text-[17px] leading-relaxed text-fg">&ldquo;{staging.farewell}&rdquo;</blockquote>
                          </div>
                        </figure>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-center">
                      <Lottie name="success" className="-my-6 h-40 w-40" />
                      <h2 className="display-xl font-display mt-1 text-3xl text-fg sm:text-4xl">Lesson complete</h2>
                      <p className="mt-2 text-muted">{lesson.title}</p>
                    </div>
                  )
                ) : (
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <h2 className="font-display text-2xl text-fg">Finish the lesson</h2>
                    <QuizProgress answered={answered} correct={correctCount} total={total} />
                  </div>
                )}
                {answered < total && (
                  <div className="mt-4 rounded-2xl border border-line bg-canvas p-5 text-sm text-fg">
                    <p>
                      {unanswered.length === 1 ? "One check is" : `${unanswered.length} checks are`} still open. Your
                      progress is saved once every check is answered.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {unanswered.map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => go(blocks.findIndex((b) => b.kind === "check" && b.ref === q) + 1)}
                          className="btn-secondary rounded-full px-3 py-1 text-xs font-medium"
                        >
                          Go to check {checkOrder.indexOf(q) + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {answered === total && (
                  <QuizOutcome
                    correct={correctCount}
                    total={total}
                    submission={submission}
                    moduleIndex={moduleIndex}
                    course={course}
                    nextModuleState={nextModuleState}
                    onRetry={() => submit(answers)}
                    onContinue={onContinue}
                  />
                )}
                {answered === total && recap.length > 0 && (
                  <div className="mt-6 rounded-2xl border border-line p-6">
                    <p className="text-sm font-semibold text-fg">What you learned</p>
                    <ul className="mt-3 space-y-2.5">
                      {recap.map((point) => (
                        <li key={point} className="flex gap-3 text-[15px] leading-relaxed text-fg">
                          <span className="mt-1 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-[#e9f8ef] text-[10px] text-good" aria-hidden>
                            ✓
                          </span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {answered === total && lesson.resources && <GoDeeper resources={lesson.resources} />}
                {answered === total && lesson.sources && lesson.sources.length > 0 && (
                  <details className="mt-4 rounded-2xl border border-line px-6 py-4 text-sm">
                    <summary className="cursor-pointer font-medium text-fg">
                      Facts checked against {lesson.sources.length} {lesson.sources.length === 1 ? "source" : "sources"}
                    </summary>
                    <ul className="mt-3 space-y-1.5">
                      {lesson.sources.map((s) => (
                        <li key={s.url} className="min-w-0 truncate">
                          <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                            {s.title}
                          </a>
                          <span className="ml-2 text-muted">{hostname(s.url)}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </>
            )}
          </section>
          {showTrace && <HarnessTrace trace={trace} />}
        </Step>
      </div>

      {/* Bottom bar: back + the one main action. */}
      {step < lastStep && (
        <div data-fixed-bottom className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <div className={`mx-auto flex items-center gap-3 px-4 py-3 sm:px-6 ${staging ? "max-w-6xl" : "max-w-2xl"}`}>
            {step > 0 && (
              <button type="button" onClick={() => go(step - 1)} className="btn-secondary btn-continue px-5 text-sm">
                Back
              </button>
            )}
            {isCheck && !checkAnswered && <span className="text-sm text-muted">Choose an answer to continue</span>}
            <button
              type="button"
              disabled={!canContinue}
              onClick={() => go(step + 1)}
              data-tone={tone}
              className={`btn-continue ml-auto px-8 text-sm sm:min-w-[10rem] ${
                practice && !practiceDone ? "btn-secondary" : "btn-primary"
              } ${step === 0 ? "w-full sm:w-auto" : ""}`}
            >
              {continueLabel}
            </button>
          </div>
        </div>
      )}
      {step === lastStep && (
        <div data-fixed-bottom className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <div className={`mx-auto flex items-center justify-end gap-3 px-4 py-3 sm:px-6 ${staging ? "max-w-6xl" : "max-w-2xl"}`}>
            <Link href={exitHref} className="btn-secondary btn-continue inline-flex items-center px-6 text-sm">
              Back to course
            </Link>
          </div>
        </div>
      )}
    </article>
  );
}

/**
 * A step beside its scene: side by side on wide screens (the scene stays put
 * while the step scrolls), stacked on phones. Without staging, just the step.
 */
function WithScene({ scene, children }: { scene: ReactNode; children: ReactNode }) {
  if (!scene) return <>{children}</>;
  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start lg:gap-12">
      <div className="mb-7 lg:sticky lg:top-20 lg:mb-0">{scene}</div>
      <div className="min-w-0 lg:pt-1">{children}</div>
    </div>
  );
}

/** One screen of the lesson. Hidden steps stay mounted so their state survives. */
function Step({ active, dir, children }: { active: boolean; dir: "forward" | "back"; children: ReactNode }) {
  return (
    <div hidden={!active} className="lesson-step" data-dir={active ? dir : undefined}>
      {children}
    </div>
  );
}

function QuizOutcome({
  correct,
  total,
  submission,
  moduleIndex,
  course,
  nextModuleState,
  onRetry,
  onContinue,
}: {
  correct: number;
  total: number;
  submission: Submission;
  moduleIndex: number | null;
  course: Course | null;
  nextModuleState?: PrefetchState;
  onRetry: () => void;
  onContinue: (topic: string) => void;
}) {
  const scoreLine =
    correct === total ? "A clean sweep. Well done." : `You got ${correct} of ${total} on the first try.`;
  // Prefer the server's updated course once the quiz is saved.
  const latest = submission.state === "done" ? (submission.result.course ?? course) : course;
  const finishedCourse = latest?.status === "completed";
  const nextIndex = latest?.currentModule ?? null;
  const next = latest && nextIndex !== null && !finishedCourse ? latest.modules[nextIndex] : null;
  const saved = submission.state === "done";
  // Levels the server now reports finished that weren't before this save.
  const before = course ? levelsOf(course) : [];
  const finishedLevels =
    saved && latest && course
      ? levelsOf(latest)
          .map((l, i) => ({ l, n: i + 1 }))
          .filter(({ l }) => !l.legacy && l.status === "done" && before.find((b) => b.id === l.id)?.status !== "done")
      : [];
  const doneModules = latest ? latest.modules.filter((m) => m.lesson?.completed).length : 0;

  return (
    <motion.div
      className="relative mt-6 rounded-2xl border border-line bg-surface p-6 shadow-sm"
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={spring.gentle}
    >
      <Burst trigger={saved && submission.result.firstCompletion ? "saved" : null} />
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-[#e9f8ef] font-display text-xl text-good tabular-nums">
          {correct}/{total}
        </span>
        <p className="font-display text-lg text-fg">{scoreLine}</p>
      </div>
      {finishedLevels.map(({ l, n }) => (
        <motion.div
          key={l.id}
          className="relative mt-4 flex items-center gap-3 rounded-xl bg-accent-soft px-4 py-3"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...spring.bouncy, delay: 0.3 }}
          role="status"
        >
          <Burst trigger={l.id} />
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-accent font-display text-white">{n}</span>
          <span>
            <span className="block text-sm font-semibold text-accent">Level {n} complete</span>
            <span className="block text-sm text-fg">{l.title}</span>
          </span>
        </motion.div>
      ))}
      {saved && latest && (
        <div className="mt-5 flex items-center gap-3">
          <ProgressFill value={doneModules / latest.modules.length} className="flex-1" label="Course progress" />
          <span className="text-xs text-muted tabular-nums">
            {doneModules}/{latest.modules.length} lessons
          </span>
        </div>
      )}

      {submission.state === "saving" && <p className="mt-3 text-sm text-muted">Saving your progress…</p>}

      {submission.state === "error" && (
        <p className="mt-3 text-sm text-[#9b1c20]">
          {submission.message}{" "}
          <button type="button" onClick={onRetry} className="font-medium underline underline-offset-2">
            Try again
          </button>
        </p>
      )}

      {submission.state === "done" && latest && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {finishedCourse ? (
            <>
              <p className="flex-1 text-sm text-muted">You&rsquo;ve finished the whole course.</p>
              <button type="button" onClick={() => onContinue(latest.topic)} className="btn-primary rounded-xl px-5 py-2.5 text-sm font-semibold">
                See your course →
              </button>
            </>
          ) : next && nextIndex !== null ? (
            <>
              {next.cover && nextIndex !== moduleIndex && (
                // eslint-disable-next-line @next/next/no-img-element -- pre-sized WebP from storage
                <img src={next.cover} alt="" className="h-14 w-20 flex-shrink-0 rounded-lg object-cover ring-1 ring-line" />
              )}
              <p className="flex-1 text-sm text-muted">
                {nextIndex === moduleIndex
                  ? "This lesson is still open."
                  : `Up next: ${lessonLabel(levelsOf(latest), nextIndex)}, ${next.title}.`}
                {nextModuleState === "pending" && (
                  <span className="mt-1 flex items-center gap-2 text-xs">
                    <span className="inline-flex gap-1" aria-hidden>
                      <span className="h-1 w-1 rounded-full bg-accent animate-dot-1" />
                      <span className="h-1 w-1 rounded-full bg-accent animate-dot-2" />
                      <span className="h-1 w-1 rounded-full bg-accent animate-dot-3" />
                    </span>
                    Your tutor is writing it now
                  </span>
                )}
                {nextModuleState === "ready" && <span className="mt-1 block text-xs">Ready when you are.</span>}
              </p>
              <button type="button" onClick={() => onContinue(latest.topic)} className="btn-primary rounded-xl px-5 py-2.5 text-sm font-semibold">
                {next.lesson ? "Next lesson →" : "Start the next lesson →"}
              </button>
            </>
          ) : null}
        </div>
      )}

      {submission.state === "done" && !latest && <p className="mt-3 text-sm text-muted">Search another topic to keep going.</p>}
    </motion.div>
  );
}

function QuizProgress({ answered, correct, total }: { answered: number; correct: number; total: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-1" aria-hidden>
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} className={`h-1.5 w-6 rounded-full transition-colors duration-500 ${i < answered ? "bg-accent" : "bg-line"}`} />
        ))}
      </div>
      <span className="text-xs text-muted tabular-nums">
        {answered}/{total}
        {answered > 0 && <> · {correct} right</>}
      </span>
    </div>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return <p className="mt-5 rounded-xl border border-[#f5d9a8] bg-[#fff8eb] px-4 py-3 text-sm leading-relaxed text-[#7a4b00]">{children}</p>;
}

/** "en.wikipedia.org" for a source link; the link itself if it doesn't parse. */
function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
