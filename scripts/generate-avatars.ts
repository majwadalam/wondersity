// Paints the avatars learners pick in Settings (src/lib/avatars.ts) into
// public/art/avatars/ with Gemini Nano Banana 2.1 through OpenRouter (about
// $0.04 each). One style prompt, so the set looks like one family.
//
//   pnpm tsx --env-file=.env.local scripts/generate-avatars.ts        # missing ones only
//   pnpm tsx --env-file=.env.local scripts/generate-avatars.ts fox    # redo one
//
// Add an avatar to AVATARS and run it again.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { AVATARS } from "../src/lib/avatars";

const MODEL = process.env.ART_MODEL ?? "google/gemini-nano-banana-2.1";
const OUT = join(process.cwd(), "public", "art", "avatars");
// Soft tints from the palette; each avatar gets one by its position, so the set varies but matches.
const TINTS = ["#E6EEF8", "#FFF3E6", "#E9F6EF", "#F2EEFE", "#FDEEF4", "#E6F6FD"];

const style = (subject: string, background: string) =>
  `A profile avatar, soft 3D clay render: ${subject}. ` +
  "Head and shoulders, centred, facing slightly toward the viewer, filling about 70% of a square frame, so it still reads when cropped to a circle. " +
  "Soft matte clay with gently rounded, slightly simplified forms. Soft studio lighting from the upper left, gentle ambient occlusion. " +
  "Restrained palette: ivory, Aegean blue #1F5FA8, soft cyan #6EC3F4 and one warm accent #FFB86B, plus the animal's natural colours. " +
  `Seamless solid background in ${background}. Friendly, calm, premium. ` +
  "No text, letters, numbers, logos or watermarks. No people or hands. No borders or frames.";

async function generate(id: string, subject: string, background: string) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: style(subject, background) }],
      modalities: ["image", "text"],
      image_config: { aspect_ratio: "1:1" },
    }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) throw new Error(`${id}: HTTP ${res.status} ${await res.text()}`);
  const data = await res.json();
  const url: string | undefined = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url) throw new Error(`${id}: no image returned`);
  const base64 = url.split(",", 2)[1];
  // 256px covers the largest place an avatar is drawn (56px) at high pixel density.
  writeFileSync(join(OUT, `${id}.webp`), await sharp(Buffer.from(base64, "base64")).resize(256, 256).webp({ quality: 82 }).toBuffer());
  console.log(`✓ ${id}.webp`);
}

async function main() {
  if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not set (pass --env-file=.env.local)");
  mkdirSync(OUT, { recursive: true });
  const only = process.argv.slice(2);
  const todo = AVATARS.map((a, i) => ({ ...a, background: TINTS[i % TINTS.length] })).filter(({ id }) =>
    only.length ? only.includes(id) : !existsSync(join(OUT, `${id}.webp`))
  );
  // A few at a time keeps within rate limits.
  for (let i = 0; i < todo.length; i += 4) {
    const results = await Promise.allSettled(todo.slice(i, i + 4).map((t) => generate(t.id, t.subject, t.background)));
    for (const r of results) if (r.status === "rejected") console.error(`✗ ${r.reason}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
