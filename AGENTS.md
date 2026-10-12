# Learning Agent — Harness Engineering Project

## What this is

A stateful tutor, in the spirit of Brilliant. A learner names any topic; a
tutor agent plans a course as levels (stages of learning), each grouping a few
5-10 minute modules, writes one module at a time through a quality gate, and
records quiz results. When the
learner comes back, the course resumes where they left off, and the agent
adapts the next module to what they got wrong.

See [HARNESS.md](HARNESS.md) for the design rationale and research notes.

## Architecture

    Browser (page.tsx)
       │
       │ POST /api/learn  { topic, learnerId }
       ▼
    Tutor harness (lib/harness.ts → runTutor)
       │
       ├─ load_course   → Supabase: courses (+ lessons)
       ├─ fast paths    → course finished: overview; module unfinished: resume
       │                  (no model call)
       └─ agent loop    → OpenRouter tool calling, max 6 turns
            ├─ create_course     → plan levels + modules (lib/coursePlan.ts) → Supabase: courses
            ├─ get_quiz_mistakes → Supabase: attempts
            └─ write_module      → quality gate (lib/lessonWriter.ts)
                 ├─ generate → validate blocks → lint → evaluate → [revise → evaluate]
                 ├─ select best *evaluated* version
                 ├─ save_lesson   → Supabase: lessons (course_id, module_index)
                 └─ save_progress → Supabase: progress
       │
       ▼
    Lesson + course + tutor note + trace returned to browser

    POST /api/attempts { learnerId, lessonId, answers }
       └─ grade on server → attempts → mark lesson done → advance course

## Key concepts

**The model is not the agent. The harness is.** The harness is the loop,
state, tools, constraints, and evaluation around the model.

**Agent outside, workflow inside.** The tutor is an agent: it decides whether
to plan a course, whether to look at quiz mistakes, and what the next module
should focus on. Lesson writing is a fixed workflow the agent can't skip.

**Rules in code, not prompts.** Tool calls are validated with zod. The
harness enforces one course per topic, exactly one module per run, and that
only the current module is written. Tool misuse is returned to the model as an
error it can correct; infrastructure failures end the run.

**Structured output.** Every lesson and evaluation uses a JSON schema and is
validated with zod.

**Evaluation loop.** Code recomputes the arithmetic a lesson states
(`lib/factCheck.ts`), its factual claims are checked against web search
(`lib/factVerify.ts`; a verdict only counts if its source is a page the search
returned and its quoted evidence is on that page), and a reviewer model (`REVIEW_MODEL`, by default the writer's own
model; set another family for an independent review) scores it; below 8, or with a computed error, it is revised (rewritten from
scratch below 5) and re-scored. A version with wrong arithmetic or a claim a reliable source contradicts is
never shown; the pages that confirmed claims are saved with the lesson and
listed at its end. Only evaluated versions can be shown: the
highest-scoring one, with its real score and a `passed` flag. A revision that
fails or can't be evaluated is discarded.

**Course hierarchy.** Course → levels → modules → lesson (whose blocks
are the activities). A level is a stage of learning with its own objective; a
module groups related ideas inside it and is one lesson. The agent plans
2-4 levels of 2-4 modules (4-12 modules in total), sized to the subject;
`lib/coursePlan.ts` validates the plan in code (counts, distinct titles,
levels named for what they cover) and returns problems to the agent as an
error to fix. Storage is still one ordered list (`courses.modules`), so
module positions keep meaning what they meant: `lessons.module_index`,
`courses.current_module`, grading, progression and `/courses/[id]/[n]` are
unchanged. Each new module entry also carries a stable `id`
(`level-2-module-1`), a `description` and its `level` (id, title,
description, objective); `lib/courseHierarchy.ts` rebuilds the levels when a
course is shown. Progression is sequential: a module opens when the one
before it is completed, so a level opens when the level before it is done.
Level status is derived only from saved completions. Courses planned before
levels have no level data and are shown as one unlabelled path; they are
never split into invented levels.

**Lessons are designed, not templated.** A lesson is an ordered list of
teaching blocks (`lib/lessonBlocks.ts`). The writer first picks a teaching
approach that fits the content (mystery, guided discovery, visual, scenario,
worked example, misconception, simulation, case study, story, Socratic,
compare, practice, reflection), then builds the sequence from these blocks:
explain, activity, check, worked example, code (predict output / find the fix
/ step-through trace), problem (work it out and type the answer), compare,
reflect, dialogue, summary. Nothing is fixed:
no mandatory opening prediction, definition or closing quiz. Earlier modules'
approaches are passed in so a course varies. Topic-specific sequences are
never hardcoded; the guide describes what each approach does to a lesson's
shape, and the model chooses.

**Checks live inside the lesson.** Graded questions (2-4, scenario-based,
exactly 4 options, `correctAnswer` matching one) stay in `questions`, so
grading and progress are unchanged; each is placed by a `check` block right
after the idea it tests, with up to 2 progressive hints. A wrong answer
doesn't reveal the right one: the learner sees an alternative explanation and
can try again or ask for the answer. Only the first answer is sent and graded;
retries are practice. The module is saved once every check is answered.

**Typed problems.** A `problem` block asks the learner to work something out
and type the answer. It's checked in the browser (practice, not graded):
integers exactly, other numbers within 1%, fractions and currency symbols
understood, short text after normalizing case and spacing. Anticipated wrong
answers ("traps") get feedback naming the mistake behind them; hints come one
at a time; the worked solution is shown once solved, or on request after two
misses. Validation drops traps that would match an accepted answer.

**Validation in code.** `lib/lessonDesign.ts` validates each block, activity
and question on its own, drops what is malformed, remaps references, and
places any question no block placed. It rejects a lesson (retried once) with
fewer than 2 valid questions, fewer than 3 usable blocks, nothing that
teaches, or fewer than 2 hands-on blocks. `lintStructure()` finds problems
that don't make a lesson unusable (checks stacked at the end, walls of text,
the old template) and hands them to the evaluator, which scores them down.
The reviser sees the lesson in exactly the format it writes
(`toModelFormat()`), so revisions don't lose activities.

**Drag and drop** in "Sort it" uses dnd-kit (`@dnd-kit/core`): mouse and
touch sensors, a DragOverlay portalled to <body> (a lesson step's animation
leaves a transform that breaks position: fixed inside it), and, when any
group is off-screen, compact drop targets docked above the lesson's bottom
bar for the length of the drag. Hand-written drag code was replaced after it
proved unreliable.

**Interactive activities.** Activity blocks place one of 12 activity types:
predict, scenario, drag-and-drop sort, drag-to-order, story, timeline,
infographic chart, slider simulation, interactive diagram, narrated listen
(browser speech), playable sound (Web Audio, music topics only) and graph (a
curve the learner reshapes by dragging a parameter). A graph's formula is
compiled by a small safe parser (`lib/expression.ts`, no eval) and rejected
unless it draws a real curve that is visible in the window the lesson chose.
`lib/activities.ts` validates each for its type. Activities, code exercises,
worked examples, problems, reflections and dialogues are practice: ungraded and not
saved. Progress still comes from the checks.

**Motion.** Animation follows real state only: map nodes show saved
completion, the accent trail runs only out of completed modules, celebrations
fire on server-confirmed results, and the generation overlay shows elapsed
time and what a run does, never invented progress (the API reports nothing
until a run ends; "Stop waiting" stops the wait, not the run). Simple
entrances are CSS (`Reveal`, one shared IntersectionObserver); Motion for
React (`motion`) is used for springs, exits, layout and SVG path drawing,
with shared timing in `components/motion/presets.ts`. `MotionConfig
reducedMotion="user"` plus a global CSS rule honour reduced motion; path
drawing, bursts and springs check it too. Lottie animations (`components/motion/Lottie.tsx`,
files in `public/lottie/`, recoloured to the accent) are decorative: they load
when near the screen, play once, and stay still with reduced motion.

**Design.** Wondersity is white and calm with one accent (Aegean blue). Colours are
tokens in `globals.css` (`bg-canvas`, `bg-surface`, `border-line`, `text-fg`,
`text-muted`, `bg-accent`, `text-good`, `text-bad`); use those, not raw
colours. A lesson is one step per screen (`LessonView`): progress bar on top,
Back / Continue at the bottom, checks must be answered, practice can be skipped.
The landing page states only true things: no invented user counts, and
unbuilt features are marked "Coming soon". The landing page is light. Its
hero is pinned for three screens: the headline fades and a painted course
world (`public/art/landing/hero.webp`, made with the product's own world
prompt for the test account's Stoicism course and its three levels) rises to
fill the screen, then the camera travels its road from lesson 1 to lesson 9.
The route is hand-traced over the painting's own road, places in the picture
carry small labels, and a caption names the level being walked. The picture
is kept at its full 4K width (6336px), with 2400px and 3600px copies the
browser picks by screen width and pixel density (`srcset`), and the layer has
no `will-change`, because Chrome would keep the small, blurry raster as it
grows. The hero is pinned for 3.2 screens on wide screens and 2.3 on phones. With reduced
motion on, the same map is shown still. Below
it: a marquee of topics (each starts a course), the lesson player, a sticky
three-step "how it works", the live activity demos (one card per subject, its course painting faded into the top-right corner), the quality review, the
course tiles with their art, the FAQ and a closing over the agora at dusk.
Headings reveal line by line (`Lines` in `components/landing/Primitives.tsx`,
CSS driven); scroll-linked motion uses `useScrub`, whose ranges must span 0
to 1 because the browser may play them as native scroll animations. Bands
alternate white, canvas and navy (`bg-navy`, `navy-raised`,
`accent-on-dark`); both pictures come from `scripts/generate-landing-art.ts`.

**Scenes with a guide.** After a lesson is written and saved, it is staged
(`lib/staging.ts`, `POST /api/stage`, once per lesson): one model call casts a
guide (a historical figure for history or philosophy, never a living person;
an invented expert otherwise) and writes, for the intro and every block, a
setting, the scene it shows (at most 3 shared paintings, about $0.035 each)
and the guide's spoken line, which must not give away any answer. A course
keeps the guide earlier lessons used when it still fits, and reuses its
portrait instead of painting a new one. The paintings and the guide's
portrait are generated with Gemini Nano Banana 2.1 (`lib/coverArt.ts`) and
stored in the public `covers` bucket as resized WebP (`uploadImage`, via
`sharp`); staging is saved into
`lesson_data.staging`. The lesson's blocks, questions and grading are
untouched, and a lesson that fails to stage is shown without scenes.

**Voice.** `GET /api/voice` speaks one step's line with `gpt-audio-mini`
through OpenRouter (strict word-for-word prompt), stores it as a WAV keyed by
the words and voice, and returns its URL. The line is read from the saved
lesson, never from the request. The player plays it when a step opens and
fetches the next one ahead; voice can be turned off and the choice is kept.

**Course covers and world.** Opening a course runs `POST /api/covers` once to
paint a wide "world" for the course (`courses.cover_url`). Modules get no
separate cover: a module shows its lesson's first scene once staged, and the
world until then (courses painted earlier keep their `modules[i].cover`). The
course page draws the journey as a road across that world, one stop per module.

**Saved lessons keep working.** Lessons saved before blocks existed have
`concepts`, `activities` (placed by `afterConcept`) and `questions`;
`lessonBlocks()` rebuilds them in their original order, so old courses,
progress and grading are untouched. No database migration is needed.

**Errors shown to learners are plain.** `serverError` (lib/requestGuards.ts)
logs the real error with a short reference and returns only a message for its
kind (busy, unavailable, failed checks, server), the reference and whether a
retry can help. Provider responses, keys, limits and setup hints stay in the
server log; the app never displays raw error text.

**Bounded iteration.** Max 6 agent turns, at most one revision per lesson, one
retry for malformed output, one retry for transient call failures, 60s per
model call (90s for writing or scoring a lesson), no revision after 120s, no agent turn after 200s, and a hard 280s
deadline for every call (300s route limit).

**Server-side grading.** The browser sends chosen options; the server grades
against the stored lesson. Only a module's first completion counts.

**Persistence.** Courses, lessons, attempts and progress live in Supabase.
Each run rebuilds the agent's context from there.

**Accounts.** A learner is a Supabase Auth user (Google, or email and
password); `learner_id` holds their user id. API routes take the learner from
the session (`lib/auth.ts` `asLearner`), never from the request, and every
query inside runs as that user (`withDb` in `lib/db.ts`), so the row rules in
migration 004 keep each learner to their own rows; signed-out requests see
nothing. `src/proxy.ts` refreshes the session and sends signed-out visitors
from app pages to `/login`. Progress made before accounts (a browser-made
`learner-…` id in localStorage) is offered to the account on sign-in: the app lists what that browser holds
(`preview_browser_learner`, migration 010) and moves it only if the learner
chooses "Add it"
(`claim_browser_learner`). `profiles` holds name, reason, daily goal, voice
and whether onboarding is done.

**Plans and billing.** Free: plan any course and take its first 2 lessons,
3 new courses per 30 days. Pro ($19.99 a month, $119.99 a year): every
lesson, painted scenes for 30 lessons per 30 days (plain lessons after), at
most 60 new lessons per 30 days. Rules live in `lib/plans.ts` and are checked
on the server before any model call (`plan_check` in the trace; a refused
lesson returns `upgrade_required` and costs nothing; resuming is always free).
Paddle is the merchant of record: Paddle.js checkout carries the learner id in
`customData`, the signed webhook (`/api/billing/webhook`, HMAC checked in
`lib/billing.ts`) mirrors the subscription into `subscriptions`, and Settings
links to Paddle's customer portal. Limits apply only once Paddle is configured;
until then Wondersity is free in beta, as the pricing page says.

**Go deeper.** While a lesson is staged, `lib/enrichment.ts` gathers videos,
articles, books and images for its end screen. A small model only suggests
what to look for; each item is confirmed by a real service before it's kept:
books on Open Library, images through Wikipedia (Commons files with their
licence and author), videos from a YouTube-only web search confirmed by
YouTube oEmbed, articles only from links the web search returned. Saved as
`lesson_data.resources`; a failure saves an empty set so it isn't retried.

**Plan cache and runs.** A new course for a learner with no other courses
reuses a shared plan for the same course (`course_plans`, by a fingerprint of
the planning guide, `PLANNER_VERSION`), with its painted world. Matching
(`lib/planCache.ts`): an exact topic match first; otherwise the topic's
embedding finds the closest cached topics (pgvector, `match_course_plans`)
and a small model confirms one is the same course, not a related one. The
course keeps the learner's own wording and records its `plan_key`. Lesson 1
of a shared plan is cached once it passes every check (`lessonVersion()`
fingerprints the guide and models) and its scenes and "Go deeper" are added
once painted, so the next learners get it instantly at no cost. A plan made
for such a learner is cached for the next one. Learners
with other courses get a fresh plan, tailored to their history, that isn't
cached. Only the server writes the cache (`SUPABASE_SECRET_KEY`), so no
learner can plant a plan others would get. Every tutor run, staging and world
painting is stored in `runs` with its trace, time and OpenRouter's reported
cost (paintings included); metrics.sql queries 10-13 read it.

**Creator partners.** `?ref=CODE` on any page (src/proxy.ts) or a visit to a
companion page `/c/<slug>` sets a 30-day `agora_ref` cookie; the first
referral wins (`lib/referrals.ts`). Finishing onboarding saves it on the
profile if it's an active partner; checkout sends it in Paddle `customData`
with the partner's discount code, and the webhook saves it on the
subscription. Partners and companions are rows we add with SQL
(docs/CREATORS.md); metrics.sql query 9 estimates what we owe each one.

**Mistake reports and age.** A flag in the lesson's top bar saves a report
(`lesson_reports`) with the step it was made on; metrics.sql lists them.
Onboarding asks learners to confirm they're 13 or older
(`profiles.age_confirmed_at`).

**Product frames.** Marketing pages (`/`, `/pricing`, `/privacy`, `/terms`,
`/login`) have a site header and footer; app pages (`/home`, `/courses`,
`/progress`, `/library`, `/settings`) have a sidebar (tabs on phones);
lessons and onboarding (`/welcome`) are full screen. Starting a course
signed out goes through sign-up with the topic kept (`useStartCourse`). On phones the
site header's links sit in a menu. Shared links show `app/opengraph-image.jpg`
(the hero painting with the headline); `metadataBase` comes from
`NEXT_PUBLIC_SITE_URL`, else Vercel's production URL.

**No waiting.** A new course opens as soon as its plan is saved (the client
polls for it) and lesson 1 is written while the learner looks at it. While a
lesson is taken, the next one is written ahead (`runTutor(..., { ahead: true
})`: it can see mistakes from earlier lessons, not the current one) and
staged, so it opens instantly.

## Files

- `src/lib/harness.ts` — tutor agent loop, tools, fast paths
- `src/lib/lessonWriter.ts` — quality gate: generate / evaluate / revise
- `src/lib/lessonBlocks.ts` — stored lesson shape: approaches, blocks, old-lesson conversion
- `src/lib/lessonDesign.ts` — lesson writing guide, block validation, structure lint, model format
- `src/lib/activities.ts` — interactive activity schema, writing guide, validation
- `src/lib/model.ts` — OpenRouter client (structured output, tool calling, writer and reviewer models, cost per run)
- `src/lib/factCheck.ts` — recomputes a lesson's stated arithmetic
- `src/lib/factVerify.ts` — checks a lesson's factual claims against web search
- `scripts/judge-lessons.ts` — re-scores saved sample lessons with one reviewer, to compare writers
- `research/` — every model run: method, results, costs and raw outputs (`research/model-runs.md`)
- `scripts/e2e-course.ts` — a real course through the running app's HTTP API with two throwaway learners
- `src/lib/progress.ts` — quiz grading and course progression
- `src/lib/courseView.ts` — client-facing course shape: levels, modules, lessons
- `src/lib/coursePlan.ts` — course plan schema, planning guide, validation
- `src/lib/courseHierarchy.ts` — levels from the stored module list, labels, old-course handling
- `src/lib/db.ts` — Supabase access (also cover uploads)
- `src/lib/staging.ts` — lesson staging: guide, scenes, lines; schema and validation
- `src/lib/coverArt.ts` — image prompts (covers, world, scenes) and generation
- `src/app/api/stage/route.ts` — stages a lesson
- `src/app/api/voice/route.ts` — speaks a guide's line
- `src/app/api/covers/route.ts` — paints a course's world
- `scripts/generate-art.ts` — the built-in catalog covers in `public/art/`
- `scripts/generate-landing-art.ts` — the landing page's hero world and closing illustration in `public/art/landing/`
- `src/lib/requestGuards.ts` — input validation, rate limiting, error responses
- `src/lib/auth.ts`, `src/lib/supabase/` — the signed-in learner; Supabase clients for server and browser
- `src/proxy.ts` — session refresh and sign-in redirects
- `src/app/login`, `src/app/auth/` — sign in (Google, email and password), forgot password, callback, sign out
- `src/app/welcome` — onboarding; `src/app/home` — the signed-in home; `src/app/settings` — account settings
- `src/app/api/profile`, `src/app/api/account/claim` — profile; moving pre-account progress in, deleting all data
- `src/app/pricing`, `src/app/privacy`, `src/app/terms` — marketing and legal pages
- `src/app/api/learn/route.ts` — runs the tutor
- `src/app/api/attempts/route.ts` — records a finished quiz
- `src/app/api/views/route.ts` — records how far a learner got in a lesson (each new furthest step)
- `supabase/queries/metrics.sql` — funnel, lesson drop-off, return rate, hardest checks; run in the Supabase SQL editor
- `src/app/api/courses/route.ts` — the learner's courses
- `src/app/api/lessons/route.ts` — standalone lessons from before courses
- `src/app/page.tsx` — landing page: pinned world hero, topic marquee, not a chat (the lesson player), how it works, every subject (live demos), quality, courses, FAQ, closing
- `src/components/landing/` — landing page sections, the pinned hero, the marquee, shared type and scroll primitives
- `src/app/courses/page.tsx` — Courses: your courses, explore
- `src/app/courses/[id]/page.tsx` — a course: its painted world, the journey, chapters of lessons
- `src/app/courses/[id]/[module]/page.tsx` — one module: stages it if needed, then the lesson with scenes and voice
- `src/app/progress/page.tsx` — Progress: bars, streak, milestones
- `src/app/library/page.tsx` — Library: bookmarked (starred) courses
- `src/components/app/AppState.tsx` — shared client state: learner, courses, tutor
  requests with background prefetch, quiz saving, bookmarks
- `src/components/app/AppShell.tsx` — layout: top bar, phone tab bar, overlays; hides the nav on lesson pages
- `src/components/LessonView.tsx` — the lesson player: one step per screen, progress bar, module finish
- `src/components/lesson/` — one component per block kind (code, worked, reflect, dialogue, …)
- `src/components/activities/` — one component per activity type
- `src/components/motion/` — motion presets, primitives (Expand, ProgressFill,
  CountUp, Burst), Lottie player
- `src/components/app/CourseJourney.tsx` — the journey across the course's world, spotlight, chapters
- `src/components/lesson/Scene.tsx` — a step's painted scene with the guide's line and voice
- `src/lib/expression.ts` — safe formula compiler for graph activities
- `src/components/`, `src/hooks/` — UI pieces

Bookmarks are stored in the browser (localStorage, per learner id); they are
not in Supabase yet.
- `supabase/migrations/` — SQL migrations (001 lessons and progress, 002 courses and attempts, 003 covers, 004 accounts: own-rows rules, profiles, claiming old progress, 005 lesson views, 006 subscriptions, lesson reports, age confirmation, 007 creator partners and companion pages, referrals, 008 shared course plans and run logs, 009 matching plans by meaning and sharing lesson 1, 010 asking before claiming pre-account progress); apply with `pnpm db:push`
- `src/lib/plans.ts` — what each plan allows; `src/lib/billing.ts` — Paddle webhook checks and portal links
- `src/app/api/billing/` — the learner's plan, the Paddle webhook, the customer portal
- `src/components/billing/` — checkout button, Settings plan section
- `src/lib/enrichment.ts`, `src/components/lesson/GoDeeper.tsx` — "Go deeper" resources, confirmed by real services
- `src/app/api/reports/route.ts`, `src/components/lesson/ReportMistake.tsx` — reporting a mistake in a lesson
- `docs/MARKET_RESEARCH.md`, `docs/GTM.md`, `ECONOMICS.md` — market, go-to-market plan, costs and pricing
- `docs/CREATORS.md` — creator partnership playbook: offer, terms, outreach, setup, payouts
- `src/app/c/[slug]/page.tsx`, `src/components/companion/` — public companion course pages; `src/lib/referrals.ts` — referral codes and cookie
- `src/lib/planCache.ts` — finding a shared course plan for a topic (exact, by meaning, confirmed by a model)
- `src/lib/database.types.ts` — generated by `pnpm db:types`; don't edit by hand
- `scripts/sample-lessons.ts` — writes sample modules for several subjects to compare their shapes
- `*.test.ts(x)` — unit and rendering tests (`npm test`)

## Environment

`.env.local` must contain:

    OPENROUTER_API_KEY=...
    OPENROUTER_MODEL=openai/gpt-6.1-sol    # writes lessons, runs the tutor agent
    REVIEW_MODEL=openai/gpt-6.1-sol        # reviews lessons; another family is more independent
    # optional: VERIFY_FACTS=off, VERIFY_MODEL (default the writer),
    #           VERIFY_SEARCH_ENGINE (default exa)
    NEXT_PUBLIC_SUPABASE_URL=...
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
    # optional: ART_MODEL (default google/gemini-nano-banana-2.1),
    #           VOICE_MODEL (default openai/gpt-audio-mini)

The writer must support tool calling and structured output (GPT-6 Luna and
GPT-6.1 Sol do). See HARNESS.md, "Choosing the models", for the comparison;
every run's trace ends with its cost (`run.cost`).

## Data model

**courses** — id, learner_id, topic, topic_key, title, description,
modules (jsonb, ordered: [{id, title, goal, description, level: {id, title,
description, objective}}]; older courses only {title, goal}),
current_module (position in modules), status, created_at, updated_at;
unique(learner_id, topic_key). Level data lives inside `modules`, so the
hierarchy needed no migration.

**lessons** — id, learner_id, topic, lesson_data (jsonb), score, created_at,
course_id, module_index, completed_at. `lesson_data` is a `Lesson`
(`lib/lessonBlocks.ts`): version 2 lessons have `approach`, `blocks`,
`activities`, `questions`; older ones `concepts`, `activities`, `questions`.

**attempts** — id, learner_id, lesson_id, question_index, chosen, correct,
created_at

**progress** — id, learner_id, topic, status, last_lesson_id, updated_at;
unique(learner_id, topic)

**lesson_views** — id, learner_id, lesson_id, step, step_count, created_at.
One row each time a learner reaches a step further than before (0 = opened),
so the furthest step shows where people stop. Insert-only from the app.

**subscriptions** — learner_id (primary key), paddle_customer_id,
paddle_subscription_id, status, price_id, plan (monthly/yearly),
current_period_end, canceled_at, updated_at. Written only by the Paddle
webhook with `SUPABASE_SECRET_KEY`; learners can read their own row.

**lesson_reports** — id, learner_id, lesson_id, step, kind (wrong_fact,
confusing, broken, other), message, created_at.

**profiles** also has age_confirmed_at, referred_by, referred_at;
**subscriptions** also has referred_by and started_at.

**course_plans** — topic_key (primary key), topic, title, description,
modules, cover_url, planner_version, embedding (vector 1536), first_lesson,
first_lesson_score, lesson_version, created_at, updated_at. **courses** also
has plan_key. Readable by
signed-in learners; written only with the server key.

**runs** — id, learner_id, kind (learn, stage, cover), topic, lesson_id,
outcome, ok, error, ms, cost_usd, calls, tokens_in, tokens_out, trace,
created_at. Learners can insert and read their own.

**partners** — code (primary key), name, url, commission_pct,
commission_months, discount_code, contact_email, active, created_at. Signed
out, only code, name, url and discount_code of active rows can be read.

**companions** — slug (primary key), partner_code, topic, title, blurb,
video_url, active, created_at. Public when active.

## Development rules

- Never trust raw model output. Always validate against a schema.
- Every agent loop must have a maximum iteration count.
- The API key must never reach the browser.
- Every lesson that is shown must first pass evaluation.
- Grade quizzes on the server, never in the browser.
- Do not remove tests or policies to make things pass.
- Run `npm test`, `npm run lint` and `npm run build` before pushing.
- Don't hardcode topic-specific lesson sequences; describe moves and let the writer choose.

## What's next (not yet implemented)

- Turning billing on: a Paddle account, products and prices, and the env
  values in `.env.example`
- Lifecycle email (welcome, streak reminders, renewal notices) and shareable
  course pages, which the GTM plan relies on
- A "Pro Plus" tier for learners who need more than 60 lessons a month
- Spaced-repetition scheduling from recorded mistakes
- A visual level map for courses (the hierarchy exists; the UI is still a list)
- More than one lesson per module (today a module is one lesson of activity blocks)
- An eval suite for the agent (fixed topics, expected tool sequences, scores);
  `scripts/sample-lessons.ts` is a manual start for lesson variety

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
