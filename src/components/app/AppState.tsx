"use client";

// App-wide state shared by every page: who the learner is, their courses,
// the tutor request (with background prefetch), quiz saving, and bookmarks.

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { Resources } from "@/lib/enrichment";
import type { Staging } from "@/lib/staging";
import type { Answer, Course, Lesson, LessonRow, LessonStatus, PrefetchState, QuizResult, TraceStep } from "../types";
import { levelsOf, moduleLabel } from "@/lib/courseHierarchy";
import { browserSupabase } from "@/lib/supabase/browser";

// ---------- learner identity ----------

// The learner is the signed-in Supabase user. Before accounts, a learner was
// a random id kept in this browser's localStorage. On sign-in the app checks
// what that id holds and asks before moving it into the account (see
// /api/account/claim): moving it silently put an old course into a brand-new
// account, and on a shared computer would hand one person's progress to another.
const BROWSER_ID_KEY = "learner_id";

export type Profile = {
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  reason: string | null;
  dailyGoalMinutes: number;
  voiceOn: boolean;
  onboarded: boolean;
};

function readBrowserId() {
  try {
    return localStorage.getItem(BROWSER_ID_KEY);
  } catch {
    return null;
  }
}

/** Forgets this browser's pre-account id (its progress stays where it is). */
function forgetBrowserId() {
  try {
    localStorage.removeItem(BROWSER_ID_KEY);
  } catch {
    /* storage blocked */
  }
}

/** The courses this browser's pre-account id holds, without moving them. */
async function previewBrowserProgress(oldId: string): Promise<{ topic: string; title: string }[]> {
  const res = await fetch(`/api/account/claim?browserId=${encodeURIComponent(oldId)}`).catch(() => null);
  if (!res?.ok) return [];
  return ((await res.json().catch(() => null))?.courses as { topic: string; title: string }[] | undefined) ?? [];
}

/** Moves this browser's pre-account progress into the account; only after the learner agrees. */
async function claimBrowserProgress(userId: string, oldId: string) {
  const res = await fetch("/api/account/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ browserId: oldId }),
  }).catch(() => null);
  if (!res?.ok) return false;
  try {
    // Bookmarks were stored per learner id: carry them over too.
    const marks = localStorage.getItem(bookmarkStorageKey(oldId));
    if (marks && !localStorage.getItem(bookmarkStorageKey(userId))) localStorage.setItem(bookmarkStorageKey(userId), marks);
    localStorage.removeItem(bookmarkStorageKey(oldId));
    localStorage.removeItem(BROWSER_ID_KEY);
  } catch {
    /* storage blocked */
  }
  return true;
}

/** Same normalization as the server's topicKey, so prefetches and bookmarks match. */
export const topicKey = (topic: string) => topic.trim().replace(/\s+/g, " ").toLowerCase();

// ---------- API shapes ----------

// What /api/learn returns (see TutorResult in src/lib/harness.ts).
export type LearnResponse =
  | {
      kind: "lesson";
      course: Course;
      moduleIndex: number;
      lessonId: number | null;
      lesson: Lesson;
      score: number | null;
      passed: boolean;
      saved: boolean;
      resumed: boolean;
      tutorNote: string | null;
      trace: TraceStep[];
    }
  | { kind: "course_complete"; course: Course; trace: TraceStep[] }
  | { kind: "nothing_ahead"; trace: TraceStep[] }
  | { kind: "upgrade_required"; course: Course | null; reason: string; message: string; trace: TraceStep[] };

/** What the last tutor run said about a module (shown on its page). */
export type ModuleRun = {
  lesson: Lesson;
  lessonId: number | null;
  score: number | null;
  status: LessonStatus;
  tutorNote: string | null;
  trace: TraceStep[];
};

/**
 * A failure the learner sees: a plain message (the server never sends internal
 * details), a reference to quote to support, and whether trying again can help.
 */
export class AppError extends Error {
  constructor(message: string, readonly ref?: string, readonly retryable = true) {
    super(message);
  }
}
export type ShownError = { message: string; ref?: string; retryable: boolean };

/** Reads an API response, turning non-JSON failures (e.g. a gateway timeout page) into readable errors. */
async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    throw new AppError(
      response.ok
        ? "Something went wrong on our side. Please try again."
        : "This is taking longer than it should. Please try again."
    );
  }
}

// ---------- lesson jobs ----------

/** A lesson job as /api/jobs reports it (lib/jobs.ts). */
type LessonJob = {
  id: string;
  kind: "learn" | "ahead";
  topic: string;
  status: "running" | "done" | "failed";
  result?: LearnResponse;
  error?: string;
  ref?: string;
  retryable?: boolean;
};

const POLL_MS = 1500;
// Longer than a job can run (the route's 5 minutes) plus slack.
const JOB_WAIT_MS = 7 * 60 * 1000;

/**
 * Waits for a lesson job on the server. The job runs whether or not this page
 * stays open; this only watches it. A brief network failure is retried.
 */
async function waitForJob(id: string): Promise<LearnResponse> {
  const until = Date.now() + JOB_WAIT_MS;
  while (Date.now() < until) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    const res = await fetch(`/api/jobs/${id}`).catch(() => null);
    if (!res) continue; // offline for a moment
    const data = await res.json().catch(() => null);
    if (res.status === 404) throw new AppError("We couldn't find that lesson. Please try again.");
    if (!res.ok || !data?.job) continue;
    const job = data.job as LessonJob;
    if (job.status === "running") continue;
    if (job.status === "failed") throw new AppError(job.error ?? "Something went wrong on our side. Please try again.", job.ref, job.retryable !== false);
    if (job.result) return job.result;
  }
  throw new AppError("This is taking longer than it should. Please try again.");
}

/** Starts (or joins) the server's lesson job for a topic and waits for its result. */
async function runLessonJob(topic: string, ahead = false): Promise<LearnResponse> {
  const response = await fetch("/api/learn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic, ...(ahead ? { ahead: true } : {}) }),
  });
  const data = await readJson(response);
  // Only the server's plain message is shown; it never includes internals.
  if (!response.ok || !data?.job) throw new AppError(data.error ?? "Something went wrong on our side. Please try again.", data.ref, data.retryable !== false);
  return waitForJob((data.job as LessonJob).id);
}

/** The learner's courses and single lessons. A failed half comes back undefined. */
async function fetchLibrary(): Promise<{ courses?: Course[]; lessons?: LessonRow[] }> {
  try {
    const [coursesRes, lessonsRes] = await Promise.all([fetch("/api/courses"), fetch("/api/lessons")]);
    const [coursesData, lessonsData] = await Promise.all([readJson(coursesRes), readJson(lessonsRes)]);
    return {
      courses: coursesRes.ok ? (coursesData.courses ?? []) : undefined,
      lessons: lessonsRes.ok ? (lessonsData.lessons ?? []) : undefined,
    };
  } catch (e) {
    console.error("Failed to load courses", e);
    return {};
  }
}

// ---------- bookmarks (browser-local, per learner) ----------

export type Bookmark = { key: string; topic: string };
// Storage key keeps the app's old name on purpose: renaming it would lose
// bookmarks already saved in learners' browsers.
const BOOKMARK_EVENT = "studybuddy-bookmarks";
const bookmarkStorageKey = (learnerId: string) => `studybuddy:bookmarks:${learnerId}`;

function subscribeBookmarks(onChange: () => void) {
  window.addEventListener(BOOKMARK_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(BOOKMARK_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
function readBookmarksRaw(learnerId: string) {
  if (!learnerId) return "[]";
  try {
    return localStorage.getItem(bookmarkStorageKey(learnerId)) ?? "[]";
  } catch {
    return "[]";
  }
}

// ---------- context ----------

/**
 * A tutor run in progress. The API reports nothing until it finishes, so the
 * UI knows only what kind of run it is and how long it has taken: no stages.
 */
type Busy = {
  topic: string;
  label: string;
  kind: "plan" | "module";
  startedAt: number;
  /** A new course, once its plan is saved: the learner is moved to its page while lesson 1 is written. */
  courseId?: number;
};

// Staging (guide, scenes, lines, and the "Go deeper" resources) per lesson,
// shared by everything that asks, so a lesson is never staged twice at once.
export type Staged = { staging: Staging; resources: Resources | null };
const stagings = new Map<number, Promise<Staged | null>>();

/** Stages a lesson (or repairs its missing paintings); resolves to the staging, or null on failure. */
export function stageLesson(lessonId: number, topic: string): Promise<Staged | null> {
  const pending = stagings.get(lessonId);
  if (pending) return pending;
  const request = fetch("/api/stage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lessonId, topic }),
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => (d?.staging ? { staging: d.staging as Staging, resources: (d.resources as Resources | null) ?? null } : null))
    .catch(() => null)
    .finally(() => stagings.delete(lessonId));
  stagings.set(lessonId, request);
  return request;
}

/** Rejects with an AbortError when `signal` aborts, without cancelling `promise` itself. */
function untilAborted<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(new DOMException("Stopped waiting", "AbortError"));
    if (signal.aborted) return onAbort();
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

export type EarlierProgress = { browserId: string; courses: { topic: string; title: string }[] };

type AppStateValue = {
  /** The signed-in user's id; empty while signed out or still checking. */
  learnerId: string;
  /** null until the session check finishes. */
  signedIn: boolean | null;
  profile: Profile | null;
  updateProfile: (patch: Partial<Omit<Profile, "email" | "avatarUrl" | "onboarded">> & { onboarded?: true; ageConfirmed?: true }) => Promise<void>;
  signOut: () => Promise<void>;
  loaded: boolean;
  courses: Course[];
  library: LessonRow[];
  refresh: () => Promise<void>;
  busy: Busy | null;
  error: ShownError | null;
  clearError: () => void;
  /** Courses this browser made before accounts existed, waiting for the learner to add them or not. */
  earlierProgress: EarlierProgress | null;
  /** Adds (true) or forgets (false) the earlier progress. */
  resolveEarlierProgress: (add: boolean) => Promise<void>;
  /** Set when the learner's plan doesn't cover the lesson they asked for. */
  upgrade: string | null;
  clearUpgrade: () => void;
  /** Stops waiting for the current tutor run (the server may still finish it). */
  cancelLearn: () => void;
  /** Re-runs the request that last failed, if any. */
  retryLearn: (() => void) | null;
  /** Runs the tutor for a topic, then opens the module (or the course page). */
  learn: (topic: string, landing?: "module" | "course") => Promise<void>;
  submitQuiz: (lessonId: number, answers: Answer[]) => Promise<QuizResult>;
  prefetchState: (topic: string) => PrefetchState | undefined;
  /** The course whose next module is being written in the background, if any. */
  backgroundCourse: Course | undefined;
  moduleRun: (courseId: number, moduleIndex: number) => ModuleRun | undefined;
  bookmarks: Bookmark[];
  isBookmarked: (topic: string) => boolean;
  toggleBookmark: (topic: string) => void;
  courseFor: (topic: string) => Course | undefined;
  /** Writes the lesson after the one being taken, in the background, so it's ready on finishing. */
  prepareAhead: (course: Course) => void;
  /** Paints a course's missing world map (once per course per visit). */
  ensureCovers: (course: Course) => void;
  /** Courses whose covers are being painted right now. */
  painting: Set<number>;
};

const AppStateContext = createContext<AppStateValue | null>(null);

/**
 * Starts a course from anywhere: signed in, it plans it right away; signed
 * out, it goes to sign-up first and the topic comes along.
 */
export function useStartCourse() {
  const { signedIn, learn } = useAppState();
  const router = useRouter();
  return (topic: string) => {
    if (!topic.trim()) return;
    if (signedIn) learn(topic, "course");
    else router.push(`/login?mode=signup&topic=${encodeURIComponent(topic.trim())}`);
  };
}

export function useAppState() {
  const value = useContext(AppStateContext);
  if (!value) throw new Error("useAppState must be used inside <AppStateProvider>");
  return value;
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [learnerId, setLearnerId] = useState("");
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [earlierProgress, setEarlierProgress] = useState<EarlierProgress | null>(null);

  const [courses, setCourses] = useState<Course[]>([]);
  const [library, setLibrary] = useState<LessonRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<Busy | null>(null);
  const [error, setError] = useState<ShownError | null>(null);
  const [upgrade, setUpgrade] = useState<string | null>(null);
  const [failed, setFailed] = useState<{ topic: string; landing: "module" | "course" } | null>(null);
  const runAbort = useRef<AbortController | null>(null);
  const [runs, setRuns] = useState<Record<string, ModuleRun>>({});
  // Next modules being written in the background, keyed by topic. A click on
  // "Start Module N" awaits the same request instead of starting a second one.
  const prefetches = useRef(new Map<string, Promise<LearnResponse>>());
  const [prefetching, setPrefetching] = useState<Record<string, PrefetchState>>({});

  // Who's signed in, kept current as they sign in and out.
  useEffect(() => {
    const auth = browserSupabase().auth;
    const apply = (id: string | null) => {
      setSignedIn(!!id);
      setLearnerId(id ?? "");
      if (!id) {
        setCourses([]);
        setLibrary([]);
        setProfile(null);
      }
    };
    auth.getUser().then(({ data }) => apply(data.user?.id ?? null));
    const { data } = auth.onAuthStateChange((_event, session) => apply(session?.user.id ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  const applyLibrary = useCallback((data: Awaited<ReturnType<typeof fetchLibrary>>) => {
    if (data.courses) setCourses(data.courses);
    if (data.lessons) setLibrary(data.lessons);
    setLoaded(true);
  }, []);

  const [painting, setPainting] = useState<Set<number>>(() => new Set());
  const paintRequested = useRef(new Set<number>());
  const ensureCovers = useCallback(
    (course: Course) => {
      const missing = !course.cover;
      if (!missing || !learnerId || paintRequested.current.has(course.id)) return;
      paintRequested.current.add(course.id);
      setPainting((p) => new Set(p).add(course.id));
      fetch("/api/covers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: course.id }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          const fresh: Course | null = data?.course ?? null;
          if (fresh) setCourses((cs) => cs.map((c) => (c.id === fresh.id ? fresh : c)));
        })
        .catch(() => {})
        .finally(() =>
          setPainting((p) => {
            const next = new Set(p);
            next.delete(course.id);
            return next;
          })
        );
    },
    [learnerId]
  );

  const refresh = useCallback(async () => {
    if (learnerId) applyLibrary(await fetchLibrary());
  }, [learnerId, applyLibrary]);

  // On sign-in: see whether this browser holds progress from before accounts
  // (the learner is asked before it moves), then load everything.
  useEffect(() => {
    if (!learnerId) return;
    let cancelled = false;
    (async () => {
      const oldId = readBrowserId();
      if (oldId) {
        const found = await previewBrowserProgress(oldId);
        if (!cancelled) {
          if (found.length) setEarlierProgress({ browserId: oldId, courses: found });
          else forgetBrowserId();
        }
      }
      const [data, prof] = await Promise.all([
        fetchLibrary(),
        fetch("/api/profile")
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);
      if (cancelled) return;
      applyLibrary(data);
      if (prof?.profile) {
        setProfile(prof.profile);
        // The account's voice choice wins on a new device (the lesson player reads it from here).
        try {
          if (localStorage.getItem("agora:voice") === null) localStorage.setItem("agora:voice", prof.profile.voiceOn ? "on" : "off");
        } catch {
          /* storage blocked */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [learnerId, applyLibrary]);

  const updateProfile = useCallback(async (patch: Parameters<AppStateValue["updateProfile"]>[0]) => {
    setProfile((p) => (p ? { ...p, ...patch, onboarded: patch.onboarded ?? p.onboarded } : p));
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error ?? "Couldn't save your settings.");
    setProfile(data.profile);
  }, []);

  const signOut = useCallback(async () => {
    await browserSupabase().auth.signOut();
    router.push("/");
  }, [router]);

  // The tutor runs on the server as a job (it finishes even if this page closes); this waits for it.
  const requestLearn = useCallback((topic: string): Promise<LearnResponse> => runLessonJob(topic), []);

  // Lessons being written ahead, by topic. learn() waits for one before
  // asking for the next lesson, so the same lesson is never written twice.
  const aheadRuns = useRef(new Map<string, Promise<unknown>>());
  const aheadTried = useRef(new Set<string>());
  const setPrefetch = (key: string, state: PrefetchState | null) =>
    setPrefetching((s) => {
      const next = { ...s };
      if (state) next[key] = state;
      else delete next[key];
      return next;
    });

  const rememberRun = (data: LearnResponse) => {
    if (data.kind !== "lesson") return;
    setRuns((r) => ({
      ...r,
      [`${data.course.id}:${data.moduleIndex}`]: {
        lesson: data.lesson,
        lessonId: data.lessonId,
        score: typeof data.score === "number" ? data.score : null,
        status: { passed: data.passed, saved: data.saved, resumed: data.resumed },
        tutorNote: data.tutorNote,
        trace: data.trace,
      },
    }));
  };

  /** Starts writing a course's next module in the background. */
  const prefetchNext = (courseTopic: string) => {
    const key = topicKey(courseTopic);
    if (prefetches.current.has(key)) return;
    // If it's already being written ahead, that run finishes first and this one just picks it up.
    const request = (aheadRuns.current.get(key) ?? Promise.resolve()).then(() => requestLearn(courseTopic));
    prefetches.current.set(key, request);
    setPrefetch(key, "pending");
    request.then(
      (data) => {
        rememberRun(data);
        setPrefetch(key, "ready");
        refresh();
      },
      () => {
        // Forget a failed prefetch; clicking "Start" will simply try again.
        prefetches.current.delete(key);
        setPrefetch(key, null);
      }
    );
  };

  const prepareAhead = (course: Course) => {
    const key = topicKey(course.topic);
    const next = course.modules[course.currentModule + 1];
    const attempt = `${course.id}:${course.currentModule}`;
    if (course.status !== "active" || !course.modules[course.currentModule]?.lesson || !next || next.lesson || aheadTried.current.has(attempt)) return;
    aheadTried.current.add(attempt); // once per lesson per visit, even if it fails
    const run = runLessonJob(course.topic, true)
      .then((data) => {
        if (data.kind !== "lesson") return;
        rememberRun(data);
        // Set its scene too, so opening it is instant.
        if (data.lessonId && !data.lesson.staging) stageLesson(data.lessonId, course.topic);
        refresh();
      })
      .catch(() => {})
      .finally(() => aheadRuns.current.delete(key));
    aheadRuns.current.set(key, run);
  };

  // Jobs still running on the server from an earlier visit (or a closed tab):
  // follow them, so the course shows the lesson being written and updates when
  // it's done. They'd finish anyway; this only shows it.
  useEffect(() => {
    if (!learnerId) return;
    let stopped = false;
    fetch("/api/jobs")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { jobs?: LessonJob[] } | null) => {
        for (const job of data?.jobs ?? []) {
          if (stopped) return;
          const key = topicKey(job.topic);
          const follow = waitForJob(job.id);
          if (job.kind === "ahead") {
            aheadRuns.current.set(key, follow.then(() => refresh()).catch(() => {}).finally(() => aheadRuns.current.delete(key)));
            continue;
          }
          if (prefetches.current.has(key)) continue;
          prefetches.current.set(key, follow);
          setPrefetch(key, "pending");
          follow.then(
            (result) => {
              rememberRun(result);
              setPrefetch(key, "ready");
              refresh();
            },
            () => {
              prefetches.current.delete(key);
              setPrefetch(key, null);
            }
          );
        }
      })
      .catch(() => {});
    return () => {
      stopped = true;
    };
    // Once per sign-in; the helpers it calls only read refs and set state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [learnerId]);

  const courseFor = (topic: string) => courses.find((c) => topicKey(c.topic) === topicKey(topic));

  const learn = async (topic: string, landing: "module" | "course" = "module") => {
    if (!topic.trim() || busy) return;
    const key = topicKey(topic);
    const existing = courseFor(topic);
    setBusy({
      topic,
      kind: existing ? "module" : "plan",
      startedAt: Date.now(),
      label: existing
        ? `Preparing ${moduleLabel(levelsOf(existing), Math.min(existing.currentModule, existing.modules.length - 1))} of ${existing.title}`
        : `Planning a course on ${topic.trim()}`,
    });
    setError(null);
    setFailed(null);
    const abort = new AbortController();
    runAbort.current = abort;
    const prefetched = prefetches.current.get(key);
    prefetches.current.delete(key);
    setPrefetch(key, null);
    // A new course: as soon as its plan is saved, show it, and write lesson 1 there.
    let landed: number | null = null;
    const watch = existing
      ? null
      : setInterval(async () => {
          const found = (await fetchLibrary()).courses?.find((c) => topicKey(c.topic) === key);
          if (!found || landed !== null || abort.signal.aborted) return;
          landed = found.id;
          setCourses((cs) => [found, ...cs.filter((c) => c.id !== found.id)]);
          setBusy((b) => (b ? { ...b, courseId: found.id, label: `Writing lesson 1 of ${found.title}` } : b));
          router.push(`/courses/${found.id}`);
        }, 3000);
    try {
      await aheadRuns.current.get(key);
      const request = prefetched ? prefetched.catch(() => requestLearn(topic)) : requestLearn(topic);
      const data = await untilAborted(request, abort.signal);
      if (data.kind === "nothing_ahead") throw new AppError("Something went wrong on our side. Please try again.");
      if (data.kind === "upgrade_required") {
        setUpgrade(data.message);
        if (data.course && landed === null) router.push(`/courses/${data.course.id}`);
        return;
      }
      rememberRun(data);
      await refresh();
      if (data.kind === "lesson" && data.lessonId && !data.lesson.staging) stageLesson(data.lessonId, data.course.topic);
      if (landed !== null) {
        // Already on the course page, which now offers lesson 1.
      } else if (data.kind === "course_complete" || landing === "course") {
        router.push(`/courses/${data.course.id}`);
      } else {
        router.push(`/courses/${data.course.id}/${data.moduleIndex + 1}`);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // The server keeps going: whatever it finishes is saved and shows up
        // on the next visit (an unfinished module resumes without new work).
        setTimeout(() => refresh(), 30_000);
      } else {
        setError(
          err instanceof AppError
            ? { message: err.message, ref: err.ref, retryable: err.retryable }
            : // A network failure or anything unexpected: never show its raw text.
              { message: "We couldn't reach Wondersity. Check your connection and try again.", retryable: true }
        );
        setFailed({ topic, landing });
      }
    } finally {
      if (watch) clearInterval(watch);
      runAbort.current = null;
      setBusy(null);
    }
  };

  const submitQuiz = async (lessonId: number, answers: Answer[]): Promise<QuizResult> => {
    const response = await fetch("/api/attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId, answers }),
    });
    const data = await readJson(response);
    if (!response.ok) throw new AppError(data.error ?? "Couldn't save your answers. Please try again.", data.ref);
    const result = data as QuizResult;
    // If finishing this quiz unlocked a module that isn't written yet, start
    // writing it now; the tutor already sees these answers.
    const next = result.course?.status === "active" ? result.course.modules[result.course.currentModule] : null;
    if (result.course && next && !next.lesson) prefetchNext(result.course.topic);
    refresh();
    return result;
  };

  // Bookmarks live in localStorage per learner; the raw string is the snapshot
  // (stable between changes), parsed once per change.
  const bookmarksRaw = useSyncExternalStore(
    subscribeBookmarks,
    () => readBookmarksRaw(learnerId),
    () => "[]"
  );
  const bookmarks = useMemo<Bookmark[]>(() => {
    try {
      const parsed = JSON.parse(bookmarksRaw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [bookmarksRaw]);

  const toggleBookmark = (topic: string) => {
    const key = topicKey(topic);
    const next = bookmarks.some((b) => b.key === key)
      ? bookmarks.filter((b) => b.key !== key)
      : [...bookmarks, { key, topic: topic.trim() }];
    try {
      localStorage.setItem(bookmarkStorageKey(learnerId), JSON.stringify(next));
    } catch {
      /* storage blocked: bookmarks just won't persist */
    }
    window.dispatchEvent(new Event(BOOKMARK_EVENT));
  };

  const pendingKey = Object.entries(prefetching).find(([, s]) => s === "pending")?.[0];

  const value: AppStateValue = {
    prepareAhead,
    signedIn,
    profile,
    updateProfile,
    signOut,
    ensureCovers,
    painting,
    learnerId,
    // Signed out there is nothing to load.
    loaded: loaded || signedIn === false,
    courses,
    library,
    refresh,
    busy,
    error,
    earlierProgress,
    resolveEarlierProgress: async (add) => {
      const pending = earlierProgress;
      setEarlierProgress(null);
      if (!pending) return;
      if (add && learnerId) {
        if (await claimBrowserProgress(learnerId, pending.browserId)) await refresh();
      } else {
        forgetBrowserId();
      }
    },
    upgrade,
    clearUpgrade: () => setUpgrade(null),
    clearError: () => {
      setError(null);
      setFailed(null);
    },
    cancelLearn: () => runAbort.current?.abort(),
    retryLearn: failed && !busy ? () => learn(failed.topic, failed.landing) : null,
    learn,
    submitQuiz,
    prefetchState: (topic) => prefetching[topicKey(topic)],
    backgroundCourse: pendingKey ? courses.find((c) => topicKey(c.topic) === pendingKey) : undefined,
    moduleRun: (courseId, moduleIndex) => runs[`${courseId}:${moduleIndex}`],
    bookmarks,
    isBookmarked: (topic) => bookmarks.some((b) => b.key === topicKey(topic)),
    toggleBookmark,
    courseFor,
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}
