import { NextResponse } from "next/server";
import { z } from "zod";
import { currentLearner } from "@/lib/auth";
import { insertSupportMessage, withDb } from "@/lib/db";
import { clientIp, rateLimit, serverError, tooManyRequests } from "@/lib/requestGuards";

// A message from the Help page. Signed in, it's saved as the learner (with
// their account email); signed out, it needs an email to answer and is saved
// with the server key. Read in the admin panel (Problems → Messages).

const Body = z.object({
  kind: z.enum(["question", "problem", "idea", "billing", "other"]),
  message: z.string().trim().min(5).max(4000),
  email: z.string().trim().email().max(200).optional(),
  // The page they came from, to know what they mean by "this".
  page: z.string().max(300).regex(/^\//).optional(),
});

export async function POST(request: Request) {
  const limit = rateLimit(`support:${clientIp(request)}`, 5, 10 * 60 * 1000);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Write a few words, and an email we can answer." }, { status: 400 });
  const { kind, message, email, page } = parsed.data;
  try {
    const session = await currentLearner();
    if (!session && !email) return NextResponse.json({ error: "Add an email so we can answer you." }, { status: 400 });
    const save = () =>
      insertSupportMessage({ learnerId: session?.user.id ?? null, email: session?.user.email ?? email ?? null, kind, message, page: page ?? null });
    await (session ? withDb(session.db, save) : save());
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Couldn't send your message.");
  }
}
