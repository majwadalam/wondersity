// Generates the course cover illustrations in public/art/ with Gemini Nano
// Banana 2.1 through OpenRouter (about $0.04 per image). Every image uses the
// same style prompt so the set looks like one family.
//
//   pnpm tsx --env-file=.env.local scripts/generate-art.ts            # missing images only
//   pnpm tsx --env-file=.env.local scripts/generate-art.ts stoicism   # redo one
//
// Add a subject below and run it again to make a new cover.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const MODEL = process.env.ART_MODEL ?? "google/gemini-nano-banana-2.1";
const OUT = join(process.cwd(), "public", "art");
// Soft tints from the palette; each subject gets one by its position, so covers vary but match.
const TINTS = ["#EEF0FF", "#E6F6FD", "#F2EEFE", "#FFF3E6", "#E9F6EF", "#FDEEF4"];

/** slug → what to draw. Slugs match topicSlug() in src/components/app/CourseArt.tsx. */
export const SUBJECTS: Record<string, string> = {
  stoicism: "a white marble bust-shaped pedestal holding a calm smooth stone, with a small gold laurel sprig beside it",
  "black-holes": "a dark glossy sphere with a glowing thin ring of orange and blue light swirling around it, like a tiny black hole",
  "game-theory": "a chessboard corner with two pawns facing each other, one white and one blue, and a small gold coin between them",
  photosynthesis: "a bright green leaf on a small stem, with a soft yellow sun orb above it and tiny glowing particles drifting into the leaf",
  "jazz-harmony": "a gleaming gold saxophone lying next to three floating rounded music notes in blue",
  "machine-learning": "a small rounded robot head made of white and blue clay, next to a tiny stack of glowing data cubes",
  "the-french-revolution": "a blue, white and red cockade rosette next to a small round loaf of bread and a broken gold crown",
  "the-fall-of-rome": "a cracked white marble Roman column fragment lying on its side, with a red Roman helmet with a plume beside it",
  "supply-and-demand": "two curved arrows, one blue rising and one coral falling, crossing over a small stack of gold coins",
  socrates: "a white marble Greek Ionic column with a small gold laurel wreath resting at its base",
  default: "an open book with a small glowing lightbulb floating above its pages",
};

const style = (subject: string, background: string) =>
  `A single object composition, soft 3D clay render: ${subject}. ` +
  "Rendered as a soft 3D matte clay sculpture with gently rounded, slightly simplified forms. " +
  "Centered composition, objects fill about 55% of the frame, three-quarter view from slightly above, generous empty space around them. " +
  "Soft studio lighting from the upper left, gentle ambient occlusion, one soft contact shadow beneath. " +
  "Restrained palette: ivory, blurple #635BFF, soft cyan #6EC3F4 and one warm accent #FFB86B, plus the object's natural colours. " +
  `Seamless solid background in ${background} with a very subtle radial vignette. Premium, calm, editorial product-render feel. ` +
  "No text, letters, numbers, logos or watermarks. No people, faces or hands. No busy scenes, no neon glow, no borders or frames, no cartoon eyes.";

async function generate(slug: string, subject: string, background: string) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: style(subject, background) }],
      modalities: ["image", "text"],
      image_config: { aspect_ratio: "4:3" },
    }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) throw new Error(`${slug}: HTTP ${res.status} ${await res.text()}`);
  const data = await res.json();
  const url: string | undefined = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url) throw new Error(`${slug}: no image returned`);
  const base64 = url.split(",", 2)[1];
  // Saved web-sized (900px WebP, ~10 KB), so pages serve it as is.
  writeFileSync(join(OUT, `${slug}.webp`), await sharp(Buffer.from(base64, "base64")).resize({ width: 900 }).webp({ quality: 80 }).toBuffer());
  console.log(`✓ ${slug}.webp`);
}

async function main() {
  if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not set (pass --env-file=.env.local)");
  mkdirSync(OUT, { recursive: true });
  const only = process.argv.slice(2);
  const todo = Object.entries(SUBJECTS)
    .map(([slug, subject], i) => ({ slug, subject, background: TINTS[i % TINTS.length] }))
    .filter(({ slug }) =>
      only.length ? only.includes(slug) : !existsSync(join(OUT, `${slug}.webp`))
    );
  // A few at a time keeps within rate limits.
  for (let i = 0; i < todo.length; i += 4) {
    const results = await Promise.allSettled(todo.slice(i, i + 4).map((t) => generate(t.slug, t.subject, t.background)));
    for (const r of results) if (r.status === "rejected") console.error(`✗ ${r.reason}`);
  }
}

main();
