# Harness engineering, and the harness in this app

## What harness engineering is

A language model on its own only maps text to text. An **agent** is the model
*plus* everything around it: the loop that calls it repeatedly, the tools it
can use, the context it's given, the state it reads and writes, the rules it
can't break, the checks on its output, and the logs that show what happened.
That surrounding system is the **harness**, and designing it is harness
engineering.

The core idea: **the model is a component; the harness is the product.** Two
apps using the same model can behave completely differently, because
reliability comes mostly from the harness: what the model is shown, what it
is allowed to do, and what gets checked before anything reaches a user.

The usual parts of a harness, and where each one lives in this repo:

| Part | What it does | Here |
| --- | --- | --- |
| Control loop | Calls the model, runs the tools it asks for, decides when to stop | `runTutor` in [src/lib/harness.ts](src/lib/harness.ts) |
| Context | What the model sees each turn | `describeState`: course plan, module status, quiz results, other topics |
| Tools | Actions the model can request | `create_course`, `get_quiz_mistakes`, `write_module` |
| State / memory | What persists between runs | Supabase: `courses`, `lessons`, `attempts`, `progress` |
| Guardrails | Rules enforced in code, not in the prompt | Tool preconditions, zod schemas, step/time limits, server-side grading |
| Verification | Checking output before it's used | Quality gate in [src/lib/lessonWriter.ts](src/lib/lessonWriter.ts): evaluator + revise |
| Observability | A record of every decision | The `trace` returned with each response, shown under "Harness trace" |

## Workflows vs agents, and why this app uses both

Anthropic's [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
draws a useful line:

- A **workflow** runs the model through *code-defined* steps. Predictable,
  cheaper, easier to test.
- An **agent** lets the *model* decide the next step, using tools in a loop.
  More flexible, but costlier and errors can compound.

The advice is to start with the simplest thing that works and add agency only
where the path genuinely varies. This app does exactly that:

- **The tutor is an agent.** What to do next really depends on the learner:
  new topic or returning? Which module is next? Did they get questions wrong
  that the next module should revisit? The model decides, using tools.
- **Lesson writing is a workflow.** Every lesson must go through the same
  generate → evaluate → revise steps. That's the *evaluator-optimizer*
  pattern from the same article: one call writes, a separate call scores
  against clear criteria, and a low score triggers a revision. It stays in
  code, because quality checks shouldn't be optional for the model.

The agent can choose *what* to write; it can't choose to skip the checks.

## One tutor run

```
POST /api/learn { topic, learnerId }
  │
  ├─ load course for (learner, topic)
  │    ├─ course finished?          → return overview      (no model call)
  │    └─ current module unfinished? → return that lesson   (no model call)
  │
  └─ agent loop (max 6 turns, 200s budget)
       context: course plan + module status + quiz results + other topics
       │
       ├─ create_course(title, description, modules[3-6])   only if none exists
       ├─ get_quiz_mistakes()                               if quizzes show errors
       ├─ write_module(focus)                               exactly once
       │    └─ quality gate (workflow)
       │         generate → evaluate → [revise → evaluate] → keep best evaluated
       │         → save lesson, update progress
       └─ reply with a 1-2 sentence note to the learner → loop ends

POST /api/attempts { lessonId, answers }   (after the quiz)
  └─ grade on the server → record attempts → mark module done → advance course
```

## Design decisions, and why

**Skip the model when the answer is already known.** Returning to an
unfinished module is a database lookup, not an agent run. It's instant, costs
nothing, and can't go wrong. A good harness spends model calls only where
judgment is needed.

**Rules live in code, not in the prompt.** The prompt *asks* the agent to
write one module per run. The harness *enforces* it: `write_module` refuses a
second call, refuses to run before a course exists, and always writes the
course's current module whatever the model asks for. `create_course` refuses
if a course exists. Prompts guide; code guarantees.

**Tool errors go back to the model; infrastructure errors stop the run.** If
the agent calls a tool wrongly (bad arguments, wrong order), it gets
`{ "error": "..." }` as the tool result and can correct itself on the next
turn. If the database or the lesson writer fails, the run stops with a clear
error. There's no point letting the model reason about an outage.

**Everything is bounded.** Max 6 agent turns, one nudge if the agent tries to
finish without writing, at most one revision per lesson, one retry for
malformed output, one retry for a timed-out or failed call (429/5xx), a 60s
timeout per model call, no revision after 120s, no new agent turn after 200s,
and a hard 280s deadline that every call (and retry) must fit inside the
route's 300s limit. A loop with no bounds is a bill and a hang waiting to
happen.

**Retry what's transient, not what's wrong.** A provider stall or a 503 is
worth one more try; a 400 or bad credentials isn't. Retries only happen if the
run's deadline leaves room for them.

**Never trust model output.** The lesson writer uses JSON-schema structured
output *and* validates with zod: 2-4 questions, exactly 4 options each, and
the correct answer must be one of the options. Tool arguments are validated
the same way.

**Never trust the client either.** The browser sends which option was picked,
not whether it was right. The server grades against the stored lesson. Only
the first completion of a module counts toward progress.

**Show only what was checked.** Only *evaluated* versions of a lesson can be
shown, and the highest-scoring one is kept. A revision that fails or can't be
re-scored is thrown away rather than shown unchecked. If nothing reaches the
8/10 bar, the best attempt is shown with its real score and a visible note.

**State lives in the database, not in the conversation.** Each run rebuilds
the agent's context from Supabase. That's what makes "continue whenever you
come back" work: there's no long chat history to lose, and the context stays
small and focused on what matters for the next decision.

**Make every run inspectable.** Each response includes a trace: which fast
path was taken, every agent turn and tool call (and whether it failed),
evaluator scores, revisions, saves. When something goes wrong, the trace says
where.

## Making it fast: measure, then change one thing at a time

A new course took about 80 seconds. The per-step timings in the trace showed
the agent's own turns were cheap (1-5s); nearly all the time was the two
lesson-writer calls. Measurements on DeepSeek V4.1 Flash via OpenRouter:

| Change | Before | After | Quality check |
| --- | --- | --- | --- |
| Route to the fastest provider (`provider.sort: "throughput"`) | evaluate 8-26s, generate 12-58s | evaluate ~4s, generate 9-12s | Same model; judge scores unchanged |
| Evaluator at `reasoning.effort: "low"` | 726 of 897 output tokens were hidden reasoning | | Scores matched the default effort |
| Writer at `reasoning.effort: "medium"` | ~20s typical | ~10s typical | 4/4 valid quizzes, avg score 7.56 vs 7.13 |
| Writer with reasoning *off* | | fastest | **Rejected**: lessons scored lower (6-7.5 vs 7-8), which would cause more revisions |
| Write the next module in the background after a quiz | 25-30s wait per module | ~0.1s when ready | Starts *after* grading, so the agent still sees the mistakes |

Result: a new course's first module in roughly 25-35s (including a revision
when needed), and later modules usually ready before the learner clicks.

The lesson: the slow part wasn't the agent loop, it was hidden reasoning and
provider choice. And "faster" options were checked against the evaluator
before being adopted, because a faster writer that triggers more revisions
isn't faster.

## Failures we hit building this, and the harness fix for each

These all happened during development. Each one is a harness problem, not a
model problem:

| What went wrong | Why | Fix |
| --- | --- | --- |
| Lessons arrived with no quiz | Schema allowed an empty `questions` array; only the revise prompt mentioned quiz rules | Schema requires 2-4 valid questions; the same rules go into every prompt; bounded retry |
| A lesson was shown that had never been scored | The loop revised *after* its last evaluation | Every revision is re-evaluated; only the best evaluated version can be returned |
| One request took 4+ minutes | Model calls had no timeout | 60s timeout per call, plus deadlines for revisions and agent turns |
| A run failed with "aborted due to timeout", and we couldn't tell where | One slow call sank the whole run, and the trace was lost on failure | One retry for transient failures within a hard run deadline; per-step timings in the trace; failed runs log their trace |
| Production build crashed | The DB client was created at import time, so the build needed secrets | Create the client on first use |
| Quiz results could be faked | The client decided what was correct | Server-side grading against the stored lesson |

## Limits and next steps

- **Identity is per browser.** A random learner ID in local storage; no
  accounts. Clearing storage loses the courses.
- **Interaction is quiz-at-the-end.** Brilliant-style learning interleaves
  small questions with the explanation; the lesson schema could add inline
  checks between concepts.
- **Spaced repetition.** The `attempts` table already records what was
  missed; a scheduler could bring those questions back days later.
- **Evals for the harness itself.** A fixed set of topics run through the
  agent, checking tool sequences, scores and latency, would catch
  regressions when prompts or models change.

## Further reading

- Anthropic, [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents):
  workflows vs agents, the evaluator-optimizer pattern, keeping agents simple.
- deepset, [Harness engineering: how to build reliable AI agents](https://www.deepset.ai/blog/harness-engineering).
- Databricks, [What is an AI agent harness?](https://www.databricks.com/blog/ai-harness)
- Arize, [Harness engineering](https://arize.com/resources/harness-engineering/).

## Designed lessons instead of one template

Every lesson used to have the same shape: a prediction, two or three concept
cards, activities between them, and a quiz at the end. An audit found the
shape was enforced in five places at once: the prompt ("2-3 concepts",
"questions for the final check"), the activity guide ("put a predict at
afterConcept -1 to open the lesson"), the data model (concepts + activities
pinned to concepts + questions), the renderer (concepts, then the quiz), and
grading (the quiz needed every answer, so it lived in one place). Changing
only the prompt would not have helped: the renderer and schema still forced
the order.

The fix was a new lesson model: an ordered list of typed blocks, plus a
teaching approach. The graded questions stay where grading expects them; a
`check` block just places each one inline. Old lessons are converted to
blocks when they're shown, so nothing saved had to change.

What the harness does:

- **Validate pieces, not the whole.** Each block, activity and question is
  checked on its own; a broken one is dropped and references are remapped.
  Only a lesson missing the essentials is retried.
- **Lint, then evaluate.** Code detects structural problems (all checks at
  the end, three explanations in a row, the old template) and gives them to
  the evaluator as facts, so they lower the score and drive the revision.
- **Revise in the writer's own format.** The first version showed the
  reviser the stored lesson and asked for the flat model format back; 2 of 2
  revisions in a sample run lost activities in that translation. Now the
  reviser sees exactly the format it writes. A test checks that every sample
  lesson round-trips unchanged.

Measured on sample modules (science, programming, history, strategy,
philosophy, music) with DeepSeek V4.1 Flash:

| Run | Approaches chosen | Notes |
| --- | --- | --- |
| First prompt | discovery ×3, mystery | Varied openings, but every lesson ended reflect → summary, all had a worked example and 3 checks |
| Approach "moves" added | discovery ×2, mystery, misconception ×2, compare | Openings: experiment, explanation, code prediction, stated misconception, playable chords; endings vary; summaries only where useful |

The programming module reads real code (predict the output, a line-by-line
trace with variable state, a bug to fix); the history module opens on a
puzzle and resolves it; the music module plays chords. Lesson writing takes
about 30-50s, close to before.

## Levels: a hierarchy without a migration

Courses went from a flat list of 3-6 modules to course → levels → modules.
Everything that tracks progress (lessons.module_index, courses.current_module,
grading, the prefetch, URLs) works on a module's position in one ordered
list, so the hierarchy was added as a grouping over that list rather than a
new structure: each module entry carries its level, and the levels are
rebuilt when a course is shown. That kept saved progress valid by
construction, needed no database migration, and left old courses readable as
they were (one path, no invented levels).

The plan is validated in code, not trusted to the prompt: 2-4 levels, 2-4
modules each, 4-12 in total, distinct titles, and levels named for what they
cover ("Level 1" alone is rejected). A failing plan goes back to the agent as
a tool error, the same way other tool misuse does.

Sample plans with DeepSeek V4.1 Flash: "Photosynthesis" → 4 levels (the big
picture, light reactions, the Calvin cycle, real-world limits) of 3, 3, 3 and
2 modules; "Brewing pour-over coffee" → 3 levels of 3 (first reliable cup,
bloom and pouring, dialing in). Planning plus the first module took about 65s,
as before.

## Working answers out, and timeouts that cut off good work

Lessons could already vary their shape, but every interaction was picking
from options. A `problem` block lets the learner compute an answer and type
it; feedback is aimed at the anticipated mistake ("you added 6 + 6, but each
red result pairs with every blue one"). Graded checks also became retryable:
the first answer is graded, later tries are practice, and a wrong answer gets
an alternative explanation instead of the right option.

Measuring the samples exposed a timing problem. Writing a lesson takes 35-70s
and scoring one up to ~60s, but every model call was cut off at 60s and
retried once, also at 60s: a slow but healthy call was thrown away near the
finish and retried from scratch. In one run 3 of 10 generations failed that
way. Lesson writing and scoring now get 90s per call; agent turns keep 60s and
the run's 280s hard deadline still bounds everything. Under five parallel
generations against one provider, a single game theory lesson still needed
over 90s, so provider latency remains the main risk to a run.

Sample lessons (DeepSeek V4.1 Flash), each module 2 of level 1:

| Subject | Approach | Sequence |
| --- | --- | --- |
| Black holes | simulation | explain > simulation > explain > check > worked > explain > diagram > check > problem > reflect |
| Python loops | discovery | predict > code trace > explain > check > worked > check > sort > problem > check > code bug > problem > reflect |
| French Revolution | mystery | chart > explain > explain > check > simulation > explain > problem > explain > check > diagram > check > explain |
| Game theory | discovery | predict > explain > check > explain > scenario > explain > check > sort > check > problem |
| Probability | discovery | predict > explain > worked > check > explain > check > sort > check > problem |

Problems appeared where something can be computed (escape speed, loop
totals, a loaf's share of a day's wage in 1789, payoffs, outcome counts).
"discovery" is still the writer's most common choice.

## Model-written formulas

Graph activities let the writer supply a formula (y in terms of x and a
parameter k) that the browser plots. Two rules kept that safe and useful:

- **Compile, never eval.** `lib/expression.ts` is a tokenizer and a
  recursive-descent parser for numbers, x, k, pi, e, arithmetic and a fixed
  list of functions. Anything else is a syntax error, and the activity is
  dropped.
- **Validate what the learner will see.** The first version picked the
  y-axis automatically. On a real projectile lesson, steep launch angles sent
  the curve 2,600 m below ground, so every sensible arc looked flat. Now the
  writer chooses the viewing window, like a graphing calculator, and
  validation requires the curve to be defined, not flat, and visibly inside
  that window at the slider's minimum, starting value and maximum. Outside
  the window it is clipped.

## Choosing the models

A model reviewing its own lessons can't be used to compare models: each one
grades itself. So each candidate wrote the same sample modules through the
real quality gate, and every lesson was then re-scored by one fixed reviewer
(`scripts/judge-lessons.ts`). Cost is what OpenRouter reported for each call
(`withUsage` in `lib/model.ts`), not list prices.

Black holes, Python loops and the French Revolution; 6 lessons per model,
re-scored by GPT-6 Sol:

| Writer | List price (in / out per 1M) | Cost per lesson | Fixed-reviewer score |
| --- | --- | --- | --- |
| GPT-6.1 Sol | $2.00 / $10.00 | ~$0.06 | 7.9 |
| GPT-6 Sol | $2.00 / $10.00 | ~$0.09 | 7.9 |
| GPT-6 Luna | $0.10 / $0.50 | ~$0.003 | 7.2 |
| Claude Haiku 5.5 | $0.10 / $0.50 | ~$0.013 | 6.7 |
| DeepSeek V4.1 Flash | $0.30 / $1.20 | ~$0.025 | 6.4 |
| GLM 5.3 Flash | $0.15 / $0.50 | ~$0.006 | 5.5 |

List price misleads: DeepSeek writes 16-21k output tokens per lesson (mostly
hidden reasoning) against Luna's 4-8k, so it cost seven times as much per
lesson. GPT-6.1 Sol uses fewer tokens than GPT-6 Sol at the same price.

Then six topics through the new gate (below), each re-checked by DeepSeek as
a reviewer from another model family:

| Writer, reviewer GPT-6.1 Sol | Passed first draft | Gate's score | DeepSeek's score | Cost per lesson incl. review |
| --- | --- | --- | --- | --- |
| GPT-6 Luna | 0 of 6 (1 of 6 after a revision) | 7.2 | 8.0 | ~$0.025 |
| GPT-6.1 Sol | 6 of 6 | 8.3 | 9.0 | ~$0.042 |

The samples are small (3-6 lessons per model), so these are strong hints, not
proof; the eval suite in "Limits and next steps" is what should decide.

## Checking facts in code, and a reviewer that isn't the writer

The model comparison showed self-review passing wrong facts. GLM's lesson
taught "6.75 + 4.75 = 19.00" and its own review scored it 7; DeepSeek's said
11.5 sous of a 25-sous wage was "over half" and passed with 8-9. The author's
literature review on agent harnesses (~/Ajwad/research) points the same way:
a model's check of its own output is noisy and inherits the draft's blind
spots (AutoMix; the "verification gap" in agent test-time scaling); facts the
harness can compute should be computed by the harness, not written or checked
by a model; errors left in context tend to produce more errors
("self-conditioning", Sinha et al.); and what matters must be placed where it
can't be missed, not buried in a list.

What changed in the gate (`lib/lessonWriter.ts`):

- **Arithmetic is checked in code** (`lib/factCheck.ts`): explicit equations
  ("3.50 + 2.00 = 5.50"), running totals (", + 4.75 = 19.00"), fractions
  ("12/90 = 2/15") and shares stated as percentages ("11.5 out of 25 is 46%")
  are recomputed with the safe expression parser. Trap feedback is skipped,
  since it quotes wrong answers on purpose. On 54 sample lessons it found the
  one real error and no false alarms.
- **Fail closed on wrong arithmetic, so false alarms matter.** The first
  version misread correct chains ("0.5 × 0.4 × 0.5 = 0.2 × 0.5 = 0.1",
  "7200 + 300 + 30 = 7530"), integer division ("400 ÷ 60 = 6 remainder 40")
  and formulas whose start it couldn't see, and rejected two good lessons; each
  of those is now a test. Any new pattern should be swept over the saved
  sample lessons before it can reject anything.
- **Wrong arithmetic can't pass.** A version with a computed error can't
  pass, any clean version beats it, and if no version is clean the lesson is
  not shown (the run fails, rather than teach a wrong sum).
- **The reviewer is set on its own** (`REVIEW_MODEL`), and its score is
  bounded 0-10 by the schema. The default is GPT-6.1 Sol for both writing and
  review: it was the best value measured, and the code checks cover the errors
  self-review was seen to miss. Pointing `REVIEW_MODEL` at another family
  gives an independent review for about $0.004 more per lesson (DeepSeek).
- **Verified errors first.** The reviser gets the computed errors one per
  line, ahead of the reviewer's notes.
- **Rewrite rather than patch a bad draft.** Below 5, a fresh lesson is written
  with the problems to avoid, instead of revising inside the flawed draft.
- **Every run says what it cost.** The trace ends with `run.cost` (dollars,
  calls, tokens) as OpenRouter reports it.

## Checking facts against the web

Arithmetic can be computed; dates, names, events and measurements can't. Each
lesson version is checked online (`lib/factVerify.ts`), at the same time as
the review:

1. One call lists up to 8 checkable claims, most at risk first, as standalone
   sentences. Text that is wrong on purpose is never sent: wrong answer
   options, trap feedback, stated misconceptions. Code is excluded too: it is
   checked by what it does.
2. Each claim gets its own web-search call (OpenRouter's web plugin, Exa by
   default), which returns supported / contradicted / unclear, the URL relied
   on and a sentence quoted from it.
3. **The harness decides which verdicts count.** A verdict citing a page the
   search didn't return, or quoting evidence that isn't on the page, becomes
   "unclear". This is provenance computed in code rather than asserted by the
   model, the rule the author's research supports (see "Checking facts in
   code" above).

Contradicted claims join the arithmetic errors: the reviser gets them first,
with the source and the correct fact, and a version that still has one is
never shown. Unconfirmed claims are passed on to be stated more carefully
("about", "historians estimate") or removed, but don't block a lesson on
their own. If the claims can't be listed at all (search provider down), the
lesson is judged on the other checks and the trace records `verify_failed`.

The writing guide now asks for this up front: precise figures only when
certain, no invented quotations or statistics, disputed views attributed,
made-up examples clearly marked, and sums written out in full.

Limits: search can't settle contested interpretations, and it inherits
mistakes from bad pages, so the judge is told to prefer encyclopedias,
universities and official bodies. Not yet measured live (the OpenRouter key
was out of credit when this was built): cost per lesson, time added, and how
often real errors are caught versus false contradictions.
