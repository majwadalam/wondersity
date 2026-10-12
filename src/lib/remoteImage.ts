/**
 * Images we size ourselves skip Next's image optimizer: generated images in
 * Supabase Storage and the built-in art in /public/art are stored as
 * web-sized WebP already (the optimizer timed out fetching ~1 MB remote
 * files, and made 3840px versions of small cards on phones).
 */
export const isRemote = (src: string | null | undefined) => typeof src === "string" && (/^https?:\/\//.test(src) || src.startsWith("/art/"));
