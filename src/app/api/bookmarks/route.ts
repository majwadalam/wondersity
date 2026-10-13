import { NextResponse } from "next/server";
import { z } from "zod";
import { asLearner } from "@/lib/auth";
import { addBookmarks, listBookmarks, removeBookmark } from "@/lib/db";
import { topicKey } from "@/lib/harness";
import { serverError } from "@/lib/requestGuards";

// The learner's starred courses (Library), kept with the account. POST takes
// several at once so bookmarks saved in a browser before this can move in.

const Add = z.object({ topics: z.array(z.string().trim().min(1).max(200)).min(1).max(50) });
const Remove = z.object({ key: z.string().min(1).max(200) });

export async function GET() {
  return asLearner(async (learnerId) => {
    try {
      return NextResponse.json({ bookmarks: await listBookmarks(learnerId) });
    } catch (error) {
      return serverError(error, "Couldn't load your bookmarks.");
    }
  });
}

export async function POST(request: Request) {
  const parsed = Add.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid bookmark" }, { status: 400 });
  return asLearner(async (learnerId) => {
    try {
      await addBookmarks(learnerId, parsed.data.topics.map((topic) => ({ key: topicKey(topic), topic })));
      return NextResponse.json({ bookmarks: await listBookmarks(learnerId) });
    } catch (error) {
      return serverError(error, "Couldn't save the bookmark.");
    }
  });
}

export async function DELETE(request: Request) {
  const parsed = Remove.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid bookmark" }, { status: 400 });
  return asLearner(async (learnerId) => {
    try {
      await removeBookmark(learnerId, parsed.data.key);
      return NextResponse.json({ bookmarks: await listBookmarks(learnerId) });
    } catch (error) {
      return serverError(error, "Couldn't remove the bookmark.");
    }
  });
}
