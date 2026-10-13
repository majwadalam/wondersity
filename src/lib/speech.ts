// Speaking a line with gpt-audio-mini through OpenRouter (about $0.001 a
// line): streamed as pcm16, accepted only when the transcript matches the
// words, wrapped as a WAV. Used by GET /api/voice and scripts/generate-voice-samples.ts.

import { env, requireEnv } from "./env";
import { ModelHttpError } from "./model";

const SAMPLE_RATE = 24_000; // pcm16 mono, what the model streams

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
  if (!res.ok || !res.body) throw new ModelHttpError(res.status || 502, `voice: ${res.ok ? "no audio" : (await res.text()).slice(0, 300)}`);

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
export async function speakVerbatim(line: string, voice: string, manner: string) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { pcm, transcript } = await speak(line, voice, manner);
    if (words(transcript) === words(line)) return pcm;
    console.error("voice: transcript didn't match the line", { line, transcript });
  }
  throw new Error("voice: couldn't get a word-for-word reading");
}

/** Wraps raw pcm16 mono samples in a WAV header. */
export function wav(pcm: Buffer) {
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

/**
 * A dialogue turn as it should be read: formatting marks dropped. A turn with
 * math or code isn't voiced (it would be read symbol by symbol); the learner
 * reads that one.
 */
export function speakable(text: string) {
  if (/\\\(|\\\[|\$\$|```|\\ce\{/.test(text)) return undefined;
  const plain = text
    .replace(/\*\*|__|`/g, "")
    .replace(/(^|\s)[*_](\S[^*_]*\S)[*_](?=\s|$|[.,;:!?])/g, "$1$2")
    .replace(/\s+/g, " ")
    .trim();
  return plain || undefined;
}
