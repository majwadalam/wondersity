"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  deleteCourse,
  deletePlan,
  editBrief,
  editCourse,
  editModule,
  editPlan,
  editPlanModule,
  moveLearner,
  requireAdmin,
  resolveMessage,
  retireSharedLesson,
  rewriteLesson,
  setRole,
} from "@/lib/admin";

// Every change the admin panel can make. Each one checks the admin role
// again, validates its input, and is recorded in the activity log
// (admin_actions) by the function it calls in lib/admin.ts.

export type ActionResult = { ok: boolean; message: string } | null;

const Title = z.string().trim().min(3, "Give it a title of at least 3 characters.").max(140, "Keep the title under 140 characters.");
const Text = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters.`);
const Id = z.coerce.number().int().positive();
const Index = z.coerce.number().int().min(0);

/** Runs a change as the signed-in admin and turns its outcome into a message for the form. */
async function run(done: string, fn: (actor: { id: string; email?: string | null }) => Promise<unknown>, revalidate: string[]): Promise<ActionResult> {
  const admin = await requireAdmin();
  try {
    await fn({ id: admin.id, email: admin.email });
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, message: e.issues[0]?.message ?? "Check the form." };
    return { ok: false, message: e instanceof Error ? e.message : "That didn't work." };
  }
  for (const p of revalidate) revalidatePath(p);
  return { ok: true, message: done };
}

export async function changeRole(_: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const userId = z.string().uuid().parse(form.get("userId"));
  if (userId === admin.id) return { ok: false, message: "You can't change your own role." };
  const grant = form.get("grant") === "1";
  return run(grant ? "They're an admin now." : "They're no longer an admin.", (actor) => setRole(userId, grant ? "admin" : null, actor), [`/admin/users/${userId}`, "/admin/users"]);
}

export async function saveCourse(_: ActionResult, form: FormData): Promise<ActionResult> {
  return run(
    "Saved.",
    (actor) => editCourse(actor, Id.parse(form.get("courseId")), { title: Title.parse(form.get("title")), description: Text(600).parse(form.get("description")) }),
    [`/admin/courses/${form.get("courseId")}`, "/admin/courses"]
  );
}

export async function saveBrief(_: ActionResult, form: FormData): Promise<ActionResult> {
  return run(
    "Saved. Lessons not written yet will follow the new brief.",
    async (actor) => {
      const outcomes = Text(2000)
        .parse(form.get("outcomes"))
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      if (outcomes.length < 1 || outcomes.length > 6) throw new Error("Write 1 to 6 outcomes, one per line.");
      await editBrief(actor, Id.parse(form.get("courseId")), {
        goal: z.string().trim().min(3, "The goal needs at least 3 characters.").max(300).parse(form.get("goal")),
        context: Text(400).parse(form.get("context") ?? ""),
        known: Text(400).parse(form.get("known") ?? ""),
        outcomes,
      });
    },
    [`/admin/courses/${form.get("courseId")}`]
  );
}

export async function saveModule(_: ActionResult, form: FormData): Promise<ActionResult> {
  return run(
    "Saved. The tutor will write this lesson to the new title and goal.",
    (actor) => editModule(actor, Id.parse(form.get("courseId")), Index.parse(form.get("index")), { title: Title.parse(form.get("title")), goal: Text(400).parse(form.get("goal")) }),
    [`/admin/courses/${form.get("courseId")}`]
  );
}

export async function moveTo(_: ActionResult, form: FormData): Promise<ActionResult> {
  return run(
    "Moved. Their next lesson is this one.",
    (actor) => moveLearner(actor, Id.parse(form.get("courseId")), Index.parse(form.get("index"))),
    [`/admin/courses/${form.get("courseId")}`]
  );
}

export async function rewrite(_: ActionResult, form: FormData): Promise<ActionResult> {
  return run(
    "Done. A fresh lesson is written the next time the learner opens it.",
    (actor) => rewriteLesson(actor, Id.parse(form.get("lessonId"))),
    [`/admin/courses/${form.get("courseId")}`, "/admin/problems"]
  );
}

export async function removeCourse(_: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = Id.parse(form.get("courseId"));
  let learner: string;
  try {
    learner = await deleteCourse({ id: admin.id, email: admin.email }, id);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "That didn't work." };
  }
  revalidatePath("/admin/courses");
  redirect(`/admin/users/${learner}`);
}

export async function savePlan(_: ActionResult, form: FormData): Promise<ActionResult> {
  const key = String(form.get("planKey") ?? "");
  return run("Saved. New learners get the new wording.", (actor) => editPlan(actor, key, { title: Title.parse(form.get("title")), description: Text(600).parse(form.get("description")) }), [
    `/admin/cache/${encodeURIComponent(key)}`,
    "/admin/cache",
  ]);
}

export async function savePlanModule(_: ActionResult, form: FormData): Promise<ActionResult> {
  const key = String(form.get("planKey") ?? "");
  return run(
    "Saved for the next learners who get this plan.",
    (actor) => editPlanModule(actor, key, Index.parse(form.get("index")), { title: Title.parse(form.get("title")), goal: Text(400).parse(form.get("goal")) }),
    [`/admin/cache/${encodeURIComponent(key)}`]
  );
}

export async function retire(_: ActionResult, form: FormData): Promise<ActionResult> {
  const key = String(form.get("planKey") ?? "");
  return run(
    "Retired. The next learner to reach it gets a freshly written lesson.",
    (actor) => retireSharedLesson(actor, key, Index.parse(form.get("index")), String(form.get("version") ?? "")),
    [`/admin/cache/${encodeURIComponent(key)}`, "/admin/cache"]
  );
}

export async function removePlan(_: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const key = String(form.get("planKey") ?? "");
  try {
    await deletePlan({ id: admin.id, email: admin.email }, key);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "That didn't work." };
  }
  revalidatePath("/admin/cache");
  redirect("/admin/cache");
}

export async function markMessage(_: ActionResult, form: FormData): Promise<ActionResult> {
  const resolved = form.get("resolved") === "1";
  return run(resolved ? "Marked answered." : "Reopened.", (actor) => resolveMessage(actor, Id.parse(form.get("id")), resolved), ["/admin/problems", "/admin"]);
}
