// The tutor harness. Each run prepares the learner's next module for a topic.
//
//   1. Load state (course, progress). If the answer is already known, return
//      it without calling a model (resume an unfinished module, or report a
//      finished course).
//   2. Otherwise run a bounded agent loop: the model sees the learner's state,
//      calls tools (plan a course, inspect quiz mistakes, write a module), and
//      finishes with a short note to the learner.
//   3. The harness validates every tool call, enforces the rules the model
//      can't be trusted with (one course per topic, exactly one module per
//      run, only the module the run is for), and routes all lesson writing
//      through the quality gate in lessonWriter.ts.
//
// A run is normally for the current module. An "ahead" run writes the one
// after it while the learner is still taking the current one, so the next
// lesson is ready the moment they finish; it can't see their mistakes in the
// lesson they're taking, only in the ones before it.

import { z } from "zod";
import * as db from "./db";
import { groupLevels, modulePlace } from "./courseHierarchy";
import { PLANNER_VERSION, PLANNING_GUIDE, coursePlanToolParameters, parseCoursePlan } from "./coursePlan";
import { latestLessonForModule, toCourseView, type CourseView } from "./courseView";
import { PASS_SCORE, lessonVersion, writeLesson, type Lesson, type TraceEntry } from "./lessonWriter";
import { findSharedPlan } from "./planCache";
import { billingEnabled, canWriteLesson, planFrom, windowStart } from "./plans";
import { callWithTools, emptyUsage, withUsage, type ChatMessage, type ToolCall, type ToolDefinition, type Usage } from "./model";

export type { TraceEntry };

// Bounded iteration: the agent gets at most this many model turns per run.
const MAX_AGENT_STEPS = 6;
// The lesson writer won't start a revision after this point in the run...
const REVISE_DEADLINE_MS = 120_000;
// ...and the agent loop won't start a new turn after this one.
const RUN_BUDGET_MS = 200_000;
// Hard stop for every model call in the run (incl. retries). The route allows
// 300s; the rest is headroom for database writes.
const HARD_DEADLINE_MS = 280_000;

/** Case- and whitespace-insensitive key, so "Stoicism" and " stoicism" are one course. */
export function topicKey(topic: string) {
  return topic.trim().replace(/\s+/g, " ").toLowerCase();
}

export type TutorResult =
  | {
      kind: "lesson";
      course: CourseView;
      moduleIndex: number;
      lessonId: number | null;
      lesson: Lesson;
      score: number | null;
      passed: boolean;
      saved: boolean;
      /** True when an unfinished module was returned without new generation. */
      resumed: boolean;
      tutorNote: string | null;
      trace: TraceEntry[];
    }
  | { kind: "course_complete"; course: CourseView; trace: TraceEntry[] }
  /** An ahead run with nothing to do: no current lesson yet, the next is written, or it's the last. */
  | { kind: "nothing_ahead"; trace: TraceEntry[] }
  /** The learner's plan doesn't cover this lesson (see lib/plans.ts). Nothing was written or spent. */
  | {
      kind: "upgrade_required";
      course: CourseView | null;
      reason: "free_lessons" | "free_courses" | "paid_lessons";
      message: string;
      trace: TraceEntry[];
    };

// ---------- Tools the agent can call ----------

const WriteModuleArgs = z.object({
  focus: z.string().max(800),
});

const TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "create_course",
      description:
        "Plan a new course for this topic: levels (stages of learning), each grouping a few modules, each module a 5-10 minute lesson. Only allowed when the learner has no course for the topic.",
      parameters: coursePlanToolParameters,
    },
  },
  {
    type: "function",
    function: {
      name: "get_quiz_mistakes",
      description:
        "List the quiz questions the learner got wrong in this course so far, with what they chose and the right answer.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "write_module",
      description:
        "Write the lesson for the course's current module. A separate evaluator scores it and it is revised if needed. Call exactly once per run.",
      parameters: {
        type: "object",
        properties: {
          focus: {
            type: "string",
            description:
              "Instructions for the lesson writer: what to emphasize, what earlier idea to connect to, what misconception to recap. Under 80 words.",
          },
        },
        required: ["focus"],
      },
    },
  },
];

const SYSTEM_PROMPT = `You are the tutor agent of a learning app where anyone can learn anything through short interactive modules (5-10 minutes each). Each run, you prepare the learner's next module.

How to work:
1. If the learner has no course for this topic, call create_course. Use their history: don't re-teach basics they covered in related topics.
2. If the course state shows wrong quiz answers, call get_quiz_mistakes and use what you learn in the module's focus (for example, open with a short recap of the misunderstood idea).
3. Call write_module exactly once. Give a concrete focus for the lesson writer.
4. Then reply, without tool calls, with a short note to the learner: 1-2 warm sentences in second person on what this module covers and why it's next. Plain text only, no markdown, under 60 words.

Rules: one module per run; only the module marked NEXT can be written; never claim progress the learner hasn't made.

${PLANNING_GUIDE}`;

type RunState = {
  learnerId: string;
  topic: string;
  key: string;
  course: db.CourseWithLessons | null;
  /** The module this run writes: the current one, or the one after it for an ahead run. */
  target: number;
  ahead: boolean;
  written: {
    moduleIndex: number;
    lessonId: number | null;
    lesson: Lesson;
    score: number;
    passed: boolean;
  } | null;
  startedAt: number;
  trace: TraceEntry[];
  /** The learner has no other courses, so a plan for them isn't tailored and can be shared. */
  fresh: boolean;
  /** The requested topic's embedding, if the plan cache computed one (stored with a new shared plan). */
  embedding: number[] | null;
};

type ToolResult = Record<string, unknown>;

async function runTool(call: ToolCall, state: RunState): Promise<ToolResult> {
  let rawArgs: unknown;
  try {
    rawArgs = JSON.parse(call.function.arguments || "{}");
  } catch {
    return { error: "Arguments were not valid JSON." };
  }

  switch (call.function.name) {
    case "create_course": {
      if (state.course) return { error: "This learner already has a course for this topic. Use write_module." };
      const parsed = parseCoursePlan(rawArgs);
      if (!parsed.ok) return { error: `Invalid course plan: ${parsed.error}. Fix it and call create_course again.` };
      // A plan made for a learner with no other courses isn't tailored to anyone,
      // so it's shared: the course points at it, and it's cached for the next
      // learner who asks for the same course.
      const row = await db.createCourse({
        learnerId: state.learnerId,
        topic: state.topic,
        topicKey: state.key,
        ...parsed.plan,
        planKey: state.fresh ? state.key : null,
      });
      state.course = { ...row, lessons: [] };
      if (state.fresh && db.canWriteShared()) {
        await db
          .cachePlan({
            topicKey: state.key,
            topic: state.topic,
            title: row.title,
            description: row.description,
            modules: row.modules,
            plannerVersion: PLANNER_VERSION,
            embedding: state.embedding,
          })
          .then(() => state.trace.push({ step: "plan_cached" }))
          .catch((e) => state.trace.push({ step: "plan_cache_failed", error: e instanceof Error ? e.message : String(e) }));
      }
      return {
        ok: true,
        levels: groupLevels(row.modules).length,
        modules: row.modules.length,
        next: "Call write_module to write the first module of level 1.",
      };
    }

    case "get_quiz_mistakes": {
      if (!state.course) return { mistakes: [], note: "No course yet, so no quiz history." };
      const lessons = await db.getCourseAttempts(state.course.id);
      const mistakes = lessons.flatMap((l) =>
        l.attempts
          .filter((a) => !a.correct)
          .map((a) => ({
            module: (l.module_index ?? 0) + 1,
            question: l.lesson_data.questions[a.question_index]?.question,
            chose: a.chosen,
            correctAnswer: l.lesson_data.questions[a.question_index]?.correctAnswer,
          }))
      );
      return { mistakes: mistakes.slice(0, 10) };
    }

    case "write_module": {
      if (!state.course) return { error: "Create the course first with create_course." };
      if (state.written) return { error: "A module was already written this run. Finish with your note." };
      if (state.course.status === "completed") return { error: "This course is already complete." };
      const args = WriteModuleArgs.safeParse(rawArgs);
      if (!args.success) return { error: `Invalid arguments: ${args.error.message}` };

      const course = state.course;
      const moduleIndex = state.target;
      const levels = groupLevels(course.modules);
      const place = modulePlace(levels, moduleIndex);
      const level = place.legacy ? null : levels[place.level];
      // Lesson 1 of a shared plan is the same for every new learner (no
      // mistakes to adapt to yet), so a copy that passed every check is reused.
      const sharedPlan = moduleIndex === 0 ? course.plan_key ?? null : null;
      const version = sharedPlan ? lessonVersion() : "";
      const cachedLesson = sharedPlan ? await db.getCachedFirstLesson(sharedPlan, version).catch(() => null) : null;
      if (sharedPlan) state.trace.push({ step: "lesson_cache", hit: !!cachedLesson });
      const { lesson, score, passed } = cachedLesson
        ? { lesson: cachedLesson.lesson, score: cachedLesson.score, passed: true }
        : await writeLesson(
        {
          topic: course.topic,
          courseTitle: course.title,
          moduleIndex,
          moduleCount: course.modules.length,
          module: course.modules[moduleIndex],
          level: level
            ? {
                number: level.index + 1,
                count: levels.length,
                title: level.title,
                objective: level.objective,
                moduleNumber: place.number,
                moduleCount: level.modules.length,
              }
            : undefined,
          previousModules: course.modules.slice(0, moduleIndex).map((m) => m.title),
          previousApproaches: course.modules
            .slice(0, moduleIndex)
            .map((_, i) => latestLessonForModule(course, i)?.lesson_data.approach)
            .filter((a): a is NonNullable<typeof a> => !!a),
          focus: args.data.focus,
        },
        {
          reviseDeadline: state.startedAt + REVISE_DEADLINE_MS,
          deadline: state.startedAt + HARD_DEADLINE_MS,
          trace: state.trace,
        }
      );

      const lessonId = await db.saveLesson(state.learnerId, course.topic, lesson, score, {
        courseId: course.id,
        moduleIndex,
      });
      state.trace.push({ step: "save_lesson", lessonId });
      // A freshly written lesson 1 that passed is shared with the plan's next learners.
      if (sharedPlan && !cachedLesson && passed && db.canWriteShared()) {
        await db
          .cacheFirstLesson(sharedPlan, lesson, score, version)
          .then(() => state.trace.push({ step: "lesson_cached" }))
          .catch((e) => state.trace.push({ step: "lesson_cache_failed", error: e instanceof Error ? e.message : String(e) }));
      }
      const progressSaved = await db.upsertProgress(state.learnerId, state.key, "started", lessonId ?? undefined);
      state.trace.push({ step: "save_progress", saved: progressSaved });
      await db.updateCourse(course.id, {}); // bump updated_at so it sorts first

      state.written = { moduleIndex, lessonId, lesson, score, passed };
      return { ok: true, module: moduleIndex + 1, lessonTitle: lesson.title, score, passed };
    }

    default:
      return { error: `Unknown tool: ${call.function.name}` };
  }
}

// ---------- Context the agent starts with ----------

async function describeState(state: RunState) {
  const history = (await db.getLearnerHistory(state.learnerId)) as { topic: string; status: string }[];
  const others = history.filter((h) => h.topic !== state.key);
  const historyLine = others.length
    ? `Other topics this learner has studied: ${others.map((h) => `${h.topic} (${h.status})`).join(", ")}.`
    : "The learner hasn't studied other topics here yet.";

  if (!state.course) {
    return `Learner wants to learn: "${state.topic}"\n${historyLine}\nCourse state: no course for this topic yet.`;
  }

  const course = state.course;
  const attempts = await db.getCourseAttempts(course.id);
  const levels = groupLevels(course.modules);
  const lines = course.modules.map((m, i) => {
    const lesson = latestLessonForModule(course, i);
    const quiz = attempts.find((a) => a.id === lesson?.id)?.attempts ?? [];
    const right = quiz.filter((a) => a.correct).length;
    const status =
      i < course.current_module
        ? `done${quiz.length ? `, quiz ${right}/${quiz.length} correct` : ""}`
        : i === state.target
          ? "NEXT — write this one"
          : i === course.current_module
            ? "in progress: the learner is taking it now (results not in yet)"
            : "not started";
    const place = modulePlace(levels, i);
    const line = `  ${place.legacy ? i + 1 : `${place.level + 1}.${place.number}`}. ${m.title} — ${status}`;
    const level = levels[place.level];
    // Head each level with what it's for, so the agent sees where the learner is in the journey.
    return !place.legacy && place.number === 1
      ? `Level ${level.index + 1}: ${level.title} (objective: ${level.objective})\n${line}`
      : line;
  });
  return `Learner wants to continue: "${state.topic}"
${historyLine}
Course: "${course.title}" — ${course.description}
Modules:
${lines.join("\n")}`;
}

/** The note is shown as plain text: strip markdown the model adds anyway. */
function cleanNote(text: string | null) {
  const note = (text ?? "")
    .replace(/\*\*|__|`/g, "")
    .replace(/^#+\s*/gm, "")
    .trim();
  return note ? note.slice(0, 400) : null;
}

// ---------- The run ----------

export async function runTutor(topic: string, learnerId: string, { ahead = false } = {}): Promise<TutorResult> {
  const state: RunState = {
    learnerId,
    topic: topic.trim(),
    key: topicKey(topic),
    course: null,
    target: 0,
    ahead,
    written: null,
    startedAt: Date.now(),
    trace: [],
    fresh: false,
    embedding: null,
  };
  // What the run's model calls cost, so every run says what it spent; the
  // trace, time and cost are also stored (runs table) to measure real costs.
  const usage = emptyUsage();
  try {
    const { result } = await withUsage(() => run(state), usage);
    state.trace.push(costEntry(usage));
    await db.recordRun(learnerId, {
      kind: "learn",
      topic: state.topic,
      lessonId: result.kind === "lesson" ? result.lessonId : null,
      outcome: result.kind === "lesson" ? (result.resumed ? "resumed" : ahead ? "ahead" : "lesson") : result.kind,
      ok: true,
      ms: Date.now() - state.startedAt,
      usage,
      trace: state.trace,
    });
    return result;
  } catch (e) {
    await db.recordRun(learnerId, {
      kind: "learn",
      topic: state.topic,
      outcome: "failed",
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      ms: Date.now() - state.startedAt,
      usage,
      trace: [...state.trace, costEntry(usage)],
    });
    // The trace never reaches the browser on failure, so keep it in the logs:
    // it shows which turn, tool or lesson step broke and how long each took.
    console.error("Tutor run failed", {
      topic: state.topic,
      elapsedMs: Date.now() - state.startedAt,
      trace: [...state.trace, costEntry(usage)],
    });
    throw e;
  }
}

const costEntry = (u: Usage): TraceEntry => ({
  step: "run.cost",
  usd: Number(u.cost.toFixed(5)),
  calls: u.calls,
  tokensIn: u.promptTokens,
  tokensOut: u.completionTokens,
});

async function run(state: RunState): Promise<TutorResult> {
  const { trace, learnerId } = state;

  state.course = await db.getCourse(learnerId, state.key);
  trace.push({
    step: "load_course",
    found: !!state.course,
    currentModule: state.course ? state.course.current_module + 1 : null,
  });

  if (state.ahead) {
    const course = state.course;
    const next = course ? course.current_module + 1 : -1;
    const reason = !course || course.status === "completed"
      ? "no active course"
      : !latestLessonForModule(course, course.current_module)
        ? "current lesson not written yet"
        : next >= course.modules.length
          ? "current lesson is the last"
          : latestLessonForModule(course, next)
            ? "next lesson already written"
            : null;
    if (reason) {
      trace.push({ step: "fast_path", reason: `ahead: ${reason}` });
      return { kind: "nothing_ahead", trace };
    }
    state.target = next;
  } else {
    state.target = state.course?.current_module ?? 0;
  }

  // Fast paths: no model call needed.
  if (state.course?.status === "completed") {
    trace.push({ step: "fast_path", reason: "course already complete" });
    return { kind: "course_complete", course: toCourseView(state.course), trace };
  }
  if (state.course && !state.ahead) {
    const unfinished = latestLessonForModule(state.course, state.course.current_module);
    if (unfinished && !unfinished.completed_at) {
      trace.push({ step: "fast_path", reason: "resume unfinished module", lessonId: unfinished.id });
      return {
        kind: "lesson",
        course: toCourseView(state.course),
        moduleIndex: state.course.current_module,
        lessonId: unfinished.id,
        lesson: unfinished.lesson_data,
        score: unfinished.score,
        passed: (unfinished.score ?? 0) >= PASS_SCORE,
        saved: true,
        resumed: true,
        tutorNote: null,
        trace,
      };
    }
  }

  // The plan check: before any model call, so a lesson the plan doesn't cover
  // costs nothing. Resuming a lesson already written (above) is always free.
  if (billingEnabled()) {
    const [subscription, usage] = await Promise.all([db.getSubscription(learnerId), db.getUsageSince(learnerId, windowStart())]);
    const plan = planFrom(subscription);
    const gate = canWriteLesson(plan, { moduleIndex: state.target, newCourse: !state.course, usage });
    trace.push({ step: "plan_check", tier: plan.tier, usage, allowed: gate.ok });
    if (!gate.ok) {
      if (state.ahead) return { kind: "nothing_ahead", trace };
      return {
        kind: "upgrade_required",
        course: state.course ? toCourseView(state.course) : null,
        reason: gate.reason,
        message: gate.message,
        trace,
      };
    }
  }

  // A new course for a learner with no other courses: use the shared plan for
  // this topic if there is one, so it isn't planned (or its world painted) again.
  if (!state.course && !state.ahead) {
    const history = (await db.getLearnerHistory(learnerId)) as { topic: string }[];
    state.fresh = !history.some((h) => h.topic !== state.key);
    if (state.fresh) {
      const t = Date.now();
      const shared = await findSharedPlan(state.topic, state.key, state.startedAt + HARD_DEADLINE_MS);
      state.embedding = shared.embedding;
      trace.push({ step: "plan_cache", ms: Date.now() - t, ...shared.note });
      if (shared.plan) {
        // The learner's course keeps their own wording as its topic.
        const row = await db.createCourse({
          learnerId,
          topic: state.topic,
          topicKey: state.key,
          title: shared.plan.title,
          description: shared.plan.description,
          modules: shared.plan.modules,
          coverUrl: shared.plan.cover_url,
          planKey: shared.plan.topic_key,
        });
        state.course = { ...row, lessons: [] };
      }
    }
  }

  // The agent loop.
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: await describeState(state) },
  ];
  let tutorNote: string | null = null;
  let nudged = false;

  for (let step = 1; step <= MAX_AGENT_STEPS; step++) {
    if (Date.now() - state.startedAt > RUN_BUDGET_MS) {
      trace.push({ step: "agent.stop", reason: "time budget" });
      break;
    }

    const turnStarted = Date.now();
    const reply = await callWithTools(messages, TOOLS, state.startedAt + HARD_DEADLINE_MS);
    messages.push(reply);
    trace.push({
      step: "agent.turn",
      turn: step,
      ms: Date.now() - turnStarted,
      toolCalls: reply.tool_calls?.map((c) => c.function.name) ?? [],
    });

    if (reply.tool_calls?.length) {
      for (const call of reply.tool_calls) {
        let result: ToolResult;
        try {
          result = await runTool(call, state);
        } catch (e) {
          // Infrastructure failures (DB, lesson writer) end the run.
          trace.push({ step: "agent.tool", turn: step, tool: call.function.name, ok: false });
          throw e;
        }
        trace.push({
          step: "agent.tool",
          turn: step,
          tool: call.function.name,
          ok: !("error" in result),
          ...("error" in result ? { error: result.error } : {}),
        });
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      }
      continue;
    }

    // A reply without tool calls means the agent thinks it's done.
    if (state.written) {
      tutorNote = cleanNote(reply.content);
      trace.push({ step: "agent.finish", turn: step });
      break;
    }
    if (nudged) break;
    nudged = true;
    trace.push({ step: "agent.nudge", turn: step, reason: "finished without writing a module" });
    messages.push({
      role: "user",
      content: "You haven't written the module yet. Call write_module (after create_course if needed), then reply with your note.",
    });
  }

  if (!state.written || !state.course) {
    throw new Error("The tutor agent stopped without writing a module.");
  }

  // Reload so the response reflects exactly what was saved.
  const saved = await db.getCourse(learnerId, state.key);
  const w = state.written;
  return {
    kind: "lesson",
    course: toCourseView(saved ?? state.course),
    moduleIndex: w.moduleIndex,
    lessonId: w.lessonId,
    lesson: w.lesson,
    score: w.score,
    passed: w.passed,
    saved: w.lessonId !== null,
    resumed: false,
    tutorNote,
    trace,
  };
}
