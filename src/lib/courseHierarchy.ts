// A course is a journey of levels; each level groups modules; each module
// holds its lesson (whose blocks are the activities).
//
// Storage stays one ordered list of modules (courses.modules), so everything
// keyed by a module's position keeps working unchanged: lessons.module_index,
// courses.current_module, grading, progression and the /courses/[id]/[n]
// URLs. Each module written since levels existed also carries a stable id and
// its level; levels are rebuilt from that list when a course is shown.
//
// Courses planned before levels have no level data. They are shown as one
// unlabelled path (`legacy: true`), never split into invented levels.
//
// Pure and dependency-free: shared by the server and the browser.

export type LevelInfo = {
  /** Stable within the course, e.g. "level-2". */
  id: string;
  title: string;
  description: string;
  /** What the learner can do once the level is finished. */
  objective: string;
  /** Tailored courses: the course outcome this level builds toward. */
  outcome?: string;
};

/** One entry of courses.modules. Only title and goal exist on older courses. */
export type StoredModule = {
  title: string;
  /** The module's learning objective. */
  goal: string;
  /** Stable within the course, e.g. "level-2-module-1". */
  id?: string;
  description?: string;
  level?: LevelInfo;
  /** Cover illustration URL, once generated (see lib/coverArt.ts). */
  cover?: string;
  /** Tailored courses: the things the learner asked to cover that this module covers. */
  covers?: string[];
};

export type LevelGroup = LevelInfo & {
  /** 0-based position of the level in the course. */
  index: number;
  /** Positions (in courses.modules) of this level's modules, in order. */
  modules: number[];
  /** True for courses planned before levels: one group, no level title. */
  legacy: boolean;
};

const isLevel = (l: unknown): l is LevelInfo =>
  !!l &&
  typeof l === "object" &&
  typeof (l as LevelInfo).id === "string" &&
  (l as LevelInfo).id.length > 0 &&
  typeof (l as LevelInfo).title === "string";

function legacyGroup(count: number): LevelGroup[] {
  return [
    {
      id: "level-1",
      title: "",
      description: "",
      objective: "",
      index: 0,
      modules: Array.from({ length: count }, (_, i) => i),
      legacy: true,
    },
  ];
}

/**
 * Groups a course's ordered modules into levels. A level's modules must be
 * consecutive; if any module lacks level data, or a level is split, the
 * course is shown as a single legacy path rather than guessing.
 */
export function groupLevels(modules: StoredModule[]): LevelGroup[] {
  if (modules.length === 0 || !modules.every((m) => isLevel(m.level))) return legacyGroup(modules.length);
  const groups: LevelGroup[] = [];
  for (let i = 0; i < modules.length; i++) {
    const level = modules[i].level!;
    const last = groups[groups.length - 1];
    if (last && last.id === level.id) {
      last.modules.push(i);
      continue;
    }
    if (groups.some((g) => g.id === level.id)) return legacyGroup(modules.length);
    groups.push({
      id: level.id,
      title: level.title,
      description: typeof level.description === "string" ? level.description : "",
      objective: typeof level.objective === "string" ? level.objective : "",
      index: groups.length,
      modules: [i],
      legacy: false,
    });
  }
  return groups;
}

/** A module's stable id; older courses get one from their (fixed) position. */
export const moduleId = (m: StoredModule, index: number) => (typeof m.id === "string" && m.id ? m.id : `module-${index + 1}`);

/** Where a module sits: its level and its 1-based number within that level. */
export function modulePlace(levels: Pick<LevelGroup, "modules" | "legacy">[], index: number) {
  const level = levels.findIndex((l) => l.modules.includes(index));
  const number = level >= 0 ? levels[level].modules.indexOf(index) + 1 : index + 1;
  return { level, number, legacy: level < 0 || levels[level].legacy };
}

/** "Level 2 · Module 1", or "Module 4" for a course without levels. */
export function moduleLabel(levels: Pick<LevelGroup, "modules" | "legacy">[], index: number) {
  const p = modulePlace(levels, index);
  return p.legacy ? `Module ${index + 1}` : `Level ${p.level + 1} · Module ${p.number}`;
}

/**
 * The label learners see. Lessons are numbered across the whole course, the
 * same as the course map ("Level 2 · Lesson 4"), or "Lesson 4" without levels.
 */
export function lessonLabel(levels: Pick<LevelGroup, "modules" | "legacy">[], index: number) {
  const p = modulePlace(levels, index);
  return p.legacy ? `Lesson ${index + 1}` : `Level ${p.level + 1} · Lesson ${index + 1}`;
}

type LevelLike = Pick<LevelGroup, "id" | "title" | "description" | "objective" | "modules" | "legacy"> & {
  status?: "done" | "current" | "upcoming";
  prerequisite?: string | null;
};

/**
 * A course's levels as the browser received them, or, if the data has none
 * (a response from before levels existed), one legacy path over all modules.
 */
export function levelsOf<T extends LevelLike>(course: { levels?: T[]; modules: unknown[] }): T[] {
  if (Array.isArray(course.levels) && course.levels.length > 0) return course.levels;
  return legacyGroup(course.modules.length).map((g) => ({ ...g, status: "upcoming", prerequisite: null })) as unknown as T[];
}
