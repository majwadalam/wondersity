// "Go deeper": real videos, articles, books and images to go with a lesson,
// each with where it comes from. A model only suggests what to look for and
// says why it's worth it; every resource is then confirmed by a real service
// before it's kept, so nothing shown is invented:
//
//   books     Open Library search (title, author, year, cover, link)
//   images    Wikimedia Commons files, found through Wikipedia (the file, its
//             licence and its author)
//   videos    links from a web search limited to YouTube, then YouTube's
//             oEmbed (the video exists and can be embedded; its real title)
//   articles  links a web search actually returned (url_citation annotations)
//
// A resource that can't be confirmed is dropped. Enrichment never blocks a
// lesson: if it fails, the lesson simply has no "Go deeper" section.

import { z } from "zod";
import type { Lesson } from "./lessonBlocks";
import { callStructured, callStructuredWithSources, type Deadline, type Source } from "./model";
import { env } from "./env";

export type Resources = {
  videos: { url: string; videoId: string; title: string; channel: string; why: string }[];
  articles: { url: string; title: string; site: string; why: string }[];
  books: { title: string; author: string; year: number | null; url: string; cover: string | null; why: string }[];
  images: { title: string; thumb: string; url: string; license: string; credit: string; caption: string }[];
  /** When the resources were gathered (also marks a lesson as done, even if nothing was found). */
  at: string;
};

const MAX_EACH = 3;
const CALL_TIMEOUT_MS = 45_000;
const FETCH_TIMEOUT_MS = 10_000;
// A small model is enough to suggest searches and pick from results.
const enrichModel = () => env("ENRICH_MODEL") ?? "openai/gpt-6-luna";
const UA = { "User-Agent": "Wondersity/1.0 (learning app; techpotionshq@gmail.com)" };

const getJson = async (url: string) => {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${res.status} from ${new URL(url).hostname}`);
  return res.json();
};

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N} ]+/gu, " ").replace(/\s+/g, " ").trim();
const stripHtml = (s: string) => s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

// ---------- 1. What to look for ----------

const PlanSchema = z.object({
  books: z.array(z.object({ title: z.string(), author: z.string(), why: z.string() })),
  images: z.array(z.object({ query: z.string(), caption: z.string() })),
  videoSearch: z.string(),
  articleSearch: z.string(),
});
type EnrichPlan = z.infer<typeof PlanSchema>;

const planJsonSchema = {
  type: "object",
  properties: {
    books: {
      type: "array",
      items: {
        type: "object",
        properties: { title: { type: "string" }, author: { type: "string" }, why: { type: "string" } },
        required: ["title", "author", "why"],
        additionalProperties: false,
      },
    },
    images: {
      type: "array",
      items: {
        type: "object",
        properties: { query: { type: "string" }, caption: { type: "string" } },
        required: ["query", "caption"],
        additionalProperties: false,
      },
    },
    videoSearch: { type: "string" },
    articleSearch: { type: "string" },
  },
  required: ["books", "images", "videoSearch", "articleSearch"],
  additionalProperties: false,
};

async function planResources(topic: string, lesson: Lesson, deadline: Deadline): Promise<EnrichPlan> {
  const raw = await callStructured(
    `You suggest where a learner can go deeper after a short lesson. Suggest:
- books: up to ${MAX_EACH} well-known, real books on exactly this lesson's subject (popular or introductory
  ones a curious adult could read), with the exact title, the author's name, and one sentence on why it fits.
  Only books you are confident exist; they will be looked up, and unknown ones are dropped.
- images: up to ${MAX_EACH} English Wikipedia articles whose main picture shows something the lesson talks
  about (an event's painting, a person's portrait, a place, an object, a diagram). "query" is the article's
  exact title, e.g. "Storming of the Bastille" or "Schwarzschild radius". The caption is one sentence on how
  the picture connects to the lesson, written so it fits whatever that article's main picture shows.
- videoSearch: one search for a good explainer video on this lesson's idea.
- articleSearch: one search for a reliable article (encyclopedia, university, museum, reputable publication).`,
    `Topic: ${topic}\nLesson: ${lesson.title}\nObjective: ${lesson.objective}`,
    planJsonSchema,
    deadline,
    { model: enrichModel(), timeoutMs: CALL_TIMEOUT_MS }
  );
  return PlanSchema.parse(raw);
}

// ---------- 2. Confirm each one ----------

/** The book on Open Library whose title and author match, or null. */
export async function findBook(title: string, author: string) {
  // Open Library often stores the main title without its subtitle ("Citizens", not
  // "Citizens: A Chronicle of the French Revolution"), so both are compared without one.
  const main = (t: string) => norm(t.split(/[:;(]/)[0]);
  const q = new URLSearchParams({ title: title.split(/[:;(]/)[0].trim(), author, limit: "8", fields: "key,title,author_name,first_publish_year,cover_i" });
  const data = await getJson(`https://openlibrary.org/search.json?${q}`);
  const surname = norm(author).split(" ").pop() ?? "";
  const wanted = main(title);
  const doc = (data.docs ?? []).find(
    (d: { title?: string; author_name?: string[] }) =>
      !!d.title &&
      main(d.title) === wanted &&
      (d.author_name ?? []).some((a) => norm(a).includes(surname))
  );
  if (!doc) return null;
  return {
    title: doc.title as string,
    author: (doc.author_name as string[]).find((a) => norm(a).includes(surname)) ?? author,
    year: (doc.first_publish_year as number | undefined) ?? null,
    url: `https://openlibrary.org${doc.key}`,
    cover: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
  };
}

// Words that say what kind of picture is wanted, not what it shows.
const PICTURE_WORDS = new Set(["painting", "photo", "photograph", "picture", "image", "diagram", "illustration", "map", "drawing", "engraving", "portrait", "the", "and", "of", "in", "a", "an", "on", "by"]);
const queryWords = (text: string) => norm(text).split(" ").filter((w) => w.length > 2 && !PICTURE_WORDS.has(w));

/**
 * A freely licensed image for a search: the lead image of the best-matching
 * Wikipedia article, which is a Wikimedia Commons file, with its licence and
 * author. Asked through en.wikipedia.org (it serves Commons files' details),
 * which some networks reach when commons.wikimedia.org is blocked.
 */
export async function findImage(query: string) {
  // The search as written, then just its subject words ("Storming of the Bastille
  // painting Houël" finds nothing; "storming bastille houël" finds the article).
  for (const q of [query, queryWords(query).join(" ")]) {
    const image = q ? await imageForSearch(q, queryWords(query)) : null;
    if (image) return image;
  }
  return null;
}

async function imageForSearch(query: string, subject: string[]) {
  const search = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrsearch: query,
    gsrlimit: "8",
    prop: "pageimages",
    piprop: "name",
  });
  const found = await getJson(`https://en.wikipedia.org/w/api.php?${search}`);
  // Search ranks loosely ("Bastille painting" can rank another painting first),
  // so an article only counts if its title shares the query's subject words.
  const articles = (Object.values(found.query?.pages ?? {}) as { index: number; title: string; pageimage?: string }[])
    .filter((p) => p.pageimage && /\.(jpe?g|png|webp|tiff?|svg)$/i.test(p.pageimage))
    .map((p) => ({ ...p, overlap: queryWords(p.title).filter((w) => subject.includes(w)).length }))
    .filter((p) => p.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap || a.index - b.index);
  for (const article of articles.slice(0, 3)) {
    const info = new URLSearchParams({
      action: "query",
      format: "json",
      origin: "*",
      titles: `File:${article.pageimage}`,
      prop: "imageinfo",
      iiprop: "url|extmetadata",
      iiurlwidth: "800",
    });
    const data = await getJson(`https://en.wikipedia.org/w/api.php?${info}`);
    const page = Object.values(data.query?.pages ?? {})[0] as
      | { imageinfo?: { thumburl?: string; descriptionurl?: string; extmetadata?: Record<string, { value?: string }> }[] }
      | undefined;
    const image = page?.imageinfo?.[0];
    const meta = image?.extmetadata ?? {};
    const license = stripHtml(meta.LicenseShortName?.value ?? "");
    // Only files with a stated free licence (or public domain), so they can be shown with credit.
    if (!image?.thumburl || !image.descriptionurl || !license) continue;
    return {
      // ObjectName can carry Wikidata markup ('… label QS:Len,"…"'); keep the plain part.
      title: stripHtml(meta.ObjectName?.value ?? "").split(/\s*label QS:/)[0].trim() || article.title,
      thumb: image.thumburl.replace(/\?.*$/, ""),
      url: image.descriptionurl,
      license,
      credit: stripHtml(meta.Artist?.value ?? "") || "Wikimedia Commons",
    };
  }
  return null;
}

/** The YouTube video id in a watch, short or embed link. */
export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^(www|m)\./, "");
    if (host === "youtu.be") return u.pathname.slice(1, 12) || null;
    if (host !== "youtube.com") return null;
    if (u.pathname === "/watch") return u.searchParams.get("v");
    const m = u.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{11})/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/** The video's real title and channel from YouTube's oEmbed, or null if it's gone or can't be embedded. */
export async function confirmVideo(videoId: string) {
  try {
    const data = await getJson(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`);
    return { title: String(data.title ?? ""), channel: String(data.author_name ?? "") };
  } catch {
    return null;
  }
}

const PicksSchema = z.object({ picks: z.array(z.object({ url: z.string(), why: z.string() })) });
const picksJsonSchema = {
  type: "object",
  properties: {
    picks: {
      type: "array",
      items: { type: "object", properties: { url: { type: "string" }, why: { type: "string" } }, required: ["url", "why"], additionalProperties: false },
    },
  },
  required: ["picks"],
  additionalProperties: false,
};

const sameUrl = (a: string, b: string) => a.replace(/\/+$/, "") === b.replace(/\/+$/, "");

/**
 * Searches the web and lets the model pick the best results, keeping only
 * picks that are among the pages the search actually returned.
 */
async function searchAndPick(kind: "video" | "article", search: string, lesson: Lesson, deadline: Deadline) {
  const { data, sources } = await callStructuredWithSources(
    `Pick up to ${MAX_EACH} of the search results that would best help a learner go deeper after a lesson
titled "${lesson.title}". ${
      kind === "video"
        ? "Only YouTube videos that explain the idea clearly; prefer educators, universities and museums."
        : "Only reliable articles: encyclopedias, universities, museums, scientific bodies and reputable publications. No forums, no shops."
    } Use the exact URL of each result, and say in one sentence why it's worth it.`,
    search,
    picksJsonSchema,
    deadline,
    {
      model: enrichModel(),
      timeoutMs: CALL_TIMEOUT_MS,
      webSearch: {
        maxResults: 6,
        ...(kind === "video" ? { includeDomains: ["youtube.com"] } : { excludeDomains: ["youtube.com", "reddit.com", "quora.com", "pinterest.com", "amazon.com"] }),
      },
    }
  );
  const picks = PicksSchema.parse(data).picks;
  return picks
    .map((p) => ({ ...p, source: sources.find((s: Source) => sameUrl(s.url, p.url)) }))
    .filter((p): p is typeof p & { source: Source } => !!p.source)
    .slice(0, MAX_EACH);
}

// ---------- 3. Together ----------

const settled = async <T>(p: Promise<T>, fallback: T): Promise<T> => p.catch((e) => (console.error("enrichment step failed:", e), fallback));

/** Gathers confirmed resources for a lesson. Each part fails on its own; the rest is kept. */
export async function enrichLesson(topic: string, lesson: Lesson, deadline: Deadline): Promise<Resources> {
  const plan = await planResources(topic, lesson, deadline);

  const [books, images, videos, articles] = await Promise.all([
    settled(
      Promise.all(
        plan.books.slice(0, MAX_EACH).map(async (b) => {
          const found = await findBook(b.title, b.author).catch(() => null);
          return found ? { ...found, why: b.why } : null;
        })
      ),
      []
    ),
    settled(
      Promise.all(
        plan.images.slice(0, MAX_EACH).map(async (i) => {
          const found = await findImage(i.query).catch(() => null);
          return found ? { ...found, caption: i.caption } : null;
        })
      ),
      []
    ),
    settled(
      searchAndPick("video", plan.videoSearch, lesson, deadline).then((picks) =>
        Promise.all(
          picks.map(async (p) => {
            const videoId = youtubeId(p.url);
            const video = videoId ? await confirmVideo(videoId) : null;
            return video && videoId ? { url: `https://www.youtube.com/watch?v=${videoId}`, videoId, ...video, why: p.why } : null;
          })
        )
      ),
      []
    ),
    settled(
      searchAndPick("article", plan.articleSearch, lesson, deadline).then((picks) =>
        picks.map((p) => ({ url: p.source.url, title: p.source.title || p.url, site: new URL(p.source.url).hostname.replace(/^www\./, ""), why: p.why }))
      ),
      []
    ),
  ]);

  const real = <T>(xs: (T | null)[]) => xs.filter((x): x is T => x !== null);
  const unique = <T extends { url: string }>(xs: T[]) => xs.filter((x, i) => xs.findIndex((y) => y.url === x.url) === i);
  return {
    books: unique(real(books)),
    images: unique(real(images)),
    videos: unique(real(videos)),
    articles: unique(articles),
    at: new Date().toISOString(),
  };
}
