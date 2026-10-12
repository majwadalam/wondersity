// Staging turns a written lesson into scenes with a guide: who teaches it
// (Socrates, a Roman historian, a field biologist…), a setting and a spoken
// line for every step, and a few painted scenes the steps share. The lesson
// itself (blocks, questions, grading) is untouched; staging only adds
// `lesson.staging`. Validated in code like everything a model returns.

import { z } from "zod";
import { lessonBlocks, type Lesson } from "./lessonBlocks";

export const VOICES = ["cedar", "marin", "ash", "ballad", "coral", "sage", "verse", "echo"] as const;

export type Staging = {
  guide: {
    name: string;
    /** One line: who they are to the learner, e.g. "Philosopher of Athens, your guide". */
    role: string;
    /** How they sound, for the voice actor: e.g. "warm, curious, unhurried". */
    manner: string;
    voice: (typeof VOICES)[number];
    /** Set once painted. */
    portrait?: string;
    portraitPrompt: string;
  };
  /**
   * 1-3 distinct paintings, each of one place and moment; its setting is the
   * caption, so a picture is never labelled as somewhere it isn't.
   */
  images: { setting: string; prompt: string; url?: string }[];
  /** What the guide says when the lesson is finished (lessons staged before it existed have none). */
  farewell?: string;
  /** steps[0] is the intro; steps[i + 1] goes with block i. `setting` only on lessons staged before images had one. */
  steps: { image: number; line: string; setting?: string }[];
};

// Each painting is about $0.035, so a lesson gets a few that its steps share.
const MAX_IMAGES = 3;

export const STAGING_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["guide", "images", "steps", "farewell"],
  properties: {
    guide: {
      type: "object",
      additionalProperties: false,
      required: ["name", "role", "manner", "voice", "portraitPrompt"],
      properties: {
        name: { type: "string" },
        role: { type: "string" },
        manner: { type: "string" },
        voice: { type: "string", enum: [...VOICES] },
        portraitPrompt: { type: "string" },
      },
    },
    images: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["setting", "prompt"],
        properties: { setting: { type: "string" }, prompt: { type: "string" } },
      },
    },
    farewell: { type: "string" },
    steps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["image", "line"],
        properties: { image: { type: "integer" }, line: { type: "string" } },
      },
    },
  },
} as const;

const Parsed = z.object({
  guide: z.object({
    name: z.string().min(1).max(60),
    role: z.string().min(1).max(120),
    manner: z.string().min(1).max(120),
    voice: z.enum(VOICES),
    portraitPrompt: z.string().min(10).max(600),
  }),
  images: z.array(z.object({ setting: z.string().max(60), prompt: z.string().min(10).max(800) })).min(1),
  steps: z.array(z.object({ image: z.number().int(), line: z.string().min(1).max(400) })),
  farewell: z.string().max(300).optional(),
});

export const STAGING_SYSTEM = `You are the director of an interactive documentary lesson. You cast a guide and stage an existing lesson as scenes. You never change the lesson's content, questions or answers.

The guide:
- If the input names the guide from earlier lessons of this course, keep that same guide (same name, manner and voice) unless this lesson is set in a different era or place they could not speak for.
- A character who fits the subject and can speak with authority: a historical figure for history or philosophy (e.g. Socrates, Seneca, a Roman senator, Marie Curie), or an invented expert for other subjects (e.g. "Dr. Ada Reyes, field biologist"). Never a living person.
- A historical figure speaks in their own voice and time, and never claims knowledge from after their death; if a step needs later knowledge, they say "historians later found…".
- manner: three or four words for how they sound. voice: pick the one that fits (cedar/ash/verse: deeper male; marin/coral/ballad: female; sage/echo: neutral).
- portraitPrompt: a stylised soft 3D clay bust of the character (or a fitting object for an invented expert), for a small round avatar. Never a photoreal face.

The images (${MAX_IMAGES} at most, usually 2-3): the main places and moments the lesson moves through. Each one is expensive, so choose the few that matter most.
- setting: the caption for that picture, a short place and time like "Antioch, Roman Syria · 380s" or "Inside a leaf · morning".
- prompt: what the picture shows, concretely, and it must actually depict that setting (an Antioch scene shows Antioch, not an Italian farm). Describe the scene only, not the style.
- Be historically accurate and specific, as a museum curator would: name the real architecture, materials, clothing and landscape of that place and time, and say what must NOT appear when a model might get it wrong (e.g. Hadrian's Wall: "a low, straight stone wall with turf ramparts and small milecastles across bare northern English moorland; not a crenellated wall with towers, nothing like the Great Wall of China"). Never mix symbols of different cultures or religions unless the lesson is about that.
- One place per image, and steps share them: give each step the image whose place fits what the guide is saying. Never show a picture whose setting doesn't fit the line.

The steps: exactly one intro step, then one step for each block listed, in order.
- image: the index of the picture this step shows.
- line: what the guide says out loud as the step opens, 1-3 sentences, under 45 words, spoken to the learner ("you"). It sets up the step: a challenge, a vivid detail, a reason to care.
- It must not give away the answer to any check or problem, and for a check it must not restate the question (the learner reads the question right below); set the stakes instead.

The farewell: what the guide says when the learner finishes, 1-2 sentences, under 35 words, in character: name the one idea to carry forward and hint at what comes next.

Return only JSON.`;

/** The user message: the lesson in compact form, one line per block. */
export function stagingInput(lesson: Lesson, topic: string, earlierGuide?: Staging["guide"]) {
  const blocks = lessonBlocks(lesson);
  const lines = blocks.map((b, i) => {
    switch (b.kind) {
      case "check": {
        const q = lesson.questions[b.ref];
        return `${i + 1}. check: ${q?.question ?? ""} (answer hidden from the learner)`;
      }
      case "activity": {
        const a = lesson.activities?.[b.ref];
        return `${i + 1}. activity (${a?.type ?? "?"}): ${a?.title ?? ""}`;
      }
      case "explain":
        return `${i + 1}. explain: ${b.heading} — ${b.body.slice(0, 220)}`;
      case "summary":
        return `${i + 1}. summary: ${b.points.join("; ").slice(0, 220)}`;
      default:
        return `${i + 1}. ${b.kind}: ${"heading" in b ? b.heading : ""}`;
    }
  });
  const guide = earlierGuide ? `Guide from earlier lessons: ${earlierGuide.name}, ${earlierGuide.role} (${earlierGuide.manner}; voice ${earlierGuide.voice})\n` : "";
  return `Course topic: ${topic}\n${guide}Lesson: ${lesson.title}\nObjective: ${lesson.objective}\n\nBlocks (${blocks.length}):\n${lines.join("\n")}\n\nWrite ${blocks.length + 1} steps: the intro, then one per block.`;
}

/** Checks the model's staging against the lesson; fixes what it safely can, rejects the rest. */
export function normalizeStaging(raw: unknown, blockCount: number): { ok: true; staging: Staging } | { ok: false; error: string } {
  const parsed = Parsed.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid staging" };
  const { guide, steps } = parsed.data;
  const images = parsed.data.images.slice(0, MAX_IMAGES);
  if (steps.length < blockCount + 1) return { ok: false, error: `expected ${blockCount + 1} steps, got ${steps.length}` };
  return {
    ok: true,
    staging: {
      guide,
      images,
      steps: steps.slice(0, blockCount + 1).map((s) => ({ line: s.line, image: Math.min(Math.max(0, s.image), images.length - 1) })),
      ...(parsed.data.farewell ? { farewell: parsed.data.farewell } : {}),
    },
  };
}
