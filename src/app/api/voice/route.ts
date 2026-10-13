import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { asLearner } from "@/lib/auth";
import { voiceFor } from "@/lib/courseCast";
import { getLessonForLearner, uploadCover } from "@/lib/db";
import { requireEnv } from "@/lib/env";
import { lessonBlocks, type Lesson } from "@/lib/lessonBlocks";
import { clientIp, rateLimit, serverError, tooManyRequests } from "@/lib/requestGuards";
import { speakable, speakVerbatim, wav } from "@/lib/speech";

// One spoken line of a lesson: the guide's line for a step (?step=), or one
// turn of a dialogue block (?block=&turn=), in the voice the course cast for
// that speaker (lib/courseCast.ts). Spoken by gpt-audio-mini (lib/speech.ts,
// about $0.001 a line) and stored as a WAV in the public covers bucket, so each
// line is generated once per voice. The words come from the saved lesson,
// never from the request, so this can only ever voice our own text.

export const maxDuration = 60;

const LIMIT_PER_IP = 120;
const LIMIT_WINDOW_MS = 10 * 60 * 1000;

const Query = z.union([
  z.object({ lessonId: z.coerce.number().int().positive(), step: z.coerce.number().int().min(0).max(60) }),
  z.object({ lessonId: z.coerce.number().int().positive(), block: z.coerce.number().int().min(0).max(60), turn: z.coerce.number().int().min(0).max(40) }),
]);

export async function GET(request: Request) {
  const limit = rateLimit(`voice:${clientIp(request)}`, LIMIT_PER_IP, LIMIT_WINDOW_MS);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

  const parsed = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  return asLearner((learnerId) => voice(learnerId, parsed.data));
}

async function voice(learnerId: string, q: z.infer<typeof Query>) {
  try {
    const row = await getLessonForLearner(q.lessonId, learnerId);
    const lesson = row?.lesson_data as Lesson | undefined;
    const staging = lesson?.staging;
    if (!row || !lesson || !staging) return NextResponse.json({ error: "No line for this step" }, { status: 404 });

    let line: string | undefined;
    let speaker: string | undefined;
    let name: string;
    if ("step" in q) {
      // One step past the last is the guide's farewell on the finish screen.
      line = q.step === staging.steps.length ? staging.farewell : staging.steps[q.step]?.line;
      name = `step-${q.step}`;
    } else {
      const block = lessonBlocks(lesson)[q.block];
      const turn = block?.kind === "dialogue" ? block.turns[q.turn] : undefined;
      line = turn ? speakable(turn.text) : undefined;
      speaker = turn?.speaker;
      name = `block-${q.block}-turn-${q.turn}`;
    }
    if (!line) return NextResponse.json({ error: "No line for this step" }, { status: 404 });

    const { voice, manner } = await voiceFor(row.course_id, learnerId, staging, speaker);
    // Cached by the exact words and voice, so an edited line or a recast speaker is spoken again.
    const hash = createHash("sha1").update(`v2|${voice}|${line}`).digest("hex").slice(0, 12);
    const path = `voice/lesson-${q.lessonId}/${name}-${hash}.wav`;
    const publicUrl = `${requireEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "")}/storage/v1/object/public/covers/${path}`;
    const cached = await fetch(publicUrl, { method: "HEAD" }).catch(() => null);
    if (cached?.ok) return NextResponse.json({ url: publicUrl });

    const pcm = await speakVerbatim(line, voice, manner);
    const url = await uploadCover(path, wav(pcm), "audio/wav");
    return NextResponse.json({ url });
  } catch (error) {
    return serverError(error, "Couldn't voice this line.");
  }
}
