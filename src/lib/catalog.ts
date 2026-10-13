// The courses we offer on the home, Courses and welcome pages. They are seeded
// into the shared cache (scripts/seed-catalog.ts), so opening one is instant:
// the shared plan, its painted world and its cached lessons. Unlike a topic a
// learner types, a catalog course uses the shared plan even for learners with
// other courses (lib/harness.ts), since it is our curated version.

/** Topics to explore before the learner has a course on them. */
export const CATALOG = [
  { topic: "Stoicism", blurb: "Calm, clear thinking in a chaotic world." },
  { topic: "Black holes", blurb: "Where gravity bends light and time." },
  { topic: "Game theory", blurb: "Strategy, incentives and smart choices." },
  { topic: "Photosynthesis", blurb: "How plants turn sunlight into life." },
  { topic: "Jazz harmony", blurb: "Why some chords sound like longing." },
  { topic: "Machine learning", blurb: "How computers learn from examples." },
  { topic: "The French Revolution", blurb: "Bread, ideas and a falling crown." },
  { topic: "The fall of Rome", blurb: "How the greatest empire came apart." },
  { topic: "Supply and demand", blurb: "The invisible tug-of-war behind prices." },
];

/** Whether a topic key (lowercase, single spaces) is one of the catalog's courses. */
export const isCatalogTopic = (key: string) => CATALOG.some((c) => c.topic.toLowerCase() === key);
