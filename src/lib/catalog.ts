// The courses we offer on the home, Courses and welcome pages, and the topics
// in the landing page's scrolling rows. They are seeded
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

/** The topics in the landing page's two scrolling rows; each starts a course. */
export const MARQUEE_ROWS = [
  ["The Socratic method", "Reading a cap table", "Black holes", "SQL window functions", "Jazz harmony", "Negotiating a raise", "Babylonian numbers", "Kubernetes networking", "Stoicism", "Freelance taxes"],
  ["Byzantine iconoclasm", "Unit economics", "Sourdough hydration", "Game theory", "Writing a design doc", "The Silk Road", "GDPR basics", "Baroque music", "Bayes' theorem", "Running a retrospective"],
];

/** Every course we offer by name: the catalog first, then the landing page's topics not already in it. */
export const OFFERED_TOPICS = [...new Set([...CATALOG.map((c) => c.topic), ...MARQUEE_ROWS.flat()].map((t) => t))].filter(
  (t, i, all) => all.findIndex((x) => x.toLowerCase() === t.toLowerCase()) === i
);

/** Whether a topic key (lowercase, single spaces) is one of the courses we offer by name. */
export const isCatalogTopic = (key: string) => OFFERED_TOPICS.some((t) => t.toLowerCase() === key);
