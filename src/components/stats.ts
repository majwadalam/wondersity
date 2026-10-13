import { streakFrom } from "@/lib/streak";
import type { Course } from "./types";

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Everything the dashboard shows, derived from the learner's real courses. */
export function learningStats(courses: Course[], now = new Date()) {
  let totalModules = 0;
  let doneModules = 0;
  let correct = 0;
  let answered = 0;
  const finishedAt: string[] = [];
  const doneToday: { course: Course; moduleIndex: number }[] = [];

  for (const course of courses) {
    totalModules += course.modules.length;
    course.modules.forEach((m, i) => {
      const lesson = m.lesson;
      if (!lesson?.completed) return;
      doneModules++;
      if (lesson.quiz) {
        correct += lesson.quiz.correct;
        answered += lesson.quiz.total;
      }
      if (lesson.completedAt) {
        finishedAt.push(lesson.completedAt);
        if (dayKey(new Date(lesson.completedAt)) === dayKey(now)) doneToday.push({ course, moduleIndex: i });
      }
    });
    // Lessons from before a course was started over still count for the streak.
    finishedAt.push(...(course.pastCompletions ?? []));
  }

  // The same streak the server keeps (lib/streak.ts, freeze included), in this browser's time zone.
  const { streak, frozen } = streakFrom(finishedAt, Intl.DateTimeFormat().resolvedOptions().timeZone, now);

  return {
    totalModules,
    doneModules,
    percent: totalModules ? Math.round((doneModules / totalModules) * 100) : 0,
    accuracy: answered ? Math.round((correct / answered) * 100) : null,
    streak,
    /** Days the weekly streak freeze bridged, newest first. */
    frozen,
    doneToday,
  };
}

/** Course lessons, most recently touched first. */
export function recentLessons(courses: Course[], limit = 5) {
  return courses
    .flatMap((course) =>
      course.modules.flatMap((m, moduleIndex) =>
        m.lesson
          ? [{ course, moduleIndex, lesson: m.lesson, at: m.lesson.completedAt ?? m.lesson.createdAt }]
          : []
      )
    )
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
}

export function timeAgo(iso: string, now = Date.now()) {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? "1d ago" : `${d}d ago`;
}

export function greeting(hour: number) {
  if (hour < 5) return "Burning the midnight oil";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
