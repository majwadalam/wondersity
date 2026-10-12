import Image from "next/image";

// Cover illustrations made by scripts/generate-art.ts (Gemini Nano Banana,
// soft 3D clay on a palette tint). Topics without their own art get the
// default cover. Keep this list in step with SUBJECTS in that script.
const ART: Record<string, string> = {
  stoicism: "webp",
  "black-holes": "webp",
  "game-theory": "webp",
  photosynthesis: "webp",
  "jazz-harmony": "webp",
  "machine-learning": "webp",
  "the-french-revolution": "webp",
  "the-fall-of-rome": "webp",
  "supply-and-demand": "webp",
  socrates: "webp",
  default: "webp",
};

/** "The Fall of Rome!" → "the-fall-of-rome". */
export const topicSlug = (topic: string) =>
  topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function courseArtSrc(topic: string) {
  const slug = topicSlug(topic);
  const key = slug in ART ? slug : "default";
  return `/art/${key}.${ART[key]}`;
}

/** The cover image, filling its (relatively positioned) parent. */
export function CourseArt({ topic, sizes = "(min-width: 1024px) 33vw, 100vw", priority = false }: { topic: string; sizes?: string; priority?: boolean }) {
  return <Image unoptimized src={courseArtSrc(topic)} alt="" fill sizes={sizes} priority={priority} className="object-cover" />;
}
