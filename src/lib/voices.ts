// A course's cast: which voice each character speaks in. Staging picks a
// voice for the guide, but left to itself the model gave nearly every male
// guide "cedar", so courses sounded alike, and a course whose lessons had
// several guides gave them all one voice. The cast fixes both:
//
// - A character keeps their voice in every lesson of the course.
// - A new character gets a voice of the kind the model asked for (deeper,
//   brighter or neutral) that no one else in the course uses yet.
// - Which voice of that kind comes first varies by course, so two courses
//   with similar guides still sound different.
// - The learner can recast anyone on the course page (`chosen`).
//
// Stored in courses.voices (migration 019), keyed by the character's name in
// lower case. Pure functions only.

export const VOICES = ["cedar", "marin", "ash", "ballad", "coral", "sage", "verse", "echo"] as const;
export type Voice = (typeof VOICES)[number];

export const REGISTERS = {
  deep: ["cedar", "ash", "verse"],
  bright: ["marin", "coral", "ballad"],
  neutral: ["sage", "echo"],
} as const satisfies Record<string, readonly Voice[]>;
export type Register = keyof typeof REGISTERS;

/** How each voice sounds, for the picker on the course page. */
export const VOICE_INFO: Record<Voice, { label: string; about: string }> = {
  cedar: { label: "Cedar", about: "Deep and steady" },
  ash: { label: "Ash", about: "Low and thoughtful" },
  verse: { label: "Verse", about: "Rich and expressive" },
  marin: { label: "Marin", about: "Warm and clear" },
  coral: { label: "Coral", about: "Bright and lively" },
  ballad: { label: "Ballad", about: "Soft and melodic" },
  sage: { label: "Sage", about: "Calm and even" },
  echo: { label: "Echo", about: "Light and crisp" },
};

export type CastMember = { name: string; voice: Voice; manner?: string; portrait?: string; chosen?: boolean };
export type Cast = Record<string, CastMember>;

export const isVoice = (v: unknown): v is Voice => typeof v === "string" && (VOICES as readonly string[]).includes(v);

export const registerOf = (voice: Voice): Register =>
  (Object.keys(REGISTERS) as Register[]).find((r) => (REGISTERS[r] as readonly Voice[]).includes(voice)) ?? "neutral";

/** The key a character is stored under: "Dr. Ada Reyes " and "dr. ada reyes" are one person. */
export const castKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 80);

/** A small stable hash, so a course's choices don't change between runs. */
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Keeps only well-formed members (courses.voices is jsonb, so it's checked like any input). */
export function readCast(raw: unknown): Cast {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Cast = {};
  for (const [key, m] of Object.entries(raw as Record<string, unknown>)) {
    if (!m || typeof m !== "object") continue;
    const { name, voice, manner, portrait, chosen } = m as Record<string, unknown>;
    if (typeof name !== "string" || !isVoice(voice)) continue;
    out[key] = {
      name,
      voice,
      ...(typeof manner === "string" ? { manner } : {}),
      ...(typeof portrait === "string" ? { portrait } : {}),
      ...(chosen === true ? { chosen } : {}),
    };
  }
  return out;
}

/**
 * The voice a character speaks in, adding them to the cast if they're new.
 * `preferred` is the voice staging asked for; only its kind is kept, so the
 * course decides which voice of that kind. Returns the cast unchanged (same
 * object) when nothing was added, so callers know whether to save it.
 */
export function castVoice(
  cast: Cast,
  character: { name: string; voice?: Voice; register?: Register; manner?: string; portrait?: string },
  seed: string | number
): { voice: Voice; cast: Cast } {
  const key = castKey(character.name);
  const known = cast[key];
  if (known) {
    // A portrait painted after they were cast is remembered for the course page.
    if (character.portrait && !known.portrait) return { voice: known.voice, cast: { ...cast, [key]: { ...known, portrait: character.portrait } } };
    return { voice: known.voice, cast };
  }
  const register = character.register ?? (character.voice ? registerOf(character.voice) : "neutral");
  const options = REGISTERS[register];
  const start = hash(`${seed}`) % options.length;
  const ordered = options.map((_, i) => options[(start + i) % options.length]);
  const taken = new Set(Object.values(cast).map((m) => m.voice));
  // Everyone of this kind is taken: share one, picked by name so it's stable.
  const voice = ordered.find((v) => !taken.has(v)) ?? ordered[hash(`${seed}|${key}`) % ordered.length];
  const member: CastMember = {
    name: character.name.trim().slice(0, 80),
    voice,
    ...(character.manner ? { manner: character.manner.slice(0, 120) } : {}),
    ...(character.portrait ? { portrait: character.portrait } : {}),
  };
  return { voice, cast: { ...cast, [key]: member } };
}

/** The speaker of a dialogue turn who is the guide ("Socrates" for "Socrates of Athens"), if any. */
export function isGuide(speaker: string, guideName: string) {
  const s = castKey(speaker);
  const g = castKey(guideName);
  if (!s || !g) return false;
  if (s === g || s === "guide") return true;
  // "Dr. Reyes" for "Dr. Ada Reyes", "Seneca" for "Seneca the Younger".
  const words = (x: string) => x.replace(/^(dr|prof|professor)\.?\s+/, "").split(" ");
  const [sw, gw] = [words(s), words(g)];
  return sw.length === 1 ? gw.includes(sw[0]) : sw.every((w) => gw.includes(w));
}
