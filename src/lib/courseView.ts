import { groupLevels, moduleId } from "./courseHierarchy";
import type { CourseWithLessons } from "./db";
import type { Lesson } from "./lessonWriter";

export type LevelStatus = "done" | "current" | "upcoming";

/**
 * The client-facing shape of a course: levels, the ordered modules they
 * group (positions match lessons.module_index and currentModule), and each
 * module's lesson.
 */
export type CourseView = {
  id: number;
  topic: string;
  title: string;
  description: string;
  status: "active" | "completed";
  currentModule: number;
  /** Cover illustration URL, once generated; otherwise the UI picks built-in art. */
  cover: string | null;
  /** The road traced in the world (% of the picture); [] when tracing failed (the default curve is drawn); null until traced. */
  road: { x: number; y: number }[] | null;
  updatedAt: string;
  /** Set when the learner tailored the course: their goal, the outcomes planned from it, their materials. */
  tailored: { goal: string; outcomes: string[]; materials: string[] } | null;
  levels: {
    id: string;
    title: string;
    description: string;
    objective: string;
    /** Positions in `modules`, in order. */
    modules: number[];
    /** Derived from saved completions only: done = every module's lesson completed. */
    status: LevelStatus;
    /** The level that must be finished first, if any. */
    prerequisite: string | null;
    /** A course planned before levels: one unlabelled group. */
    legacy: boolean;
  }[];
  modules: {
    id: string;
    title: string;
    goal: string;
    description: string;
    /** Index into `levels`. */
    level: number;
    /** The lesson's first painted scene (or an older stored cover); null until staged. */
    cover: string | null;
    lesson: {
      id: number;
      score: number | null;
      completed: boolean;
      createdAt: string;
      completedAt: string | null;
      /** First-attempt quiz result, once the module is done. */
      quiz: { correct: number; total: number } | null;
      data: Lesson;
    } | null;
  }[];
};

export function toCourseView(course: CourseWithLessons): CourseView {
  const groups = groupLevels(course.modules ?? []);
  const modules: CourseView["modules"] = course.modules.map((m, i) => {
    const lesson = shownLessonForModule(course, i);
    return {
      id: moduleId(m, i),
      title: m.title,
      goal: m.goal,
      description: typeof m.description === "string" ? m.description : "",
      level: groups.findIndex((g) => g.modules.includes(i)),
      // Courses painted before lessons shared their scenes kept a separate cover.
      cover: typeof m.cover === "string" ? m.cover : (lesson?.lesson_data.staging?.images.find((img) => img.url)?.url ?? null),
      lesson: lesson
        ? {
            id: lesson.id,
            score: lesson.score,
            completed: !!lesson.completed_at,
            createdAt: lesson.created_at,
            completedAt: lesson.completed_at,
            quiz: lesson.attempts?.length
              ? { correct: lesson.attempts.filter((a) => a.correct).length, total: lesson.attempts.length }
              : null,
            data: lesson.lesson_data,
          }
        : null,
    };
  });

  return {
    id: course.id,
    topic: course.topic,
    title: course.title,
    description: course.description,
    status: course.status,
    currentModule: course.current_module,
    cover: course.cover_url ?? null,
    road: course.world_road ?? null,
    updatedAt: course.updated_at,
    tailored: course.intake
      ? {
          goal: course.intake.goal,
          outcomes: course.outcomes ?? [],
          materials: course.intake.materials?.map((m) => m.name) ?? [],
        }
      : null,
    levels: groups.map((g, gi) => ({
      id: g.id,
      title: g.title,
      description: g.description,
      objective: g.objective,
      modules: g.modules,
      status: g.modules.every((i) => modules[i].lesson?.completed)
        ? "done"
        : course.status === "active" && g.modules.includes(course.current_module)
          ? "current"
          : "upcoming",
      prerequisite: gi > 0 ? groups[gi - 1].id : null,
      legacy: g.legacy,
    })),
    modules,
  };
}

/**
 * The lesson the learner sees for a module: the newest, except for a module
 * the course has already moved past, where the completed copy wins (so a
 * finished module stays finished even if a newer copy was written later).
 */
export function shownLessonForModule(course: CourseWithLessons, moduleIndex: number) {
  const forModule = course.lessons.filter((l) => l.module_index === moduleIndex).sort((a, b) => b.id - a.id);
  const passed = moduleIndex < course.current_module || course.status === "completed";
  return (passed ? forModule.find((l) => l.completed_at) : undefined) ?? forModule[0] ?? null;
}

export function latestLessonForModule(course: CourseWithLessons, moduleIndex: number) {
  return (
    course.lessons
      .filter((l) => l.module_index === moduleIndex)
      .sort((a, b) => b.id - a.id)[0] ?? null
  );
}
