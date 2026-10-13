# Model runs

All runs used OpenRouter. Prices are OpenRouter's list prices on 2026-10-11,
in US dollars per million tokens (input / output). Costs are what OpenRouter
reported for each call (`usage.cost`), unless a run says otherwise.

## The models

| Model | Price (in / out per 1M) | Tested as |
| --- | --- | --- |
| openai/gpt-6.1-sol | $2.00 / $10.00 | writer, reviewer (**current writer and reviewer**) |
| openai/gpt-6-sol | $2.00 / $10.00 | writer, fixed reviewer |
| openai/gpt-6-luna | $0.10 / $0.50 | writer (**current for staging, "Go deeper" and topic matching**) |
| anthropic/claude-opus-5.5 | $4.00 / $20.00 | writer |
| anthropic/claude-haiku-5.5 | $0.10 / $0.50 | writer |
| deepseek/deepseek-v4.1-flash | $0.30 / $1.20 | writer, fixed reviewer (the original writer) |
| z-ai/glm-5.3-flash | $0.15 / $0.50 | writer |
| openai/text-embedding-3-small | $0.02 / – | topic matching for shared course plans |
| google/gemini-nano-banana-2.1 | about $0.03 an image | paintings |
| openai/gpt-audio-mini | $0.60 / $2.40 | the guide's voice |

Not tested: deepseek/deepseek-v4-pro ($0.21 / $0.42), GPT-6 Sol Pro, GLM 5.3
FlashX.

The sample topics come from `scripts/sample-lessons.ts`. All are lesson 2 of
level 1 of a 9-lesson course:
- black holes (the event horizon)
- Python loops (for loops and accumulators)
- the French Revolution (why 1789)
- game theory (the prisoner's dilemma)
- projectile motion (launch angle and range)
- probability (independent events)
- four niche topics: the Socratic method, Ostrom's commons, Ancient Greek accents and Babylonian base-60 numbers

---

## Run 00: Claude Haiku 5.5 vs DeepSeek V4.1 Flash

**Question:** Haiku costs about a third of DeepSeek's list price. Is it good enough?
**Method:** the same French Revolution lesson through the gate of the time, where each model reviewed its own lesson.

| Writer | Time | Gate score |
| --- | --- | --- |
| DeepSeek V4.1 Flash | 74s | 9, passed on the first draft |
| Claude Haiku 5.5 | 187s | 6.5 first draft, 7.5 after the rewrite: never passed |

**Decision:** stay on DeepSeek. Side fix: Anthropic models reject our large lesson schemas as strict grammars, so they now get the schema in the prompt instead (`lib/model.ts`).
**Data:** `runs/00-haiku-vs-deepseek`.

## Run 01: four writers, two fixed reviewers

**Question:** which writer is best, judged fairly?
**Method:**
- 4 writers × 3 lessons (black holes, Python loops, French Revolution), each through the gate reviewing its own lesson.
- Then every lesson was re-scored by two fixed reviewers: GPT-6 Sol and DeepSeek V4.1 Flash.

Scores are in the order black holes, Python loops, French Revolution.

| Writer | Gate (self) scores | GPT-6 Sol reviewer | DeepSeek reviewer | Time per lesson |
| --- | --- | --- | --- | --- |
| GPT-6 Sol | 8, 7, 8.5 | 7, 8, 8 → **7.7** | 9, 9, 9 → **9.0** | 45-78s |
| DeepSeek V4.1 Flash | 9, 8, 8 | 6.2, 7.2, 6.5 → 6.6 | 9.5, 9, 8 → 8.8 | 31-89s |
| Claude Haiku 5.5 | 7.5, 8, 7 | 5.5, 7.4, 6 → 6.3 | 7, 8.5, 9 → 8.2 | 87-94s |
| GLM 5.3 Flash | 8, 7, 9 | 6, 5, 6 → 5.7 | 7, 5, 7 → 6.3 | 28-37s |

**What the fixed reviewers found** (all of these passed the writers' own review):
- **GLM:** taught "6.75 + 4.75 = 19.00" (it's 11.50) and credited Newton with the dark-star idea (John Michell).
- **Haiku:** confused the Sun's radius with its diameter, and said the monarchy fell in 1789 (it was abolished in 1792).
- **DeepSeek:**
  - said 11.5 sous of a 25-sous wage was "over half" (it's 46%)
  - drew the black-hole horizon at 0.9 cm instead of about 0.885 cm

**Decision:** self-review misses factual and arithmetic errors, so the harness needs code checks for numbers and a reviewer that isn't the writer. This led to `lib/factCheck.ts` and `REVIEW_MODEL`.
**Data:** `runs/01-four-writers` (lessons, logs, `judge-openai_gpt-6-sol.tsv`, `judge-deepseek_deepseek-v4.1-flash.tsv`).

## Run 02: six writers, cost from the key's balance

**Question:** what does each writer actually cost? This run added GPT-6 Luna and GPT-6.1 Sol.
**Method:** each model ran its 3 lessons alone, and the cost was taken as the change in the key's total spend.

**Result:** unreliable. The per-model figures summed to $0.26 while the key's spend rose $0.36, because OpenRouter's balance updates late (`costs.txt`). This led to recording each call's own cost (`withUsage` in `lib/model.ts`), which every later run uses. Fixed-reviewer scores for this run's GPT-6 Luna and GPT-6.1 Sol lessons are in run 03's reviewer file.
**Data:** `runs/02-six-writers-first-try`.

## Run 03: six writers, exact cost

**Method:**
- 6 writers × 3 lessons, with each call's cost recorded.
- Then re-scored by GPT-6 Sol. That reviewer file also scores run 02's Luna and 6.1 Sol lessons.

| Writer | Average cost per lesson | GPT-6 Sol reviewer (black holes, Python, French Rev.) | Average over 6 lessons* |
| --- | --- | --- | --- |
| GPT-6.1 Sol | $0.064 | 8.5, 7, 8 | **7.9** |
| GPT-6 Sol | $0.088 | 8.5, 8.3, 7.5 | **7.9** |
| GPT-6 Luna | $0.003 | 8, 7.4, 6.5 | 7.2 |
| Claude Haiku 5.5 | $0.013 | 6.5, 7.5, 7.3 | 6.7 |
| DeepSeek V4.1 Flash | $0.025 | 4.5, 7.5, 6.5 | 6.4 |
| GLM 5.3 Flash | $0.006 | 5, 6, 5 | 5.5 |

\* Run 03 plus run 01, or plus run 02 for Luna and 6.1 Sol: six lessons per writer, all scored by GPT-6 Sol.

**Findings:**
- **List price misleads.** DeepSeek writes 16-21k output tokens per lesson, mostly hidden reasoning, against Luna's 4-8k. So it cost about seven times as much per lesson as Luna.
- **GPT-6.1 Sol uses fewer tokens than GPT-6 Sol** at the same price.

**Data:** `runs/03-six-writers-exact-cost` (`judge-openai_gpt-6-sol.tsv`).

## The arithmetic checker (lib/factCheck.ts), swept over every lesson

Not a model run. The code checker was run over every saved sample lesson before it was allowed to reject anything.

- **First version, 54 lessons:** caught the one real error (GLM's 19.00) with no false alarms.
- **During run 06:** it wrongly rejected two Opus lessons, on correct maths it misread:
  - chains: "0.5 × 0.4 × 0.5 = 0.2 × 0.5 = 0.1" and "7200 + 300 + 30 = 7530"
  - integer division: "400 ÷ 60 = 6 remainder 40"
  - a formula whose start it couldn't see
  - base-60 notation: "1,40"
- **After fixing those, 63 lessons:** the real error is still caught, with no false alarms. Each misread case is now a test.

## Run 04: GPT-6 Luna writes, GPT-6.1 Sol reviews

**Question:** the cheapest good writer, with a strong independent reviewer?
**Method:** the new gate (code arithmetic check, a separate reviewer, a rewrite below 5), 6 topics. Then re-scored by DeepSeek as a cross-check.

| Topic | Gate score | Passed (8+)? | Cost incl. review | DeepSeek reviewer |
| --- | --- | --- | --- | --- |
| Black holes | 7.3 | no | $0.025 | 9 |
| Python loops | 6.8 | no | $0.025 | 7 |
| French Revolution | 7.5 | no | $0.027 | 9 |
| Game theory | 8 (after a revision) | yes | $0.025 | 9 |
| Projectile motion | 7 | no | $0.023 | 7 |
| Probability | 6.5 | no | $0.025 | 7 |

**Result:** cheap (about $0.025 a lesson with review), but only 1 of 6 reached the bar, even after revising. The probability revision scored 8 but carried a false arithmetic alarm, a checker bug fixed later, so the 6.5 draft was kept.
**Data:** `runs/04-luna-with-sol-reviewer`.

## Run 05: GPT-6.1 Sol writes and reviews

| Topic | Gate score | Time | Cost incl. review | DeepSeek reviewer |
| --- | --- | --- | --- | --- |
| Black holes | 8 | 63s | $0.038 | 9 |
| Python loops | 8.5 | 58s | $0.043 | 9 |
| French Revolution | 8 | 81s | $0.050 | 9 |
| Game theory | 8.5 | 63s | $0.040 | 9 |
| Projectile motion | 8.7 | 58s | $0.038 | 9 |
| Probability | 8.3 | 63s | $0.044 | 9 |

**Result:** 6 of 6 passed on the first draft, with no revisions, at about $0.042 a lesson. The DeepSeek cross-check scored Sol at 9.0 against Luna's 8.0 on the same topics.
**Decision:** GPT-6.1 Sol writes and reviews. Self-review is a known weakness, so arithmetic is checked in code and factual claims against the web (run 07). `REVIEW_MODEL` can point at another family.
**Data:** `runs/05-sol-writes-and-reviews`.

## Run 06: Claude Opus 5.5 writes, GPT-6.1 Sol reviews

| Topic | Gate score | Cost | Note |
| --- | --- | --- | --- |
| Python loops | 7.8 | $0.384 | revised; the re-score failed (out of credit) |
| Game theory | 7 | $0.180 | the revision failed (out of credit) |
| Projectile motion | 7 | $0.333 | revised; the re-score failed (out of credit) |
| Probability | 7.8 | – | rejected by a false arithmetic alarm (since fixed) |
| Babylonian numbers | 7.7 | – | rejected by false arithmetic alarms (since fixed) |
| 5 other topics | – | – | failed: the key's $10 limit was reached |

**Result:** about $0.18 a lesson when the first draft is kept and $0.33-0.38 with a revision, 4-8 times GPT-6.1 Sol. It scored lower than Sol with this reviewer, though Sol may favour its own writing; there wasn't enough credit to cross-check. Opus was not adopted.
**Data:** `runs/06-opus-writer` (the three lessons that completed).

## Other model checks

- **Tool calling:** GPT-6 Luna and GPT-6.1 Sol were each given the tutor's tools and told about one wrong quiz answer. Both called `get_quiz_mistakes` first, which is correct.
- **"Go deeper" lookups** (no model involved), tested against the real services:
  - Open Library found "Citizens" (Schama, 1989) and "A Brief History of Time" (Hawking, 1988), and rejected a made-up book.
  - Wikipedia returned licensed images for "Storming of the Bastille", "Event horizon", "Projectile motion" and others.
  - YouTube oEmbed confirmed a real video and rejected a fake id.
  - commons.wikimedia.org is blocked on our network, so images go through en.wikipedia.org.

## Run 07: the current gate, live

**Question:** the first live run of the full current gate:
- GPT-6.1 Sol writes and reviews
- the arithmetic check
- the online fact check (claims searched on the web, verdicts only from pages the search returned)

What do lessons cost now, and what does the fact check find?

**Method:** the 10 sample topics in parallel, with $4.92 of credit left on the key. The key spent $0.66 in total.

| Topic | Gate score | Cost | Fact check |
| --- | --- | --- | --- |
| Black holes | 8 | $0.060 | 8 claims: 0 confirmed (7 searches failed, 1 quote mismatch) |
| Game theory | 9 (6.5, then 9 after a revision) | $0.160 | first try failed; 4 claims: 0 confirmed |
| Projectile motion | 8.5 | $0.082 | 8 claims: 0 confirmed |
| Probability | 8.5 | $0.098 | 4 claims: 0 confirmed |
| The Socratic method | 8.7 | $0.103 | 6 claims: 1 confirmed |
| Ostrom's commons | 8.5 | $0.040 | failed (credit reservation) |
| Ancient Greek accents | 8.5 | $0.105 | 8 claims: 1 confirmed |
| Babylonian numbers | 8.5 | $0.045 | failed (credit reservation) |
| Python loops, French Revolution | – | – | failed: 402 "in-flight budget exhausted" |

**Findings:**
- **Lessons were good.** Every written lesson scored 8-9 and none was contradicted. A lesson now costs about $0.04-0.16, against about $0.04 without the fact check.
- **The fact check barely worked.** Only 2 of about 50 claims were confirmed, for two reasons:
  1. **Credit reservations.** No call set a maximum output, so OpenRouter reserved the model's largest possible reply (about $1 for GPT-6.1 Sol) against the key while each call ran. Ten lessons, each with several parallel searches, exceeded what the remaining credit could cover at once, and OpenRouter refused calls with 402. A lesson whose check failed was still shown, judged on the other checks: the gate fails open on a search outage.
  2. **The evidence rule was too strict.** A verdict needed its quoted sentence to match the returned page text exactly. But the page text is a set of excerpts joined by "…", and models drop citation marks or stitch across the gaps, so most real quotes were rejected.

**Fixes** (then run 08):
- Every model call now sets `max_tokens`: about 24k for writing, 6k for review, 2-3k for fact-check steps, 8k for agent turns.
- Searches run at most 4 at a time per lesson.
- A quote counts if it has at least 6 meaningful words and 80% of them are on the page. A live check confirmed a real Wikipedia quote passes; an invented one still fails (tested).

**Data:** `runs/07-current-gate`.

## Run 08: after the first fixes, still in parallel

**Method:** the same 10 topics in parallel again, with the output caps and the 4-search limit, and $3.70 of credit left. The key spent $0.53.

**Result:**
- **7 of 10 lessons failed** with 402 "in-flight budget exhausted", worse than run 07. A single small call a minute later failed the same way and succeeded after about 2 minutes. So OpenRouter's in-flight budget is a separate allowance that drains in a burst and recovers slowly, not just the balance. Practical rule: test with few lessons at a time, and keep a healthy balance in production, where many learners can be writing lessons at once.
- **The 3 completed lessons scored 8.5-8.7** (Python loops, game theory, projectile motion), at $0.05-0.13.
- **The fact check still confirmed nothing:** 7 of 7 answered claims were downgraded as "evidence not on the page". A live check found why. The model cited the right page and quoted it exactly ("Maximum range is achieved at 45°."), but the rule needed 6 meaningful words, and models quote short, precise sentences.
- **The arithmetic checker rejected the Babylonian lesson for "60 × 60 = 3"**, a false alarm: the number ran on ("3,600s place", "3 600" or base-60 "1,0,0") and the checker read only the "3".

**Fixes** (then run 09):
- A quote needs at least 3 meaningful words, and numbers now count. A short quote must be wholly on the page; one of 6 or more words, 80%. Tested with the real run-08 quote, plus invented and altered ones.
- The arithmetic checker skips a claim whose number is cut short. All three phrasings are tests now, and a sweep of every saved lesson still flags only GLM's 19.00.

**Data:** `runs/08-gate-after-fixes`.

## Run 09: one lesson at a time, after the second fixes

**Method:** the same 10 topics run one after another, with $3.40 left. The key spent $0.49.

| Topic | Gate score | Cost | Fact check |
| --- | --- | --- | --- |
| Black holes | 8.2 | $0.189 | 8 claims: 1 confirmed, 7 quotes not matched |
| Python loops | 8.5 | $0.063 | 1 claim: quote not matched |
| French Revolution | 8 | $0.189 | 8 claims: 2 confirmed, 6 quotes not matched |
| Game theory | 8.3 | $0.059 | 4 claims: 3 searches refused (402), 1 quote not matched |
| The other 6 | – | – | failed: 402 "in-flight budget exhausted" |

**Findings:**
- **The credit limit is the account, not the code.** Even one lesson at a time, every lesson after the fourth was refused with $2.90 still on the key. This key's in-flight allowance is much smaller than its balance; OpenRouter says adding credit raises it. Before launch, the key needs enough credit, and possibly a talk with OpenRouter, for real traffic.
- **Lessons stayed good:** 8-8.5, nothing contradicted. A lesson with the fact check costs about $0.06-0.19, against about $0.04 without it: up to 8 searches at about $0.007 each, plus the model reading each set of results.
- **Quotes still mostly fail to match:** 14 of 17 answered claims. The trace didn't record the rejected quotes, so it now does (`downgraded` shows the quote and the page). The next run will show whether it's the model paraphrasing, quoting a different result than it cites, or OpenRouter's excerpts missing the sentence.
- **Until then, the fact check rarely blocks or confirms anything.** It never contradicted a lesson in these runs. Its main effect so far is the cost.

**Data:** `runs/09-gate-one-at-a-time`.

## Run 10: a real course end to end

**Method:** `scripts/e2e-course.ts`, run against the running app's HTTP API with two throwaway learners:
- **Learner A:** onboarding, then "Stoicism" (plan and lesson 1), then scenes and "Go deeper", one voiced line and the course world.
- **Learner B:** "stoic philosophy", which should reuse A's shared plan and lesson 1.

Both learners and their data are deleted afterwards.

**First attempt:**
- **Learner A:** the plan was made and shared, and lesson 1 was written (8.5, with 3 sources confirmed by the fact check), saved and shared. The tutor's final short note then hit the 402 limit, and the harness threw the whole run away. The learner got "Lessons can't be written right now" although their lesson existed. Cost $0.19.
- **Learner B:** "stoic philosophy" matched A's Stoicism plan by meaning (`plan_cache: hit`), then hit the same limit.
- **Fix:** once a lesson is saved, a failed closing note no longer fails the run; the lesson is returned without a note (`agent.note_failed` in the trace).
- The plain error message, the reference code and the server log entry all worked as designed.

**Second attempt** (after the fix, and a 2.5-minute pause for OpenRouter's in-flight budget):

| | Learner A, "Stoicism" | Learner B, "stoic philosophy" |
| --- | --- | --- |
| Course | the shared plan (exact match): 3 levels, 8 lessons | the same plan, **matched by meaning** |
| Lesson 1 | the cached copy: 8.5, passed, 3 confirmed sources, in **14s** | the cached copy, in **19s** |
| Scenes | guide Epictetus, 3 scenes written; **0 painted** (402) | – |
| "Go deeper" | 3 videos, 3 articles, 3 books, 3 images, all confirmed | – |
| Voice, course world | failed (402) | – |
| Cost | **$0.024** (staging and "Go deeper" included) | **$0.007** |

**Findings:**
- **The shared plan and lesson cache work as designed.** A new learner on a repeated course gets lesson 1 in seconds for under a cent, against about 2 minutes and $0.10-0.20 when it's written fresh. The cached Stoicism plan and lesson 1 were left in `course_plans`; they passed every check.
- **"Go deeper" filled all four kinds** of resource on a real lesson.
- **Paintings, voice and the world painting all failed with 402:** the same in-flight credit limit, now on image and audio calls. These were logged as generic server errors, because the image and voice code threw plain errors. They now throw provider errors, so they're classified (and worded for the learner) like any other AI-provider failure.
- **Not yet seen live:** a painted scene and a voiced line in this setup. They worked earlier in the project, before the key's limit was reached.

**Data:** `runs/10-end-to-end/report.json` (each learner's course, lesson, staging and run costs) and `runs/10-end-to-end.log`.

## Where things stand

- **Writer and reviewer:** GPT-6.1 Sol. It's the clear best value for lessons that pass (runs 03 and 05). Lessons in every live run of the current gate scored 8-9.
- **Cost per new lesson:** about $0.06-0.19 with the online fact check, $0.04 without it, and under $0.01 for a cached lesson 1.
- **The arithmetic checker:** reliable. It caught the one real error, and its false alarms are now tests.
- **The online fact check isn't earning its cost yet.** It confirms few claims, has never contradicted one, and doubles a lesson's cost. The next run, with quotes now logged, should show why quotes fail to match. If it can't be made to work, turning it off (`VERIFY_FACTS=off`) halves the cost of a lesson.
- **The 402 refusals were an empty account, not a small allowance** (see run 11). The OpenRouter account had $0.15 left while the key's own limit still showed $2.90. Keep the account topped up, above $1 at all times so paintings and voice work, and watch it, since other keys on the account draw from the same balance.


## Run 11: lessons as server-side jobs

**Question:** does a lesson get finished, staged and painted when the browser is closed?

**Change tested:** the tutor now runs as a job on the server (`lib/jobs.ts`):
- `POST /api/learn` starts the job and answers within about a second.
- The job writes the lesson, then stages it and paints a new course's world.
- The browser only watches the job (`/api/jobs`).

**Method:** `scripts/e2e-course.ts` again, with the cached Stoicism course.
- **Learner A** started its lesson and then behaved like a closed browser: the script never called the app again and only watched the database.
- **Learner B** watched its job through the app's job API, as the app does.

| | Learner A (browser closed) | Learner B (watching) |
| --- | --- | --- |
| Start request | answered in 1s (202) | answered in 1s (202) |
| Job | done in 64s, on its own | done in 67s |
| Lesson 1 | 8.5, 3 confirmed sources | the same |
| Staged by the server | guide Epictetus, 3 scenes written, "Go deeper": 2 videos, 3 articles, 3 books, 3 images | – |
| Paintings, world, voice | refused (402) | – |
| Cost | $0.024 | $0.024 |

**Findings:**
- **Server-side jobs work.** Nothing the browser does is needed for the lesson to be written, checked, saved and staged.
- **The 402 refusals have one cause: an empty account.** OpenRouter's messages were "requires at least $1.00 in balance for image or video output" and "at least $0.50 in balance for audio output". The account balance (`/api/v1/credits`) was **$0.15** ($80 bought, $79.85 used), while the key's own limit still showed $2.66: a key's limit is only a cap, and it spends the account's money. This also explains the in-flight refusals in runs 07-10. Earlier sections called it an account-level allowance; it was simply an empty account.

**Data:** `runs/11-server-jobs/report.json`, `runs/11-server-jobs.log`.


## Changes since run 11 (not yet measured live)

The account had $0.15 left, so these are untested:
- **Fact check:** GPT-6 Luna reads the results (was GPT-6.1 Sol), 5 claims (was 8), Parallel's fast search at $0.001 (was Exa at $0.007). Expected cost: about $0.01 a lesson, down from $0.05-0.15. Google search through Gemini was priced and rejected: $0.014 a search.
- **To check in the next run:**
  - whether Luna's verdicts hold up
  - whether Parallel's results come with page text: without it, the harness can only check that a cited page was returned, not that the quote is on it
  - cost per lesson, from query 11 in `supabase/queries/metrics.sql`
- **Paintings:** at most 2 per lesson.
- **Shared lessons:** every lesson of a shared course is reused by learners who haven't answered a check wrong (migration 012).


## Run 12: the cheaper harness, live

**Question:** do the changes since run 11 work with credit in the account, and what does a new course really cost?

**Method:** `scripts/e2e-course.ts` with a topic nothing was cached for:
- **Learner A** started "Photosynthesis" and behaved like a closed browser.
- **Learner B** started "how plants turn sunlight into food".

| | Learner A (new course, browser closed) | Learner B (same course, other wording) |
| --- | --- | --- |
| Job | done in 191s, on its own | done in 20s |
| Plan | 3 levels, 6 lessons | A's plan, matched by meaning |
| Lesson 1 | 8.3, passed, misconception approach | A's lesson, from the cache |
| Fact check | 5 claims: 1 confirmed, 4 unclear | – |
| Staged by the server | guide Dr. Mira Chen with portrait, 1 painted scene; "Go deeper": 3 videos, 3 articles, 1 book, 3 images | – |
| Course world | painted by the server | shared from A |
| Voice | one line spoken in 7s | – |
| Cost | $0.071 tutor (plan, lesson, check, review) + $0.076 staging (portrait, painting, script, "Go deeper") + $0.047 world = **$0.194** | **$0.007** |

**Findings:**
- **Everything that needed credit now works:** paintings, the portrait, the world and voice, all made by the server with the browser closed.
- **A new lesson costs about $0.15** (tutor plus staging), in line with the $0.16 estimate in ECONOMICS.md. The world is $0.047 once per course.
- **A learner on a shared course pays almost nothing:** $0.007 to match the plan and serve lesson 1 from the cache.
- **Parallel's results do carry page text,** so the harness can check that a quote is on the cited page.
- **Prompt caching barely helps yet:** 1,316 of 19,258 input tokens were cached.
- **A bug threw away real confirmations.** The checker wrote its source as a markdown citation, "[ssec.si.edu](https://…)", and appended the same citation to its quote. The URL never matched a returned page, and the citation's words counted against the quote, so 3 of the 4 "unclear" verdicts were downgraded supported verdicts. `citedUrl()` and `quoteOnly()` in `lib/factVerify.ts` now strip the citation (tests from this run's output).
- **After the fix:** re-checking a saved lesson (run 08's projectile motion) confirmed 4 of 5 claims against returned pages; the fifth was unclear by the checker's own judgement.

**Data:** `runs/12-live-check/report.json`.


## Run 13: checks that make learners think, math, layouts

**Question:** with the new question checks (`lib/questionCheck.ts`, `lib/blindCheck.ts`; research/question-quality.md), the guide's formatting (TeX math, tables, inline graphs) and explain layouts, are checks less guessable, and does the writer use the new tools?

**Method:** `scripts/sample-lessons.ts` for Game theory and Projectile motion, the full gate, nothing saved.

| | Game theory | Projectile motion |
| --- | --- | --- |
| Score | 7 (revision skipped: a timed-out call used the time budget) | 8.4, passed |
| Code-detected question cues | none | none |
| Blind test | no giveaways | no giveaways |
| Fact check | 3 of 3 claims confirmed | 4 of 5 confirmed |
| Layouts used | split, standard | split, split |
| Formatting used | 3 tables | none (a graph activity) |
| Cost | $0.049 | $0.051 |

**Findings:**
- **The checks are no longer guessable from their wording.**
  - The options are parallel in form: for example, the four combinations of "increases" and "decreases".
  - Each wrong option is a specific mistake: misreading a payoff table, "horizontal speed stays the same", picking angles that don't add up to 90°.
  - The right answer isn't the longest option, and it doesn't repeat the question's words.
- **The blind test needed one fix.** On the first try it flagged a textbook prisoner's dilemma: the checking model recognised the subject from the options and knew the answer. That isn't a flaw in the question. The test now asks what the guess rests on, and only guesses based on wording count.
- **The writer used the new formatting only where the topic called for it.** It chose tables for payoff tables and the split layout three times. It didn't use TeX or inline graphs for these two topics. A more mathematical topic is the next test.
- **Network errors** (timeouts, a failed fetch) cost the first try of both lessons. The retry handled one; the other ran out of the revision budget.

**Data:** `runs/13-questions-math-layouts/`, `runs/13-questions-math-layouts.log`.


## Run 15: where a lesson's money goes

**Question:** GPT-6.1 Sol feels expensive. Which steps cost what, and is caching working?

**Method:** each model call is now counted under its step (`withStep` in `lib/model.ts`; `bySteps` in a run's `run.cost`). `scripts/sample-lessons.ts` ran on Probability and The French Revolution.

| Step | Model | Probability (passed first time) | French Revolution (revised) |
| --- | --- | --- | --- |
| Write | GPT-6.1 Sol | $0.031 (3.0k out) | $0.041 (4.0k out) |
| Review | GPT-6.1 Sol | $0.009 | $0.023 (two reviews) |
| Revise | GPT-6.1 Sol | – | $0.060 (4.0k out) |
| Fact check | GPT-6 Luna + Parallel | $0.007 | $0.015 (two checks) |
| Blind test | GPT-6 Luna | $0.0001 | $0.0003 |
| **Total** | | **$0.048**, score 8 | **$0.139**, score 7.5 |

Tutor runs in the app add the agent's turns, roughly $0.01-0.02 a run (the runs table: $0.060-0.066 for lessons that passed first time).

**Findings:**
- **Output tokens are the cost.** Sol charges $10 per million output tokens and $2 per million input. Writing a lesson produces 3-4k output tokens, about $0.03-0.04, and that is the floor while Sol writes.
- **Revisions are the spikes.** A revision rewrites the whole lesson, so it costs as much as the first draft or more. It nearly triples a lesson's cost.
- **Prompt caching works but saves little.** 15-30% of input tokens were cached in recent runs, about a cent a lesson, because input is the cheap side.
- **The shared lesson cache is the big saving,** but only for learners on a shared course (their first). A learner with several courses gets tailored, uncached lessons.
- **What could cut cost without touching lesson quality:**
  - running the tutor agent's turns on GPT-6 Luna (about $0.01-0.02 a run)
  - making revisions edit only the blocks the review names, instead of rewriting the whole lesson

  Neither was changed: quality comes first, and both need their own quality check.

**Data:** `runs/15-cost-by-step/`, `runs/15-cost-by-step.log`.


## Run 16: the tutor agent on GPT-6 Luna, targeted revisions

**Changes tested:**
- **The tutor agent on GPT-6 Luna:** its turns now run on Luna (`AGENT_MODEL`). The turn that plans a new course stays on GPT-6.1 Sol.
- **Targeted revisions:** they return a patch (`lib/lessonPatch.ts`), which code applies, instead of a rewritten lesson.
- **A longer revision window:** revisions may start up to 165s into a run (was 120s).

**Method:** `scripts/e2e-course.ts` (Plate tectonics; "how continents drift"), and `scripts/sample-lessons.ts` for The French Revolution, before and after the longer window.

| | Before | After |
| --- | --- | --- |
| Agent turns (2 a run) | about $0.01-0.02 on Sol | **$0.0003** on Luna |
| Planning a course (once) | part of the above | $0.008 on Sol |
| A revision (French Revolution, broad review) | $0.060 full rewrite (run 15) | $0.048-0.056 patch |
| Revisions skipped for time | Game theory (run 13), French Revolution and "how continents drift" (this run, at 120s) | none at 165s: French Revolution revised from 6.5 to 8, passed |

**Findings:**
- **The agent behaves the same on Luna:** create the course, write the module, close with a note. Planning still runs on Sol.
- **Patches save less than hoped on broad feedback.** A review naming six problems leads the reviser to touch most of the lesson, so the patch costs about as much as a rewrite. On a narrow review it would save more.
  - **A side effect:** in one test, the patch introduced new giveaway cues the reviewer hadn't named. The reviser is now also given the problems found in code. With them, the in-loop revision left none.
- **The bigger quality fix was time.** At 120s, writing and reviewing often used up the window, and lessons below the bar were shown unrevised. At 165s the revision runs and the lesson passes.
- **The cost of a lesson that passes first time** is now about $0.05-0.06 for the tutor run, about $0.04 of it writing. A revised lesson is about $0.13.

**Data:** `runs/16-luna-agent-patch/` (report.json, the-french-revolution.json, french-patched.json), `runs/16-luna-agent-patch.log`.
