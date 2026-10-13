// Records the short samples the course page plays when a learner picks a
// voice for a character (public/audio/voices/<voice>.wav), with the same
// speech call lessons use (lib/speech.ts, about $0.001 each).
//
//   node --env-file=.env.local --import tsx scripts/generate-voice-samples.ts          # missing ones only
//   node --env-file=.env.local --import tsx scripts/generate-voice-samples.ts cedar    # redo one

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { speakVerbatim, wav } from "../src/lib/speech";
import { VOICE_INFO, VOICES } from "../src/lib/voices";

const OUT = join(process.cwd(), "public", "audio", "voices");
const LINE = "Hello. I'll be your guide on this course. Shall we begin?";

async function main() {
  if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not set (pass --env-file=.env.local)");
  mkdirSync(OUT, { recursive: true });
  const only = process.argv.slice(2);
  const todo = VOICES.filter((v) => (only.length ? only.includes(v) : !existsSync(join(OUT, `${v}.wav`))));
  const results = await Promise.allSettled(
    todo.map(async (v) => {
      const pcm = await speakVerbatim(LINE, v, VOICE_INFO[v].about.toLowerCase());
      writeFileSync(join(OUT, `${v}.wav`), wav(pcm));
      console.log(`✓ ${v}.wav`);
    })
  );
  for (const r of results) if (r.status === "rejected") console.error(`✗ ${r.reason}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
