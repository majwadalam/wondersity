import { NextResponse } from "next/server";
import { asLearner } from "@/lib/auth";
import { MAX_UPLOAD_BYTES, capText, extractText, fileKind } from "@/lib/materialText";
import { clientIp, rateLimit, serverError, tooManyRequests } from "@/lib/requestGuards";

// Reads the text out of one file a learner adds to "Tailor it" (PDF, Word,
// text, Markdown) and returns it. Nothing is stored: the text comes back with
// the course request, and is saved with the course it shapes.
export const maxDuration = 60;

const LIMIT_PER_IP = 20;
const LIMIT_WINDOW_MS = 10 * 60 * 1000;

export async function POST(request: Request) {
  const limit = rateLimit(`materials:${clientIp(request)}`, LIMIT_PER_IP, LIMIT_WINDOW_MS);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

  return asLearner(async () => {
    let file: File | null = null;
    try {
      const form = await request.formData();
      const value = form.get("file");
      file = value instanceof File ? value : null;
    } catch {
      /* not a form */
    }
    if (!file) return NextResponse.json({ error: "Choose a file to add." }, { status: 400 });
    if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "That file is over 10 MB. Try a smaller one, or paste the part you need." }, { status: 413 });
    const kind = fileKind(file.name, file.type);
    if (!kind) return NextResponse.json({ error: "We can read PDF, Word (.docx), text and Markdown files." }, { status: 415 });

    try {
      const { text, pages } = await extractText(new Uint8Array(await file.arrayBuffer()), kind);
      if (text.length < 40) {
        return NextResponse.json(
          { error: kind === "pdf" ? "We couldn't find text in that PDF. If it's scanned, paste the text instead." : "That file has almost no text in it." },
          { status: 422 }
        );
      }
      const capped = capText(text);
      return NextResponse.json({ name: file.name.slice(0, 120), text: capped.text, chars: capped.text.length, truncated: capped.truncated, pages: pages ?? null });
    } catch (error) {
      return serverError(error, "We couldn't read that file. Try another, or paste the text instead.");
    }
  });
}
