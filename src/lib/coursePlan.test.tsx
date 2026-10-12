import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CoursePath } from "@/components/CoursePath";
import { groupLevels, levelsOf, moduleLabel, type StoredModule } from "./courseHierarchy";
import { parseCoursePlan } from "./coursePlan";
import { toCourseView } from "./courseView";
import type { CourseWithLessons, LessonRow } from "./db";
import { question } from "./testFixtures";

// ---------- fixtures ----------

const mod = (title: string) => ({ title, goal: `Be able to explain ${title}.`, description: `Covers ${title} in depth.` });
const level = (title: string, modules: string[]) => ({
  title,
  description: `A stage about ${title}.`,
  objective: `Use ${title} confidently.`,
  modules: modules.map(mod),
});

function rawPlan() {
  return {
    title: "Thinking in Systems",
    cover_url: null,
    description: "From parts and flows to leverage points.",
    levels: [
      level("Seeing the parts", ["Stocks and flows", "Feedback loops"]),
      level("Behaviour over time", ["Delays", "Oscillation", "Overshoot and collapse"]),
      level("Changing systems", ["Leverage points", "Designing interventions"]),
    ],
  };
}

function plan() {
  const r = parseCoursePlan(rawPlan());
  if (!r.ok) assert.fail(r.error);
  return r.plan;
}

let nextId = 100;
function lessonRow(moduleIndex: number, completed: boolean, correct: boolean[] = []): LessonRow {
  return {
    id: nextId++,
    course_id: 1,
    module_index: moduleIndex,
    topic: "t",
    score: 9,
    created_at: "2026-10-01T00:00:00Z",
    completed_at: completed ? "2026-10-02T00:00:00Z" : null,
    lesson_data: { title: "L", objective: "o", estimatedMinutes: 8, questions: [question(1), question(2)] },
    attempts: correct.map((c) => ({ correct: c })),
  };
}

function courseRow(modules: StoredModule[], currentModule: number, lessons: LessonRow[], status: "active" | "completed" = "active"): CourseWithLessons {
  return {
    id: 1,
    learner_id: "learner-x",
    topic: "Systems",
    topic_key: "systems",
    title: "Thinking in Systems",
    cover_url: null,
    description: "d",
    modules,
    current_module: currentModule,
    status,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-02T00:00:00Z",
    lessons,
  };
}

// ---------- plan validation ----------

describe("parseCoursePlan", () => {
  it("flattens levels into ordered modules with stable ids", () => {
    const p = plan();
    assert.equal(p.modules.length, 7);
    assert.deepEqual(
      p.modules.map((m) => m.id),
      ["level-1-module-1", "level-1-module-2", "level-2-module-1", "level-2-module-2", "level-2-module-3", "level-3-module-1", "level-3-module-2"]
    );
    assert.equal(p.modules[2].level?.title, "Behaviour over time");
    assert.equal(p.modules[2].level?.objective, "Use Behaviour over time confidently.");
    assert.equal(p.modules[0].description, "Covers Stocks and flows in depth.");
  });

  it("is deterministic, so the same plan gets the same ids", () => {
    assert.deepEqual(plan(), plan());
  });

  it("strips 'Level 2:' prefixes from level titles", () => {
    const raw = rawPlan();
    raw.levels[1].title = "Level 2: Behaviour over time";
    const r = parseCoursePlan(raw);
    assert.ok(r.ok && r.plan.modules[2].level?.title === "Behaviour over time");
  });

  const rejects = (mutate: (p: ReturnType<typeof rawPlan>) => unknown, match: RegExp) => {
    const raw = rawPlan();
    const r = parseCoursePlan(mutate(raw) ?? raw);
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, match);
  };

  it("rejects a course with a single level", () => {
    rejects((p) => ({ ...p, levels: [level("Everything", ["A one", "B two", "C three", "D four"])] }), /levels/);
  });

  it("rejects a level with only one module", () => {
    rejects((p) => void (p.levels[0].modules = [mod("Only one")]), /modules/);
  });

  it("rejects too many modules in total", () => {
    rejects(
      (p) => ({
        ...p,
        levels: ["A", "B", "C", "D"].map((l) => level(`Stage ${l} topics`, [1, 2, 3, 4].map((n) => `${l} part ${n}`))),
      }),
      /16 modules in total/
    );
  });

  it("rejects levels that are only numbered, and duplicates", () => {
    rejects((p) => void (p.levels[0].title = "Level 1"), /name what the level is about/);
    rejects((p) => void (p.levels[1].modules[0].title = "Stocks and flows"), /module titles must be distinct/);
    rejects((p) => void (p.levels[2].title = "Seeing the parts"), /level titles must be distinct/);
  });

  it("rejects missing or malformed fields", () => {
    rejects((p) => void delete (p.levels[0] as Partial<(typeof p.levels)[0]>).objective, /objective/);
    rejects((p) => void (p.levels[0].modules[0].goal = "short"), /goal/);
    for (const bad of [null, "plan", {}, { title: "x", description: "y", modules: [] }]) {
      assert.equal(parseCoursePlan(bad).ok, false);
    }
  });
});

// ---------- grouping and the course view ----------

describe("groupLevels", () => {
  it("groups consecutive modules by level", () => {
    const groups = groupLevels(plan().modules);
    assert.deepEqual(groups.map((g) => g.modules), [[0, 1], [2, 3, 4], [5, 6]]);
    assert.ok(groups.every((g) => !g.legacy));
  });

  it("treats a course planned before levels as one legacy path", () => {
    const legacy = [{ title: "A", goal: "g" }, { title: "B", goal: "g" }, { title: "C", goal: "g" }];
    const groups = groupLevels(legacy);
    assert.equal(groups.length, 1);
    assert.ok(groups[0].legacy);
    assert.deepEqual(groups[0].modules, [0, 1, 2]);
  });

  it("falls back to one path rather than guessing when level data is inconsistent", () => {
    const modules = plan().modules;
    // Level 1 split around level 2.
    const split = [modules[0], modules[2], modules[1]];
    assert.ok(groupLevels(split)[0].legacy);
    // One module missing its level.
    assert.ok(groupLevels([...modules.slice(0, 3), { title: "x", goal: "g" }])[0].legacy);
    assert.equal(groupLevels([]).length, 1);
  });

  it("labels modules by level, or by position without levels", () => {
    const groups = groupLevels(plan().modules);
    assert.equal(moduleLabel(groups, 0), "Level 1 · Module 1");
    assert.equal(moduleLabel(groups, 4), "Level 2 · Module 3");
    assert.equal(moduleLabel(groupLevels([{ title: "A", goal: "g" }]), 0), "Module 1");
  });
});

describe("toCourseView", () => {
  it("gives the browser levels, module ids and level statuses from saved progress", () => {
    const view = toCourseView(courseRow(plan().modules, 3, [lessonRow(0, true, [true, true]), lessonRow(1, true, [true, false]), lessonRow(2, true), lessonRow(3, false)]));
    assert.deepEqual(view.levels.map((l) => l.status), ["done", "current", "upcoming"]);
    assert.deepEqual(view.levels.map((l) => l.prerequisite), [null, "level-1", "level-2"]);
    assert.equal(view.modules[3].id, "level-2-module-2");
    assert.equal(view.modules[3].level, 1);
    assert.equal(view.modules[1].lesson?.quiz?.correct, 1);
    assert.equal(view.currentModule, 3);
  });

  it("keeps an old course's modules, progress and quiz history exactly as saved", () => {
    const legacy = [
      { title: "What addition means", goal: "g1" },
      { title: "Within 10", goal: "g2" },
      { title: "Make ten", goal: "g3" },
    ];
    const lessons = [lessonRow(0, true, [true, false, true]), lessonRow(1, false)];
    const view = toCourseView(courseRow(legacy, 1, lessons));
    assert.equal(view.levels.length, 1);
    assert.ok(view.levels[0].legacy);
    assert.equal(view.levels[0].status, "current");
    assert.deepEqual(view.modules.map((m) => m.id), ["module-1", "module-2", "module-3"]);
    assert.deepEqual(view.modules.map((m) => m.lesson?.completed ?? null), [true, false, null], "no invented completions");
    assert.deepEqual(view.modules[0].lesson?.quiz, { correct: 2, total: 3 });
    assert.equal(view.currentModule, 1);
    assert.equal(view.modules[0].description, "");
  });

  it("marks a level done only when every module's lesson is completed", () => {
    // The course pointer is past level 1, but one of its lessons was never completed.
    const view = toCourseView(courseRow(plan().modules, 2, [lessonRow(0, true)]));
    assert.equal(view.levels[0].status, "upcoming");
    assert.equal(view.levels[1].status, "current");
  });

  it("uses the newest lesson when a module has several", () => {
    const older = lessonRow(0, true);
    const newer = lessonRow(0, false);
    const view = toCourseView(courseRow(plan().modules, 0, [older, newer]));
    assert.equal(view.modules[0].lesson?.id, newer.id);
  });

  it("keeps a passed module's completed lesson even if a newer copy was written", () => {
    const older = lessonRow(0, true);
    const newer = lessonRow(0, false);
    const view = toCourseView(courseRow(plan().modules, 1, [older, newer]));
    assert.equal(view.modules[0].lesson?.id, older.id);
    assert.equal(view.modules[0].lesson?.completed, true);
  });
});

describe("CoursePath", () => {
  it("groups the path by level for new courses and stays flat for old ones", () => {
    const leveled = renderToStaticMarkup(
      <CoursePath course={toCourseView(courseRow(plan().modules, 2, [lessonRow(0, true), lessonRow(1, true), lessonRow(2, false)]))} activeIndex={2} onOpenModule={() => {}} />
    );
    assert.ok(leveled.includes("Behaviour over time"));
    assert.ok(leveled.includes('aria-label="Level 3: Changing systems"'));
    const flat = renderToStaticMarkup(
      <CoursePath course={toCourseView(courseRow([{ title: "A one", goal: "g" }, { title: "B two", goal: "g" }], 0, []))} activeIndex={null} onOpenModule={() => {}} />
    );
    assert.ok(!flat.includes("L1 ·"));
    assert.ok(flat.includes("A one"));
  });
});

describe("levelsOf (browser data without levels)", () => {
  it("treats a course response from before levels as one path instead of crashing", () => {
    const stale = { ...toCourseView(courseRow([{ title: "A one", goal: "g" }, { title: "B two", goal: "g" }], 0, [])), levels: undefined };
    const levels = levelsOf(stale);
    assert.equal(levels.length, 1);
    assert.ok(levels[0].legacy);
    assert.deepEqual(levels[0].modules, [0, 1]);
    const html = renderToStaticMarkup(<CoursePath course={stale as never} activeIndex={0} onOpenModule={() => {}} />);
    assert.ok(html.includes("A one"));
  });
});
