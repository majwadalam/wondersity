# What changed, and why

One line per decision, grouped by area. Each line is how the product works
now and the reason for it. Experiments that were tried and undone aren't
listed. For the full design, read AGENTS.md (how it works) and HARNESS.md
(why the AI parts are built this way).

## Product and brand

- The product is **Wondersity** (wonder + university). It was called Weavr, then Agora; Agora wasn't available. The Athenian agora painting, the `agora:voice` setting and the `agora_ref` cookie keep their old names so saved choices and referrals aren't lost.
- Positioning: courses for what nobody teaches. That means topics too niche, too new, too scattered or not at your level, for work as well as curiosity.
- Wondersity is a web app (not a phone or desktop app).
- Look: white and calm, one blue accent, the Geist font, and the two-circle logo. Colours are tokens in `globals.css` (`text-fg`, `bg-accent`, …); never hard-code colours.
- The site never makes things up: no invented user counts, and features that aren't built are marked "Coming soon".

## Lessons

- A learner names any topic. The tutor plans a course as levels of short lessons and writes one lesson at a time. Learners see "lessons"; the code still says "module".
- Lessons are designed, not templated. The writer picks a teaching approach that fits the topic, then builds the lesson from blocks: explanations, activities, checks, worked examples, code, typed problems and more.
- One step per screen with Back / Continue, like Brilliant, so the learner focuses on one thing at a time.
- Each lesson is a series of scenes with a guide (e.g. Epictetus for Stoicism). Every step has a painted scene and a spoken line, but the content and grading never depend on them.
- The guide's voice is `gpt-audio-mini` through OpenRouter (about $0.001 a line), cached so each line is generated once. A line is only saved if its transcript matches word for word.
- Images come from Gemini Nano Banana 2.1 (about $0.035 each) in one clay style, saved as resized WebP so pages load fast. A lesson has at most 3 scenes, and a course reuses one guide portrait.
- A course page shows the course's painted "world" with a road across it, one stop per lesson.
- Lessons end on a finish screen: the opening scene again, the guide's farewell, a "What you learned" recap, "Go deeper" resources and the sources that confirmed the lesson's facts.
- "Go deeper" lists videos, articles, books and images, each confirmed to exist by a real service: Open Library, Wikipedia/Commons (with licence and credit), YouTube and web search. Nothing listed is invented.
- A flag in every lesson's top bar lets learners report a mistake on that step.
- "Sort it" drag and drop uses the dnd-kit library, after hand-written drag code proved unreliable. When the groups are off-screen, compact drop targets dock above the bottom bar during a drag.

## Quality and facts

- Every lesson goes through a quality gate before anyone sees it: write, check, review, revise once if needed. Only a version that was checked can be shown.
- Arithmetic in lessons is recomputed in code (`lib/factCheck.ts`). A wrong sum sends the lesson back, and a lesson whose every version is wrong is never shown.
- Factual claims are checked against web search (`lib/factVerify.ts`). A verdict only counts if its source is a page the search really returned. Contradicted claims block the lesson.
- These checks exist because tests showed models passing their own wrong facts, such as a lesson teaching 6.75 + 4.75 = 19.00.
- The writing guide asks for accuracy up front: precise figures only when certain, no invented quotes, disputed views attributed.

## AI models and cost

- Writer and reviewer: GPT-6.1 Sol, chosen after comparing six models on the same lessons with one fixed reviewer. It wrote the best lessons for about $0.04 each (details in HARNESS.md, "Choosing the models").
- Smaller jobs use GPT-6 Luna: the guide's script, "Go deeper" suggestions and topic matching.
- Every run's real cost is recorded in the `runs` table, so cost per lesson and per learner is measured, not guessed (queries 10-13 in `supabase/queries/metrics.sql`).
- Course plans are shared between new learners who ask for the same course, matched by meaning: "stoic philosophy" matches "Stoicism", but "Stoicism for anxiety" doesn't. Lesson 1 of a shared course is shared too, so repeat topics cost almost nothing to start.
- The OpenRouter key has a spending limit. When it's reached, lessons can't be written until the limit is raised.

- Every model run is recorded in `research/`: what was tested, how, the results, the costs and the raw lessons. Start with `research/model-runs.md`.
- Every model call sets a maximum output length: without one, OpenRouter reserves the model's largest possible reply against the key's credit, and parallel calls are refused (402).
- The online fact check runs at most 4 searches at a time, and accepts a quote when its meaningful words are on the returned page, so short exact quotes count. It still confirms few claims and roughly doubles a lesson's cost, which is under review (research/model-runs.md, "Where things stand").
- Once a lesson is saved, a failure in the tutor's closing note no longer throws the lesson away. An end-to-end test caught this.
- Lessons are server-side jobs (`lib/jobs.ts`, migration 011). Starting a lesson answers at once; the server writes it, stages it and paints a new course's world, even if the browser is closed. The browser only watches the job, and a reload picks up jobs still running. Finishing a quiz starts the next lesson on the server. Before, scenes, the world and writing ahead all depended on the browser staying open.
- Staging and world painting live in `lib/lessonStaging.ts` and `lib/courseWorld.ts`, shared by the API routes and the jobs.
- OpenRouter's 402 errors in testing were an empty account ($0.15 left), not our code or the key's limit. A key's limit only caps what it may spend from the account. Paintings need at least $1 in the account and voice $0.50.
- `scripts/e2e-course.ts` runs a real course through the app, as two throwaway learners, and cleans up afterwards.

- The app ships as a Docker image (`Dockerfile`, Next.js standalone output) for Coolify. It runs as one long-lived container, because lesson jobs run inside the server process. `NEXT_PUBLIC_*` variables must be build variables; the README has the steps.

## Accounts and data

- Sign-in is email and password or Google (Supabase Auth). Emailed codes broke when opened in another browser, so they were dropped.
- Each learner can only reach their own rows: database row rules (migration 004) enforce this, not the app.
- Progress from before accounts is offered, never moved automatically ("Add it to this account?").
- Onboarding asks learners to confirm they're 13 or older and accept the Terms.
- "Delete your data" in Settings removes everything the learner has saved.
- Database changes are migrations in `supabase/migrations/`, applied with `pnpm db:push`. `src/lib/database.types.ts` is generated by `pnpm db:types`; never edit it by hand.
- Use pnpm, and run the Supabase CLI with `npx supabase`.

## Errors

- Learners never see internal errors. The server logs the real error with a short reference and sends a plain message, such as "Our tutor is busy right now". Provider responses, keys and limits stay in the server log.
- Errors and prompts appear as toasts over the page, never as banners that push the layout.

## Business

- Pricing: a free plan (the first 2 lessons of any course, 3 new courses a month) and Pro at $19.99 a month or $119.99 a year. ECONOMICS.md has the costs, margins and reasoning.
- Pro covers up to 60 new lessons a month, with paintings for 30. Above that, one heavy yearly subscriber would cost more than they pay. A "Pro Plus" tier may come later.
- Plan limits are checked on the server before any AI cost, and only apply once billing is switched on. Until then everything is free in beta.
- Payments go through Paddle, the merchant of record: it handles worldwide tax and pays out to Pakistan. Paddle's keys aren't set up yet.
- Creator partnerships: referral links, co-branded companion course pages (`/c/<slug>`) and a revenue share of 30% of net for 12 months, with 10% off for their audience. The playbook is in docs/CREATORS.md.
- Market research and the go-to-market plan are in docs/MARKET_RESEARCH.md and docs/GTM.md. The first audience is curious adults who already pay to learn.

## Tracking

- How far learners get in each lesson is recorded (`lesson_views`).
- `supabase/queries/metrics.sql` has the funnel, drop-off, return rate, hardest checks, mistake reports, creator payouts and costs.
