// What a finished quiz can earn besides progress: a longer streak (with a
// notification at milestones) and, when it completes the course, a
// certificate. Called by /api/attempts after grading; everything here comes
// from saved completions, never from the browser.

import { randomBytes } from "node:crypto";
import { groupLevels } from "./courseHierarchy";
import * as db from "./db";
import { notify } from "./notify";
import { STREAK_MILESTONES, streakFrom } from "./streak";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** A certificate id: 14 characters from 56, unguessable (about 81 bits). */
export function certificateId() {
  return [...randomBytes(14)].map((b) => ALPHABET[b % ALPHABET.length]).join("");
}

/**
 * Issues the certificate for a completed course (once: a course already
 * certified keeps its first certificate). The name is the learner's display
 * name when they issued it.
 */
export async function issueCertificate(learnerId: string, courseId: number) {
  const existing = await db.getCertificateForCourse(courseId);
  if (existing) return { certificate: existing, issued: false };
  const course = await db.getCourseById(courseId, learnerId);
  if (!course || course.status !== "completed") return { certificate: null, issued: false };
  const [name, lessons] = await Promise.all([db.learnerName(learnerId), db.getCourseAttempts(courseId)]);
  const answers = lessons.flatMap((l) => l.attempts);
  const finished = course.lessons.filter((l) => l.completed_at);
  const levels = groupLevels(course.modules).filter((g) => !g.legacy).map((g) => g.title);
  const certificate = await db.insertCertificate({
    id: certificateId(),
    learner_id: learnerId,
    course_id: course.id,
    learner_name: name,
    course_title: course.title,
    topic: course.topic,
    levels,
    lessons: course.modules.length,
    minutes: course.lessons.reduce((n, l) => n + (l.lesson_data.estimatedMinutes ?? 8), 0),
    accuracy: answers.length ? Math.round((answers.filter((a) => a.correct).length / answers.length) * 100) : null,
    completed_at: finished.map((l) => l.completed_at!).sort().at(-1) ?? new Date().toISOString(),
  });
  return { certificate, issued: !!certificate };
}

export type QuizRewards = { streak: number; streakMilestone: boolean; certificateId: string | null };

/** After a first completion: the streak (and its milestone), and the certificate if the course is done. */
export async function rewardsAfterQuiz(learnerId: string, course: { id: number; title: string; status: string } | null): Promise<QuizRewards> {
  const [profile, times] = await Promise.all([db.getProfileBasics(learnerId).catch(() => null), db.completionTimes(learnerId)]);
  const { streak } = streakFrom(times, profile?.timezone);
  // A milestone counts the first time it's reached today: the lesson just finished was today's first.
  const todays = times.filter((t) => streakFrom([t], profile?.timezone).doneToday).length;
  const streakMilestone = todays === 1 && STREAK_MILESTONES.includes(streak);
  if (streakMilestone) {
    await notify(learnerId, { kind: "streak", title: `${streak}-day streak`, body: `You've learned something ${streak} days in a row. Keep it going tomorrow.`, href: "/progress" });
  }
  let certificateId: string | null = null;
  if (course?.status === "completed") {
    const { certificate, issued } = await issueCertificate(learnerId, course.id);
    certificateId = certificate?.id ?? null;
    if (issued && certificate) {
      await notify(learnerId, {
        kind: "certificate",
        title: "Your certificate is ready",
        body: `You completed ${certificate.course_title}. Share your certificate anywhere.`,
        href: `/certificate/${certificate.id}`,
      });
    }
  }
  return { streak, streakMilestone, certificateId };
}
