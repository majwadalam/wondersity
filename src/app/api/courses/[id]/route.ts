import { NextResponse } from "next/server";
import { z } from "zod";
import { asLearner } from "@/lib/auth";
import { toCourseView } from "@/lib/courseView";
import { addToCourseCast, getCourseById, getCourseCast, resetCourse, setCourseArchived } from "@/lib/db";
import { serverError } from "@/lib/requestGuards";
import { VOICES } from "@/lib/voices";

// Changes a learner makes to one of their courses: give a character another
// voice, archive it (or bring it back), or start it over from lesson 1.
// Returns the course as the app shows it.

const Change = z.discriminatedUnion("action", [
  z.object({ action: z.literal("recast"), key: z.string().min(1).max(80), voice: z.enum(VOICES) }),
  z.object({ action: z.literal("archive"), archived: z.boolean() }),
  z.object({ action: z.literal("reset") }),
]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const courseId = Number((await params).id);
  if (!Number.isInteger(courseId) || courseId <= 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parsed = Change.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid change" }, { status: 400 });
  const change = parsed.data;

  return asLearner(async (learnerId) => {
    try {
      if (!(await getCourseById(courseId, learnerId))) return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (change.action === "recast") {
        const member = (await getCourseCast(courseId, learnerId))[change.key];
        if (!member) return NextResponse.json({ error: "No one by that name speaks in this course." }, { status: 404 });
        await addToCourseCast(courseId, learnerId, { [change.key]: { ...member, voice: change.voice, chosen: true } }, true);
      } else if (change.action === "archive") {
        await setCourseArchived(courseId, learnerId, change.archived);
      } else {
        await resetCourse(courseId, learnerId);
      }
      const course = await getCourseById(courseId, learnerId);
      return NextResponse.json({ course: course ? toCourseView(course) : null });
    } catch (error) {
      return serverError(error, "Couldn't change this course.");
    }
  });
}
