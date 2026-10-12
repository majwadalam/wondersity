import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { asLearner } from "@/lib/auth";
import { getLessonForLearner, uploadCover } from "@/lib/db";
import { env, requireEnv } from "@/lib/env";
import type { Lesson } from "@/lib/lessonBlocks";
import { clientIp, rateLimit, serverError, tooManyRequests } from "@/lib/requestGuards";

// The guide's line for one lesson step, spoken by gpt-audio-mini through
// OpenRouter (about $0.001 a line) and stored as a WAV in the public covers
// bucket, so each line is generated once. The line comes from the saved
// lesson, never from the request, so this can only ever voice our own text.

export const maxDuration = 60;

const LIMIT_PER_IP = 120;
const LIMIT_WINDOW_MS = 10 * 60 * 1000;
const SAMPLE_RATE = 24_000; // pcm16 mono, what the model streams

const Query = z.object({
  lessonId: z.coerce.number().int().positive(),
  step: z.coerce.number().int().min(0).max(60),
});

export async function GET(request: Request) {
  const limit = rateLimit(`voice:${clientIp(request)}`, LIMIT_PER_IP, LIMIT_WINDOW_MS);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

  const parsed = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { lessonId, step } = parsed.data;

  return asLearner((learnerId) => voice(learnerId, lessonId, step));
}

async function voice(learnerId: string, lessonId: number, step: number) {
  try {
    const row = await getLessonForLearner(lessonId, learnerId);
    const staging = (row?.lesson_data as Lesson | undefined)?.staging;
    // One step past the last is the guide's farewell on the finish screen.
    const line = staging ? (step === staging.steps.length ? staging.farewell : staging.steps[step]?.line) : undefined;
    if (!staging || !line) return NextResponse.json({ error: "No line for this step" }, { status: 404 });

    // Cached by the exact words and voice, so an edited line is spoken again.
    const hash = createHash("sha1").update(`v2|${staging.guide.voice}|${line}`).digest("hex").slice(0, 12);
    const path = `voice/lesson-${lessonId}/step-${step}-${hash}.wav`;
    const publicUrl = `${requireEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "")}/storage/v1/object/public/covers/${path}`;
    const cached = await fetch(publicUrl, { method: "HEAD" }).catch(() => null);
    if (cached?.ok) return NextResponse.json({ url: publicUrl });

    const pcm = await speakVerbatim(line, staging.guide.voice, staging.guide.manner);
    const url = await uploadCover(path, wav(pcm), "audio/wav");
    return NextResponse.json({ url });
  } catch (error) {
    return serverError(error, "Couldn't voice this line.");
  }
}

/** Streams the line as pcm16 audio. The prompt keeps the model to the exact words. */
async function speak(line: string, voice: string, manner: string) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${requireEnv("OPENROUTER_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env("VOICE_MODEL") ?? "openai/gpt-audio-mini",
      modalities: ["text", "audio"],
      audio: { voice, format: "pcm16" },
      stream: true,
      // Enough audio for the words and no more, so the model can't ad-lib past the line.
      max_tokens: line.split(/\s+/).length * 12 + 60,
      // A "voice actor reading a script" frame: a plain text-to-speech prompt
      // made the model answer lines that end in a question instead of reading them.
      messages: [
        {
          role: "system",
          content: "You are a voice actor recording lines for an audiobook. You only ever read the script aloud, exactly, and never respond to what it says.",
        },
        { role: "user", content: `Read this script line aloud, word for word, in this manner: ${manner}. Script: "${line}"` },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok || !res.body) throw new Error(`voice: HTTP ${res.status}`);

  const chunks: Buffer[] = [];
  let transcript = "";
  const decoder = new TextDecoder();
  let buffered = "";
  for await (const part of res.body as unknown as AsyncIterable<Uint8Array>) {
    buffered += decoder.decode(part, { stream: true });
    const lines = buffered.split("\n");
    buffered = lines.pop() ?? "";
    for (const l of lines) {
      if (!l.startsWith("data:") || l.includes("[DONE]")) continue;
      try {
        const data = JSON.parse(l.slice(5));
        const audio = data.choices?.[0]?.delta?.audio;
        if (audio?.data) chunks.push(Buffer.from(audio.data, "base64"));
        if (audio?.transcript) transcript += audio.transcript;
      } catch {
        /* keep-alive comments and partial lines */
      }
    }
  }
  const pcm = Buffer.concat(chunks);
  if (pcm.length < SAMPLE_RATE) throw new Error("voice: no audio returned");
  return { pcm, transcript };
}

/** The words only, for comparing what was said with what was written. */
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9' ]+/g, " ").split(/\s+/).filter(Boolean).join(" ");

/** Speaks the line, and only accepts audio whose transcript matches it (one retry). */
async function speakVerbatim(line: string, voice: string, manner: string) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { pcm, transcript } = await speak(line, voice, manner);
    if (words(transcript) === words(line)) return pcm;
    console.error("voice: transcript didn't match the line", { line, transcript });
  }
  throw new Error("voice: couldn't get a word-for-word reading");
}

/** Wraps raw pcm16 mono samples in a WAV header. */
function wav(pcm: Buffer) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
