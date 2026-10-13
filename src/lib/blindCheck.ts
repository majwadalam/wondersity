// The blind test: a model sees only each question's four options, without the
// question or the lesson, and guesses. A confident right guess means the
// options give the answer away (Balepur et al. 2024: models beat chance from
// the choices alone). See lib/questionCheck.ts for the checks done in code.

import { z } from "zod";
import { env } from "./env";
import type { Question } from "./lessonBlocks";
import { callStructured, type Deadline } from "./model";

const short = (s: string) => (s.length > 60 ? `${s.slice(0, 57)}…` : s);

const blindModel = () => env("BLIND_MODEL") || env("VERIFY_MODEL") || "openai/gpt-6-luna";

const BlindSchema = z.object({
  guesses: z.array(
    z.object({ question: z.number().int(), pick: z.number().int(), confidence: z.enum(["low", "medium", "high"]), basis: z.enum(["wording", "knowledge"]) })
  ),
});

const blindJsonSchema = {
  type: "object",
  properties: {
    guesses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "integer" },
          pick: { type: "integer" },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
          basis: { type: "string", enum: ["wording", "knowledge"] },
        },
        required: ["question", "pick", "confidence", "basis"],
        additionalProperties: false,
      },
    },
  },
  required: ["guesses"],
  additionalProperties: false,
};

/**
 * Shows a model only each question's options and asks it to guess the right
 * one. Returns a message for each question it got right with high confidence.
 * Throws on call failures (the caller treats that as "not checked").
 */
export async function blindCheck(topic: string, questions: Question[], deadline: Deadline): Promise<string[]> {
  if (!questions.length) return [];
  const data = await callStructured(
    `You are testing quiz questions for giveaways. For each question you see ONLY its four options:
not the question, not the lesson. Guess which option is the correct answer using only cues in the
options themselves (one more complete, careful, specific or hedged than the rest; one that differs
in kind; the others sharing a flaw). "pick" is the option's number (1-4). Say "high" confidence only
when the options really give the answer away; when they don't, say "low". "basis" says what your
guess rests on: "wording" if it's how the options are written (length, detail, hedging, one odd one
out), "knowledge" if you recognised the subject and know the answer.`,
    `Course topic: ${topic}\n\n${questions.map((q, i) => `Question ${i + 1}:\n${q.options.map((o, j) => `  ${j + 1}. ${o}`).join("\n")}`).join("\n\n")}`,
    blindJsonSchema,
    deadline,
    { model: blindModel(), reasoningEffort: "low", timeoutMs: 45_000, maxTokens: 2_000 }
  );
  const { guesses } = BlindSchema.parse(data);
  return guesses
    // Only cues in the wording count: an expert who knows the subject is meant to get it right
    // (run 13: the textbook prisoner's dilemma was "guessed" from knowledge, not from its options).
    .filter((g) => g.confidence === "high" && g.basis === "wording" && questions[g.question - 1]?.options[g.pick - 1] === questions[g.question - 1]?.correctAnswer)
    .map((g) => `Question ${g.question} ("${short(questions[g.question - 1].question)}"): a reader who saw only the options picked the right answer with confidence, so the options give it away. Make the wrong options as specific and plausible as the right one, each built on a real misconception.`);
}
