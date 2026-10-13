// The Review page: every check a learner got wrong the first time, to try
// again. Trying again is practice: the first answer stays as it was graded
// (attempts are never changed), and a right answer now marks the question
// cleared (review_clears). The right answer isn't sent until the question is
// cleared or the learner asks for it. Pure functions only.

import { lessonBlocks, type Lesson } from "./lessonBlocks";

export type ReviewItem = {
  lessonId: number;
  questionIndex: number;
  courseId: number | null;
  /** The course's title, or the lesson's topic for a lesson outside a course. */
  courseTitle: string;
  lessonTitle: string;
  /** 1-based position in its course, when it's on the course's path. */
  lessonNumber: number | null;
  question: string;
  options: string[];
  /** What they chose the first time. */
  chosen: string;
  hints: string[];
  missedAt: string;
  clearedAt: string | null;
  /** Only once cleared. */
  answer: { correct: string; explanation: string } | null;
};

type Row = {
  id: number;
  course_id: number | null;
  module_index: number | null;
  lesson_data: Lesson;
  attempts: { question_index: number; chosen: string; correct: boolean; created_at: string }[];
};

export function reviewItems(rows: Row[], titles: Map<number, string>, clears: Map<string, string>): ReviewItem[] {
  const items: ReviewItem[] = [];
  for (const row of rows) {
    const lesson = row.lesson_data;
    const blocks = lessonBlocks(lesson);
    for (const a of row.attempts) {
      if (a.correct) continue;
      const q = lesson.questions?.[a.question_index];
      if (!q) continue;
      const check = blocks.find((b) => b.kind === "check" && b.ref === a.question_index);
      const clearedAt = clears.get(`${row.id}:${a.question_index}`) ?? null;
      items.push({
        lessonId: row.id,
        questionIndex: a.question_index,
        courseId: row.course_id,
        courseTitle: (row.course_id !== null ? titles.get(row.course_id) : undefined) ?? lesson.title,
        lessonTitle: lesson.title,
        lessonNumber: row.module_index !== null ? row.module_index + 1 : null,
        question: q.question,
        options: q.options,
        chosen: a.chosen,
        hints: check?.kind === "check" ? check.hints : [],
        missedAt: a.created_at,
        clearedAt,
        answer: clearedAt ? { correct: q.correctAnswer, explanation: q.explanation } : null,
      });
    }
  }
  // Still to clear first, newest mistakes first within each group.
  return items.sort((x, y) => Number(!!x.clearedAt) - Number(!!y.clearedAt) || y.missedAt.localeCompare(x.missedAt));
}

/** Grades a second try at a question: right or wrong, and what to show. */
export function gradeRetry(lesson: Lesson, questionIndex: number, chosen: string, reveal = false) {
  const q = lesson.questions?.[questionIndex];
  if (!q || (!reveal && !q.options.includes(chosen))) return null;
  const correct = !reveal && chosen === q.correctAnswer;
  const check = lessonBlocks(lesson).find((b) => b.kind === "check" && b.ref === questionIndex);
  return {
    correct,
    // A wrong try gets the lesson's other way of explaining it, never the answer.
    retry: !correct && !reveal && check?.kind === "check" ? check.retry || null : null,
    answer: correct || reveal ? { correct: q.correctAnswer, explanation: q.explanation } : null,
  };
}
