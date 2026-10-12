// Generates the landing page's pictures in public/art/landing/ with Gemini
// Nano Banana 2.1 through OpenRouter (about $0.04 each):
//
//   hero   the world the hero scrolls across: the product's own world prompt
//          for the test account's Stoicism course and its three levels
//   world  the closing illustration (the agora at dusk)
//
//   pnpm tsx --env-file=.env.local scripts/generate-landing-art.ts hero
//   pnpm tsx --env-file=.env.local scripts/generate-landing-art.ts world

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { generateImage, worldPrompt } from "../src/lib/coverArt";

const OUT = join(process.cwd(), "public", "art", "landing");

const PICTURES: Record<string, string> = {
  hero: worldPrompt("Stoicism", [
    "The Stoic Worldview: nature, the mind and what is in our control",
    "The Stoic Toolkit: daily exercises and practices",
    "Living It: the practice in action, with emotions, community and the real world",
  ]),
  world:
    "A wide soft 3D clay diorama of the ancient Athenian agora at dusk: marble stoas and columns, small stalls, a few tiny friendly clay figures talking in pairs, the Acropolis on a hill in the distance. " +
    "Dreamy palette of violet #7C6CF6, magenta, lilac and deep indigo, with warm golden lamp light in a few windows, a starry violet sky with a soft glow on the horizon. " +
    "Matte clay materials, gently rounded simplified forms, cinematic wide framing, calm and magical. No text, letters, logos or borders.",
};

async function main() {
  const names = process.argv.slice(2).filter((n) => n in PICTURES);
  if (!names.length) throw new Error(`Say which picture to paint: ${Object.keys(PICTURES).join(", ")}`);
  mkdirSync(OUT, { recursive: true });
  for (const name of names) {
    const { bytes } = await generateImage(PICTURES[name], "21:9");
    const webp = await sharp(bytes).resize({ width: 2400, withoutEnlargement: true }).webp({ quality: 84 }).toBuffer();
    writeFileSync(join(OUT, `${name}.webp`), webp);
    console.log(`${name}.webp`, `${Math.round(webp.length / 1024)} KB`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
