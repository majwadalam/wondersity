import { createHash } from "node:crypto";
// The course plan the tutor agent writes with create_course: levels that are
// stages of learning, each grouping a few related modules. Validated here,
// in code, then flattened into the ordered module list that is stored (see
// courseHierarchy.ts). Invalid plans are returned to the agent as an error it
// can correct.

import { z } from "zod";
import type { StoredModule } from "./courseHierarchy";

export const PLAN_LIMITS = {
  minLevels: 2,
  maxLevels: 4,
  minModulesPerLevel: 2,
  maxModulesPerLevel: 4,
  minModules: 4,
  maxModules: 12,
} as const;
const L = PLAN_LIMITS;

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

const ModuleArgs = z.object({
  title: text(3, 120),
  goal: text(10, 300),
  description: text(10, 300),
});

const LevelArgs = z.object({
  title: text(3, 80),
  description: text(10, 300),
  objective: text(10, 300),
  modules: z.array(ModuleArgs).min(L.minModulesPerLevel).max(L.maxModulesPerLevel),
});

// A level title must say what the stage is about, not just number it.
const GENERIC_LEVEL = /^(level|stage|part|unit|phase)\s*\d+$/i;
const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export const CoursePlanArgs = z
  .object({
    title: text(3, 120),
    description: text(10, 400),
    levels: z.array(LevelArgs).min(L.minLevels).max(L.maxLevels),
  })
  .superRefine((plan, ctx) => {
    const modules = plan.levels.flatMap((l) => l.modules);
    if (modules.length < L.minModules || modules.length > L.maxModules) {
      ctx.addIssue({
        code: "custom",
        path: ["levels"],
        message: `${modules.length} modules in total; use ${L.minModules}-${L.maxModules}`,
      });
    }
    const levelTitles = plan.levels.map((l) => key(l.title.replace(/^level\s*\d+\s*[:—–-]\s*/i, "")));
    if (new Set(levelTitles).size !== levelTitles.length) {
      ctx.addIssue({ code: "custom", path: ["levels"], message: "level titles must be distinct" });
    }
    plan.levels.forEach((l, i) => {
      if (GENERIC_LEVEL.test(l.title.trim())) {
        ctx.addIssue({ code: "custom", path: ["levels", i, "title"], message: "name what the level is about, not just its number" });
      }
    });
    const moduleTitles = modules.map((m) => key(m.title));
    if (new Set(moduleTitles).size !== moduleTitles.length) {
      ctx.addIssue({ code: "custom", path: ["levels"], message: "module titles must be distinct across the course" });
    }
  });

export type CoursePlanInput = z.infer<typeof CoursePlanArgs>;
export type CoursePlan = { title: string; description: string; modules: StoredModule[] };

/** Strips "Level 2:" style prefixes the model adds; the UI numbers levels itself. */
const cleanLevelTitle = (t: string) => t.trim().replace(/^level\s*\d+\s*[:—–-]\s*/i, "");

/**
 * Validates a plan and flattens it into the stored module list, giving each
 * level and module a stable id. Returns a readable error for the agent.
 */
export function parseCoursePlan(raw: unknown): { ok: true; plan: CoursePlan } | { ok: false; error: string } {
  const parsed = CoursePlanArgs.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "plan"}: ${i.message}`);
    return { ok: false, error: issues.slice(0, 6).join("; ") };
  }
  const { title, description, levels } = parsed.data;
  const modules: StoredModule[] = levels.flatMap((level, li) => {
    const info = {
      id: `level-${li + 1}`,
      title: cleanLevelTitle(level.title),
      description: level.description,
      objective: level.objective,
    };
    return level.modules.map((m, mi) => ({
      id: `${info.id}-module-${mi + 1}`,
      title: m.title,
      goal: m.goal,
      description: m.description,
      level: info,
    }));
  });
  return { ok: true, plan: { title, description, modules } };
}

/** JSON schema for the create_course tool. */
export const coursePlanToolParameters = {
  type: "object",
  properties: {
    title: { type: "string", description: "Course title" },
    description: { type: "string", description: "One or two sentences on what the learner will get from the whole course" },
    levels: {
      type: "array",
      minItems: L.minLevels,
      maxItems: L.maxLevels,
      description: "Stages of learning, in order. Each is a real step up from the one before.",
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "What this stage is about (no 'Level N' prefix)" },
          description: { type: "string", description: "One sentence on what this stage covers" },
          objective: { type: "string", description: "What the learner can do after finishing this level" },
          modules: {
            type: "array",
            minItems: L.minModulesPerLevel,
            maxItems: L.maxModulesPerLevel,
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                goal: { type: "string", description: "What the learner can do after this module" },
                description: { type: "string", description: "One sentence on what the module covers" },
              },
              required: ["title", "goal", "description"],
            },
          },
        },
        required: ["title", "description", "objective", "modules"],
      },
    },
  },
  required: ["title", "description", "levels"],
};

export const PLANNING_GUIDE = `Plan the course as LEVELS, each grouping a few MODULES:
- A level is a stage of learning with its own objective: what the learner can do once it's done. Each
  level is a genuine step up (new capability, deeper understanding or harder application), not a
  relabelled module or an arbitrary split. Name it for what it's about.
- A module groups closely related ideas inside its level, is one 5-10 minute lesson, and builds on the
  module before it. Modules never repeat each other.
- Size it to the subject: ${L.minLevels}-${L.maxLevels} levels, ${L.minModulesPerLevel}-${L.maxModulesPerLevel} modules per level, ${L.minModules}-${L.maxModules} modules in total. A narrow
  topic gets fewer, a broad one more. Don't pad.
- Pitch the first level to the learner: infer their starting point from how they phrased the topic
  ("for beginners", "advanced", a specific sub-skill) and the topics they've already studied.`;

/**
 * A fingerprint of the planning guide. Cached plans carry it, so changing how
 * courses are planned retires every plan made the old way.
 */
export const PLANNER_VERSION = createHash("sha256").update(PLANNING_GUIDE).digest("hex").slice(0, 12);
