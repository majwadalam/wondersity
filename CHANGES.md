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
- On phones, the site menu opens over the page with the page dimmed and still behind it; before, opening it pushed the page down and let it scroll underneath.
- The main pictures at the top of pages load first (`loading="eager"`, `fetchPriority="high"`), replacing `priority`, which Next.js 16 deprecated.
- Raised panels (course map, progress card, spotlight, course and progress cards) have a crisper shadow: a faint navy edge, a tight contact shadow and a soft lift, instead of a large grey blur.
- Course page polish: the progress card's main button is the brand purple (one purple primary per page), the journey's stops have a firmer shadow so they stand out on pale paintings, and the level key and the sidebar's account area have a little more room.
- The home page and sidebar show placeholders until the learner's data arrives, instead of flashing "0-day streak", "Your account" and the catalog first.
- Finishing a course earns a certificate with its own shareable page: an A4 landscape document (standard certificate size, printed on one A4 page) with a seal and a QR code to verify it, "Add to LinkedIn profile", share links, an image and print-to-PDF, and a link preview in the same design. Visitors can start the same course from it.
- A bell in the app lists notifications: a lesson ready, a streak milestone, a certificate, the daily reminder. Learners can also turn on browser notifications in Settings (Web Push, no outside service).
- The lesson's finish screen shows the streak it kept going (highlighted at milestones) and, at the end of a course, the certificate.
- A daily streak reminder is sent once in the learner's evening, only if they have a streak and haven't learned that day; it needs an hourly scheduled task in Coolify (README).

## Lessons

- A learner names any topic. The tutor plans a course as levels of short lessons and writes one lesson at a time. Learners see "lessons"; the code still says "module".
- Clicking a topic no longer plans a course straight away. A dialog offers "Plan it for me" (one click, as before) or "Tailor it", because a course planned from the topic's name alone has to guess what the learner wants.
- "Tailor it" is one screen where only the goal is required: why they're learning it, where they're starting, and their own notes or files. What they already know, what it must cover and how long it should be sit behind "More options". The research found that more fields lose people, and that choices work best in small sets (research/intake-pedagogy.md).
- The dialog never asks about "learning styles". Matching teaching to a visual or auditory style has no evidence behind it.
- A tailored course is planned backwards from the learner's goal. The plan states 2-4 outcomes with checkable verbs (never "understand"). Code checks that every level builds toward an outcome, that everything the learner asked for is covered, and that the course is the length they picked. The course page shows the goal and outcomes.
- A learner's starting point changes how lessons teach, not just how hard they are: worked examples and generous hints for beginners, harder problems and fewer hints for people who know the subject (the expertise reversal effect).
- Examples and problems are set where the learner says they'll use the subject (their job, class or project), since personalised problems help people learn.
- Learners can add PDFs, Word files, text or pasted notes. Each lesson uses the passages from them that fit its topic, along with their terms and page references. Facts are still checked, and text in an upload is treated as reference data, never as instructions to the AI.
- Tailored courses are personal, so they never use or feed the shared course plans. A learner's materials are private and are deleted with the course.
- A tailored course's title and description talk to the learner about the course, never about their brief or materials. A test run with unrelated notes had the description say the notes were unrelated.
- Writing a lesson may now take up to 150 seconds per call (it was 90). A maths-heavy options-pricing lesson took 136 seconds and failed every time at the old limit. Scoring still stops at 90 seconds.
- Text fields no longer show two focus rings. The default ring now gives way to fields that draw their own.
- `scripts/e2e-tailored.ts` tests a tailored course end to end through the running app: 18 checks, about $0.08 a run, and it deletes its test learner afterwards.
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
- "Put it in order" drag and drop also uses dnd-kit (its sortable list, `@dnd-kit/sortable`): rows slide aside as a step is dragged and the step follows the pointer, which the hand-written pointer code didn't do reliably. The arrows and keyboard still work.
- Lesson text draws markdown tables, lists and **bold** properly; a payoff table used to show as a row of pipes.
- Lesson text renders math (KaTeX: \( \), \[ \], $$ $$, and \ce{} for chemistry); a single $ is still a price.
- Lessons can put an interactive graph inside any explanation, worked example or problem; graphs that wouldn't draw are removed.
- Explanation steps have layouts the writer picks: standard, side by side with the example, one big statement, or numbered points.
- The course journey follows the road painted in the course's world (traced once by Gemini 3.1 Pro, about half a cent), with stops evenly spaced; before, the stops were joined by straight lines across rivers and buildings.
- Levels on the journey are marked where they begin: a tag on each level's first stop, the road coloured by level, and a key with the full names under the map. The old row of names across the top didn't line up with the road.
- A course page's header has a progress card: percent done, each level as a row of its lessons in the level's colour, the bookmark, and one button for what to do next. It replaces a thin bar and a star floating on its own.
- Written reflections are graded: "Check my answer" tells the learner whether they've got the idea, what they got right and what to add, then shows the model answer (GPT-6 Luna, well under a cent; not saved or counted).
- Lessons no longer lose all their scenes when the staging model skips a step: each step carries its number, a missing one shows its painting without a line, and lines stay on the right blocks. Before, writing 12 steps for a 13-step lesson threw the whole staging away.
- Course worlds no longer have region names painted into them: the prompt describes what each region shows, without titles or numbers. A fourth level is green instead of a second purple.

## Quality and facts
- Knowledge checks are tested for giveaways (research/question-quality.md; run 13): code flags the right answer being the longest or the only one echoing the question, absolute words only in wrong options, "all of the above", and hints that give the answer away; a model shown only the options tries to guess the answer, and a confident right guess sends the lesson back.
- Answer options are shuffled in code when a lesson is saved, so the right answer isn't always in the same place.
- The writing guide asks for checks in new situations, with wrong options built from real misconceptions.
- Arithmetic written as TeX math is checked like plain arithmetic.

- Every lesson goes through a quality gate before anyone sees it: write, check, review, revise once if needed. Only a version that was checked can be shown.
- Arithmetic in lessons is recomputed in code (`lib/factCheck.ts`). A wrong sum sends the lesson back, and a lesson whose every version is wrong is never shown.
- Factual claims are checked against web search (`lib/factVerify.ts`). A verdict only counts if its source is a page the search really returned. Contradicted claims block the lesson.
- These checks exist because tests showed models passing their own wrong facts, such as a lesson teaching 6.75 + 4.75 = 19.00.
- The writing guide asks for accuracy up front: precise figures only when certain, no invented quotes, disputed views attributed.
- The fact check reads sources written as markdown citations; before, it threw away most real confirmations as "unclear".

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

- Cheaper lessons, from about $0.25-0.31 to about $0.16 each (about $1.35 for a new 8-lesson course; ECONOMICS.md has the table):
  - The fact check now uses GPT-6 Luna to read search results and checks the 5 most important claims, not 8.
  - Web searches (fact check and "Go deeper") use Parallel's fast search, $0.001 a search, instead of Exa ($0.007). Google search through Gemini was considered: $0.014 a search, so it would cost more, not less.
  - Measured live (run 12): a new course with lesson 1 costs about $0.19 (lesson $0.15, world $0.05); a second learner on the same course costs under a cent.
  - A lesson has at most 2 paintings instead of 3.
- Every lesson of a shared course is now cached, not just lesson 1 (`shared_lessons`, migration 012). Learners who haven't answered any check wrong get the same, already-checked lessons as others on that path, for under a cent each. A mistake makes their next lessons their own.
- Each run's cost now records how many prompt tokens the provider served from its cache (`tokensCached`).
- The app ships as a Docker image (`Dockerfile`, Next.js standalone output) for Coolify. It runs as one long-lived container, because lesson jobs run inside the server process. `NEXT_PUBLIC_*` variables must be build variables; the README has the steps.
- Paintings survive a rate-limited image model: a failed request is retried once, then painted by Gemini 3.1 Flash Lite Image (same price). On 2026-10-12 Nano Banana 2.1 was rate-limited upstream for minutes, and every painting failed.
- Images also failed earlier that day because the OpenRouter key's own spending cap was nearly used up; images need $1 of headroom on the key, whatever the account balance.
- Each run's cost is split by step in its trace (agent, write, review, revise, verify, blind). Measured (run 15): writing is about 65% of a lesson's cost, and a revision costs more than the first draft.
- The tutor agent's turns run on GPT-6 Luna (about $0.0003 a run instead of $0.01-0.02); planning a new course stays on GPT-6.1 Sol, like writing and reviewing lessons.
- Revisions change only what the review names (a patch applied in code) instead of rewriting the lesson: about 20% cheaper on a broad review, more on a narrow one. The reviser also sees the problems found in code, so it stops reintroducing them.
- A lesson below the bar now gets its revision: the cutoff moved from 120s to 165s into a run, since writing and reviewing often used up the old one.
- The catalog courses on the home page are seeded into the shared cache, so clicking one opens its plan, painted world and lesson 1 at once for under a cent. Catalog courses use the shared version for everyone; topics people type still get tailored plans. Re-run `scripts/seed-catalog.ts` after the lesson guide or models change.
- Checked from a learner's side (scripts/check-cache.ts): a seeded catalog course, the same course in other words, and a catalog course for a learner with other courses all come from the cache (plan, lesson 1, scenes and world) for under a tenth of a cent.
- A cached lesson is served without the tutor agent's turns, since there's nothing to decide: a cached start went from 12s to 7s on the dev machine, almost all of it database round trips that are much shorter on the production server.
- The landing page's scrolling topics are offered courses too: they use the shared cache like the catalog and are seeded with it (25 courses in all). The seeding script stops before the key runs dry.
- Seeded 23 of the 25 offered courses (plan, world, lesson 1 and its scenes) for about $6.60 in all, about $0.20 a course that passes first time. Not cached yet: lesson 1 of Byzantine iconoclasm (7.6) and Baroque music (5), and the world of Unit economics.
- Tried Claude Haiku 5.5 as the lesson writer, with Sol still planning and reviewing (run 19): about 25% cheaper per lesson ($0.055 vs $0.074), but 1 of 4 lessons passed against Sol's 3 of 4, with factual and arithmetic slips. Kept Sol. LESSON_MODEL is now a switch for trying other writers; it's off unless set, and its lessons are cached separately.
- Cost cuts are on hold until there's real usage data. Paintings are about half of a new lesson's cost (~$0.07 of ~$0.15) and a cheaper image model saves almost nothing, since the image price per token is the same. Candidates for later: one scene per lesson, smaller images, lower writing effort, fewer revisions.

## Accounts and data

- Migration 014 (applied) adds tailored courses: `courses.intake` and `outcomes`, `jobs.intake`, and the `course_materials` table (passages with embeddings, own rows only). Deleting an account now deletes its jobs too.

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
- Home topic form: removed the double focus ring (input marked input-bare); pill gets a soft accent halo on focus, like the other inputs.
- Back links on course and module pages use a BackLink with an aligned arrow icon instead of a "←" text glyph.
- Diagram activity: the view fits its nodes and 3-line captions (no clipped labels), no browser focus box on a tapped node, the canvas fills its cell beside the panel, and connections list the linked node with the relationship underneath.
- "Split" explain layout splits on the card's own width (container query), so beside a scene it stacks instead of squeezing text and example into two thin columns.
- Hands-on lesson steps (activities, code, compare) show their scene as a short banner above instead of a side column, so they get the full width; reading steps keep the scene beside them.
- Diagram panel sits beside the map only when the activity is wide (container query), else below; connections are chips, and a relationship label that repeats the node's name is hidden. The map is capped at 560px wide.
- Reflect model answers show only the answer: a lead-in like "One possible caption:" and its quotes are stripped in code (modelAnswerText, also for saved lessons), and the writing guide asks for the answer alone.
- Guide voice lines no longer overlap: one line plays at a time on the page, and a line whose audio arrives after its step (or lesson) closed is dropped instead of played (SpeakButton in Scene.tsx).
- "Setting the scene" shows a picture while a lesson is staged: the module's cover, else the course's painted world, else its catalog art (default cover for typed topics). It was an empty box for every course planned after modules stopped getting their own covers.
- Activity and block prompts (and activity insights) now draw tables, lists and paragraphs instead of inline text only, and a table the writer put on one line (rows joined by "| |", with a separator row) is rebuilt into rows (unflatten in lesson/rich.tsx).
- Admin panel at /admin: learners, courses, lessons (outline, checks and answers, how far they got), every run with its trace and cost by step, jobs, the shared cache, mistake reports, subscriptions and partners, and AI spend by day, kind, step and learner. Read-only.
- Admin access is a role in the database (user_roles, migration 016), not an env list. It's its own table because learners can edit their own profile row and could give themselves a role. Everyone without it gets a 404 rather than "forbidden", so the panel doesn't reveal it exists.
- The first admin is granted with scripts/grant-role.ts; after that, admins use "Make admin" on a learner's page. You can't remove your own role, so the last admin can't lock everyone out.
- The admin panel speaks plain English: "Wrote a lesson" instead of "learn · lesson", "Fact-checking online" instead of "verify", "Usual time" instead of p50. The overview starts with a written summary and a "Needs attention" box.
- Mascot: a small owl in a beret (Athena's owl), drawn in SVG with the colour tokens (components/mascot/PaintingOwl.tsx). On "Setting the scene" it flies in front of an easel and paints the lesson's picture onto the canvas stroke by stroke over a pencil sketch, then does touch-ups; wing flap and blink are CSS. Reduced motion shows the finished painting with the owl still. Replaces the sparkle Lottie there.
- The admin panel is split into tabs: Overview is four numbers, a "needs attention" box and four per-day charts. Money (by day, kind of job, inside a lesson, by learner, over 7/30/90 days), Problems, Learners, Courses and AI activity have their own tabs, charts and pages of 25.
- Problems collects everything that went wrong: failed AI jobs, lessons that couldn't be written, mistake reports, and lessons that never reached 8/10. It explains how each is recorded.
- Mistake report types read as words ("Wrong fact", "Confusing", "Something broken"), and common errors as a sentence ("The OpenRouter key ran out of credit…"); the raw error stays on the job's page.
- A failed staging now records why it failed (the guide script's rejection reason). Before, those runs had no error text.
- Admin panel layout: content starts right after the sidebar instead of being centred with a gap on wide screens; "Back to the app" sits at the bottom of the sidebar; per-day charts start at the first day with any data (at least a week) instead of 30 days of empty bars, and the day-by-day table skips the zero days before that.
- Admin charts and tiles redesigned: each chart is a card with its title, the period total and a Details link; bars are slimmer and rounded, today is the solid one, empty days show a faint stub, and only the highest day and today carry a value. Number tiles have an icon, larger figures and a mini chart of recent days. The value axis is as wide as its labels.
- The admin panel can change things now: edit a course's title and description, edit lessons not written yet, move a learner to another lesson, have an unfinished lesson rewritten, retailor a tailored course (goal, context, what they know, outcomes), delete a course; and for shared plans, edit their wording and lessons, retire a saved lesson, or stop reusing the plan.
- Finished lessons can't be rewritten (they're the learner's record), and you can't change your own admin role. Destructive actions confirm in place.
- Every change is recorded in an activity log (admin_actions, migration 017) with who did it and the before and after; each course and plan has its own History tab.
- The admin panel has the Wondersity logo and a welcome banner over the painted world with today's numbers in one line.
- Learners can pick an avatar in Settings → Profile: 12 painted clay animals (owl in a beret, fox with laurels, bear, cat, rabbit, tortoise, dolphin, lion, penguin, panda, hedgehog, deer), or "Default" for their Google photo or initial. Only the id is stored (profiles.avatar, migration 018) and the API accepts only known ids. The pictures are static files made once by scripts/generate-avatars.ts (about $0.50 for the set), not painted per learner.
- Every course has its own cast of voices (courses.voices, migration 019). Left alone, staging gave nearly every male guide "cedar", and a course with several guides (Washington, Adams, Douglass) gave them one voice. Now a character keeps one voice across the course, different characters get different voices of the kind staging asked for, and which voice comes first varies by course.
- Dialogue blocks are voiced: staging casts the other speakers (staging.cast), and "Listen" reads the dialogue turn by turn in their voices, stopping after a question so the learner can answer in their head first.
- The course page lists who speaks in the course with a sample of each voice, and the learner can recast anyone; their next lines are recorded in the new voice. Samples are static files (scripts/generate-voice-samples.ts, about $0.01 for all 8).
- Speech moved from the voice route into lib/speech.ts so the route and the sample script share it.
- Keyboard in lessons: → or Enter continues, ← goes back, 1-4 or A-D answers a check. Keys meant for a field, slider or drag handle are left alone; a hint shows only where there's a fine pointer.
- Onboarding has an avatar step after the name; the picker is shared with Settings.
- "How was this lesson?" on the finish screen: thumbs up or down, and after a thumbs down an optional word (lesson_ratings). Thumbs down appear in the admin panel under Problems and in "Needs attention".
- Courses can be archived (listed apart on Courses, still open) and started over. Starting over doesn't delete lessons: they're taken off the course's path (module_index null), so the streak, certificate and mistakes to review are kept; the tutor's mistake lookup ignores them so the fresh start adapts afresh.
- Review page (/review, in the sidebar): every check missed the first time, to try again. Graded on the server; a right answer clears it (review_clears); the original attempt is never changed; the answer is only sent once cleared or asked for after two misses.
- Bookmarks are kept with the account (bookmarks table) instead of one browser; ones a browser still holds move in once and are removed from it.
- Download my data (Settings → Account): everything as one JSON file, read as the learner so row rules apply. Delete my data now also removes notifications, push subscriptions, bookmarks and Help messages (migration 020 lets learners delete their own messages).
- Settings → Account: change the email (confirmed by a link) or password of an email account; Google accounts are told they're managed at Google. Auth errors are shown as plain sentences.
- Share course: on the course page and when a course is finished. It links to /start?topic=…, which sends a signed-out visitor to sign-up with the topic kept and opens the start dialog for someone signed in.
- Streak freeze: one missed day a week is bridged automatically (it keeps the streak but doesn't add to it). The client's streak now uses the same function as the server's instead of its own copy. Progress says when the freeze was used.
- Weekly recap: Sunday 17:00-21:59 in the learner's time zone, the hourly cron sends lessons, minutes, streak and what's next to learners who finished a lesson that week (same switch as the daily reminder, renamed "Reminders and weekly recap").
- Help page (/help, in the footer and Settings): quick answers and a form. Messages are saved signed in or out (signed out needs an email) and listed under Problems → Messages, where they're marked answered.
- Settings is split into tabs: Profile, Plan, Notifications, Account. The tab is in the URL (?tab=); the bell's link goes to Notifications and returning from checkout opens Plan.
- Privacy page lists the new things we keep and how to download your data.
- scripts/e2e-product.ts checks all of the above against the running app with a throwaway learner (36 checks; one real staging, about $0.10).
- Added scripts/setup-paddle.ts, which creates the Paddle product, monthly/yearly prices, webhook and client token via API and writes the env values; idempotent via custom_data.app.
- Clickable things show the hand cursor again: Tailwind v4 resets buttons to the arrow, so globals.css base layer sets cursor: pointer on buttons, role="button", labels, selects, summaries, checkboxes, radios and ranges (not-allowed when disabled).
- Skeletons match what they stand in for (src/components/Skeletons.tsx): home cards, course tiles, the course page with its road, the lesson player, review checks, settings, plan, progress rows. One shimmer band sweeps every bone together; still with reduced motion. Library and Progress no longer flash "nothing yet" or zeros before data loads.
- Docker build no longer crashes when NEXT_PUBLIC_SITE_URL is not passed: the Dockerfile declares the arg, so it arrives as "", and layout.tsx now falls back with `||` instead of `??`.
- Feedback said lessons all had the same shape and the writing was hard to follow. The guide now starts with writing rules (one idea per step, short sentences, show before naming, connect the steps, don't hedge every line), and the writer is "a great teacher", not "an instructional designer".
- New code checks feed the reviewer: readability (long steps and sentences, too many new terms, wordy options and table cells) and variety (the read-do-check loop repeated, an approach the lesson doesn't show, repeating the previous module's opening, ending, activities or rhythm). Hard-to-follow or same-shaped lessons can't score above 7.
- The writer now sees the last two modules' block sequences so the next lesson can be shaped differently.
- Compare tables redrawn: narrow label column, hairline rows, the second column tinted, larger text, a card per row on phones, and a "The difference" takeaway under the table. Writers keep cells to short phrases.
- Missing lesson pictures came from the OpenRouter key's $25 limit (it refuses images under $1 left). Failed pictures are now logged as "Scenes couldn't be painted" in admin instead of a success; they repaint when the lesson is opened again.
- Compare table: each column now has its own tint (grey for the first, blue for the second, matching the header dots); the label column stays plain. Before, the label column and the first column were both white.
- Site header on phones: buttons never wrap; signed in, the button says "Open app" under 640px ("Open Wondersity" above); "Sign in" moves into the menu under 440px; tighter gaps on phones.
