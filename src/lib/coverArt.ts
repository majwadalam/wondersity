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
  // Regions are described by what they show, never by title or number: given
  // "(1) Origins and the Early Republic", the model painted the titles as signs.
  `From left to right it passes through ${regions.length} distinct regions that tell the story in order. ${regions
    .map((r, i) => `${i === 0 ? "First" : i === regions.length - 1 ? "Finally" : "Then"}, a region about: ${r}`)
    .join(". ")}. ` +
  "Each region shows concrete, recognisable places and objects from that part of the story, connected by one winding road from the far left to the far right. " +
  "Show the regions only through places, buildings, landscapes and objects: never write their names or any words on banners, signs or ground. " +
  "Style: soft painterly 3D clay diorama, matte materials, gentle daylight from the upper left, soft shadows, rich but calm colours with blurple #635BFF, cyan #6EC3F4 and warm #FFB86B accents. " +
  "Leave the sky light and simple. No text, labels, letters, numbers, logos or borders. No people's faces in close-up.";

/** A scene inside a lesson: an illustration of a moment, place or idea. */
export const scenePrompt = (scene: string, topic: string) =>
  `An illustration of this scene from a lesson on ${topic}: ${scene}. ` +
  "Style: soft painterly 3D clay diorama, cinematic wide framing, matte materials, warm directional light, calm rich colours with blurple #635BFF and warm #FFB86B accents, shallow depth of field. " +
  "Historically accurate for that exact place and period: correct architecture, materials, dress and landscape, nothing anachronistic and no symbols from other cultures or religions. People are stylised clay figures with simple, friendly, expressive faces (eyes, brows, mouth), never blank or faceless, never photoreal, never a real person's likeness. No text, letters, captions, logos or borders.";

const artModel = () => env("ART_MODEL") ?? "google/gemini-nano-banana-2.1";
// Used when the main model is rate-limited or down: same price per image. Run
// 2026-10-12: Nano Banana 2.1 was rate-limited upstream for minutes at a time,
// so every painting failed while this model answered in 4 seconds.
const fallbackArtModel = () => env("ART_FALLBACK_MODEL") ?? "google/gemini-3.1-flash-lite-image";

/** Worth trying again: rate limits, provider errors and timeouts, not credit or bad requests. */
const transient = (e: unknown) =>
  (e instanceof ModelHttpError && (e.status === 429 || e.status >= 500)) || (e instanceof Error && /timeout|aborted|fetch failed/i.test(e.message));

/**
 * One image. A transient failure is retried once after a short wait, then
 * tried once on the fallback model; anything else (no credit, a bad request)
 * fails at once.
 */
export async function generateImage(prompt: string, aspectRatio: "4:3" | "16:9" | "21:9", timeoutMs = 120_000) {
  const attempts = [artModel(), artModel(), fallbackArtModel()];
  let last: unknown;
  for (const [i, model] of attempts.entries()) {
    try {
      return await paintOnce(model, prompt, aspectRatio, timeoutMs);
    } catch (e) {
      last = e;
      if (!transient(e)) throw e;
      console.warn(`image: ${model} failed (${e instanceof ModelHttpError ? e.status : "error"}), ${i < attempts.length - 1 ? "trying again" : "giving up"}`);
      if (i === 0) await new Promise((r) => setTimeout(r, 3_000));
    }
  }
  throw last;
}

async function paintOnce(model: string, prompt: string, aspectRatio: "4:3" | "16:9" | "21:9", timeoutMs: number) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${requireEnv("OPENROUTER_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
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
