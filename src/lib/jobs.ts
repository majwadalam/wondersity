// Lesson jobs: the tutor runs on the server, after the response is sent
// (Next.js `after`), so a lesson is finished even if the browser closes.
//
//   POST /api/learn       starts a job (or joins the one already running for
//                         that topic) and returns it at once
//   GET  /api/jobs/<id>   the browser watches it; GET /api/jobs lists the
//                         learner's running jobs, so a reload picks them up
//
// A job runs the tutor (plan and/or lesson), then, while the route's 5-minute
// limit leaves time, stages the new lesson (scenes, guide, "Go deeper") and
// paints a new course's world, so those don't depend on the browser either.
// Finishing a quiz starts the next lesson's job (app/api/attempts).
//
// Two jobs never write the same course at once: a job for the same kind and
// topic is joined, and a job of the other kind (writing ahead vs the current
// lesson) waits for the earlier one to finish first.

import { after } from "next/server";
import { toCourseView } from "./courseView";
import { paintCourseWorld } from "./courseWorld";
import * as db from "./db";
import { runTutor, topicKey, type TutorResult } from "./harness";
import { stageLesson } from "./lessonStaging";
import { describeFailure } from "./requestGuards";

export type JobKind = db.JobRow["kind"];

export type JobView = {
  id: string;
  kind: JobKind;
  topic: string;
  status: db.JobRow["status"];
  result?: TutorResult;
  error?: string;
  ref?: string;
  retryable?: boolean;
};

// Past the route's 5-minute limit, a job still marked running was cut off.
const STALE_MS = 6 * 60 * 1000;
// Staging and painting only start while this much of the 5 minutes is left
// after the tutor (a lesson the job can't stage is staged when it's opened).
const STAGE_BEFORE_MS = 180_000;
const PAINT_BEFORE_MS = 240_000;
// How long a job waits for an earlier job on the same course.
const WAIT_MAX_MS = 240_000;

const isStale = (j: db.JobRow) => j.status === "running" && Date.now() - new Date(j.updated_at).getTime() > STALE_MS;

export function view(j: db.JobRow): JobView {
  const stale = isStale(j);
  return {
    id: j.id,
    kind: j.kind,
    topic: j.topic,
    status: stale ? "failed" : j.status,
    ...(j.result ? { result: j.result as TutorResult } : {}),
    ...(stale
      ? { error: "This is taking longer than it should. Please try again.", retryable: true }
      : j.error
        ? { error: j.error, ref: j.ref ?? undefined, retryable: j.retryable ?? true }
        : {}),
  };
}

/**
 * Starts a lesson job for the signed-in learner (inside withDb), or returns
 * the one already running for the same topic and kind.
 */
export async function startLessonJob(learnerId: string, topic: string, kind: JobKind): Promise<JobView> {
  const key = topicKey(topic);
  const running = (await db.runningJobs(learnerId, key)).filter((j) => !isStale(j));
  const same = running.find((j) => j.kind === kind);
  if (same) return view(same);

  const job = await db.insertJob({ learnerId, kind, topic: topic.trim(), topicKey: key });
  const client = db.currentDb();
  if (!client) throw new Error("startLessonJob needs the signed-in learner's database client");
  // After the response: the learner's client keeps its session for the run.
  after(() => db.withDb(client, () => runLessonJob(learnerId, job)));
  return view(job);
}

async function runLessonJob(learnerId: string, job: db.JobRow) {
  const started = Date.now();
  try {
    await waitForEarlierJobs(learnerId, job);
    const result = await runTutor(job.topic, learnerId, { ahead: job.kind === "ahead" });

    if (result.kind === "lesson" && result.lessonId && !result.resumed) {
      // Stage the new lesson here, so it's ready even if nobody opens it soon.
      if (!result.lesson.staging && Date.now() - started < STAGE_BEFORE_MS) {
        await db.updateJob(job.id, { status: "running" }); // still alive
        const staged = await stageLesson(learnerId, result.lessonId, result.course.topic).catch((e) => {
          console.error(`job ${job.id}: staging failed`, e);
          return null;
        });
        if (staged?.ok) result.lesson = { ...result.lesson, staging: staged.staging, ...(staged.resources ? { resources: staged.resources } : {}) };
      }
      // A new course's world, painted once.
      if (job.kind === "learn" && !result.course.cover && Date.now() - started < PAINT_BEFORE_MS) {
        const painted = await paintCourseWorld(learnerId, result.course.id).catch((e) => {
          console.error(`job ${job.id}: world painting failed`, e);
          return null;
        });
        if (painted) result.course = toCourseView(painted);
      }
    }
    await db.updateJob(job.id, { status: "done", result });
  } catch (error) {
    const failure = describeFailure(error, "Failed to prepare your lesson. Please try again.");
    await db
      .updateJob(job.id, { status: "failed", error: failure.message, ref: failure.ref, retryable: failure.retryable })
      .catch((e) => console.error(`job ${job.id}: couldn't record its failure`, e));
  }
}

/** Waits (bounded) while an earlier job of the other kind is still writing this course. */
async function waitForEarlierJobs(learnerId: string, job: db.JobRow) {
  const deadline = Date.now() + WAIT_MAX_MS;
  while (Date.now() < deadline) {
    const earlier = (await db.runningJobs(learnerId, job.topic_key)).filter(
      (j) => j.id !== job.id && !isStale(j) && new Date(j.created_at) < new Date(job.created_at)
    );
    if (!earlier.length) return;
    await new Promise((r) => setTimeout(r, 2000));
  }
}

/** A job for the learner, as the browser sees it. */
export async function getLessonJob(learnerId: string, id: string) {
  const job = await db.getJob(id, learnerId);
  return job ? view(job) : null;
}

/** The learner's jobs still running, so a reloaded page can follow them. */
export async function activeLessonJobs(learnerId: string) {
  return (await db.runningJobs(learnerId)).filter((j) => !isStale(j)).map(view);
}
