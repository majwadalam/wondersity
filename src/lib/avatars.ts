// The avatars a learner can pick in Settings. The pictures are painted once by
// scripts/generate-avatars.ts into public/art/avatars/<id>.webp; the profile
// stores only the id (profiles.avatar), so only these ids are accepted.

export const AVATARS = [
  { id: "owl", name: "Owl", subject: "a small round owl wearing a tiny navy beret, big calm eyes" },
  { id: "fox", name: "Fox", subject: "a friendly orange fox with a small gold laurel wreath on its head" },
  { id: "bear", name: "Bear", subject: "a cosy brown bear cub wearing round reading glasses" },
  { id: "cat", name: "Cat", subject: "a grey tabby cat with a small blue scarf, curious expression" },
  { id: "rabbit", name: "Rabbit", subject: "a white rabbit holding a tiny open book" },
  { id: "tortoise", name: "Tortoise", subject: "a patient green tortoise with a small marble column fragment on its shell" },
  { id: "dolphin", name: "Dolphin", subject: "a smiling Aegean-blue dolphin leaping over a small wave" },
  { id: "lion", name: "Lion", subject: "a gentle young lion with a soft golden mane" },
  { id: "penguin", name: "Penguin", subject: "a penguin wearing a little graduation cap" },
  { id: "panda", name: "Panda", subject: "a panda holding a small bamboo pencil" },
  { id: "hedgehog", name: "Hedgehog", subject: "a hedgehog peeking over a small stack of books" },
  { id: "deer", name: "Deer", subject: "a young deer with small antlers decorated with a sprig of olive leaves" },
] as const;

export type AvatarId = (typeof AVATARS)[number]["id"];

export const AVATAR_IDS = AVATARS.map((a) => a.id) as [AvatarId, ...AvatarId[]];

export const isAvatarId = (id: unknown): id is AvatarId => typeof id === "string" && (AVATAR_IDS as string[]).includes(id);

export const avatarSrc = (id: AvatarId) => `/art/avatars/${id}.webp`;
