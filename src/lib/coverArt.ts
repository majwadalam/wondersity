// Image prompts (a course's world, a lesson's scenes) and generation with
// Gemini Nano Banana through OpenRouter. Used by /api/covers and /api/stage.
// About $0.035 an image.

import { ModelHttpError, recordUsage } from "./model";
import { requireEnv, env } from "./env";

/**
 * The course's world: one wide illustrated landscape the journey is drawn
 * across. Regions run left to right in level order, so lessons placed along
 * a path over it pass through them.
 */
export const worldPrompt = (topic: string, regions: string[]) =>
  `A wide panoramic illustrated landscape that is the world of a course on ${topic}, seen from a high three-quarter view like a storybook map diorama. ` +
  `From left to right it passes through ${regions.length} distinct regions that tell the story in order: ${regions.map((r, i) => `(${i + 1}) ${r}`).join(", ")}. ` +
  "Each region shows concrete, recognisable places and objects from that part of the story, connected by one winding road from the far left to the far right. " +
  "Style: soft painterly 3D clay diorama, matte materials, gentle daylight from the upper left, soft shadows, rich but calm colours with blurple #635BFF, cyan #6EC3F4 and warm #FFB86B accents. " +
  "Leave the sky light and simple. No text, labels, letters, numbers, logos or borders. No people's faces in close-up.";

/** A scene inside a lesson: an illustration of a moment, place or idea. */
export const scenePrompt = (scene: string, topic: string) =>
  `An illustration of this scene from a lesson on ${topic}: ${scene}. ` +
  "Style: soft painterly 3D clay diorama, cinematic wide framing, matte materials, warm directional light, calm rich colours with blurple #635BFF and warm #FFB86B accents, shallow depth of field. " +
  "Historically accurate for that exact place and period: correct architecture, materials, dress and landscape, nothing anachronistic and no symbols from other cultures or religions. People are stylised clay figures with simple, friendly, expressive faces (eyes, brows, mouth), never blank or faceless, never photoreal, never a real person's likeness. No text, letters, captions, logos or borders.";

export async function generateImage(prompt: string, aspectRatio: "4:3" | "16:9" | "21:9", timeoutMs = 120_000) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${requireEnv("OPENROUTER_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env("ART_MODEL") ?? "google/gemini-nano-banana-2.1",
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
      // One image is about 1,300 output tokens. Capping output keeps OpenRouter
      // from reserving the worst-case cost of a huge reply (a 402 when credit is low).
      max_tokens: 4000,
      image_config: { aspect_ratio: aspectRatio },
      usage: { include: true },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  // A provider error, so serverError classifies it (credit, limits, outage) like any model call.
  if (!res.ok) throw new ModelHttpError(res.status, `image: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  // Paintings are the largest cost per lesson, so they count in the run's total.
  recordUsage(data.usage);
  const url: string | undefined = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url?.startsWith("data:image/")) throw new Error("image: none returned");
  const [head, base64] = url.split(",", 2);
  const type = head.slice(5, head.indexOf(";"));
  return { bytes: Buffer.from(base64, "base64"), type, ext: type === "image/png" ? "png" : "jpg" };
}
