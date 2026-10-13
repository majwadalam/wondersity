// Where a lesson's voices come from: the course's cast (lib/voices.ts), kept
// in courses.voices. Staging adds the guide and the dialogue's speakers when a
// lesson is staged; a line voiced before its speaker was cast (lessons staged
// earlier) adds them then. A lesson outside a course speaks in the voice
// staging chose.

import { addToCourseCast, getCourseCast } from "./db";
import type { Staging } from "./staging";
import { castKey, castVoice, isGuide, type Cast, type Register, type Voice } from "./voices";

const DEFAULT_MANNER = "natural, warm, conversational";

type Character = { name: string; voice?: Voice; register?: Register; manner?: string; portrait?: string };

/** Casts the lesson's guide and dialogue speakers in its course, and returns the staging with the guide's voice settled. */
export async function castStaging(courseId: number | null, learnerId: string, staging: Staging): Promise<Staging> {
  if (!courseId) return staging;
  const before = await getCourseCast(courseId, learnerId);
  let cast = before;
  const people: Character[] = [staging.guide, ...(staging.cast ?? []).filter((c) => !isGuide(c.name, staging.guide.name))];
  for (const p of people) cast = castVoice(cast, p, courseId).cast;
  if (cast !== before) cast = await addToCourseCast(courseId, learnerId, added(before, cast));
  const guide = cast[castKey(staging.guide.name)];
  return guide ? { ...staging, guide: { ...staging.guide, voice: guide.voice } } : staging;
}

/** The voice and manner for a line: the guide's, or a dialogue speaker's. */
export async function voiceFor(
  courseId: number | null,
  learnerId: string,
  staging: Staging,
  speaker?: string
): Promise<{ voice: Voice; manner: string }> {
  const character: Character =
    !speaker || isGuide(speaker, staging.guide.name)
      ? staging.guide
      : { register: "neutral", ...staging.cast?.find((c) => castKey(c.name) === castKey(speaker)), name: speaker };
  if (!courseId) return { voice: character.voice ?? "sage", manner: character.manner || DEFAULT_MANNER };
  const before = await getCourseCast(courseId, learnerId);
  const { voice, cast } = castVoice(before, character, courseId);
  if (cast !== before) await addToCourseCast(courseId, learnerId, added(before, cast));
  return { voice, manner: cast[castKey(character.name)]?.manner || character.manner || DEFAULT_MANNER };
}

/** The members `after` has that `before` doesn't (or whose portrait was just learned). */
function added(before: Cast, after: Cast): Cast {
  return Object.fromEntries(Object.entries(after).filter(([k, m]) => before[k] !== m));
}
