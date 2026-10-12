# Research

Every AI model experiment run for Wondersity: what was tested, how, what it
cost, what it showed, and what was decided. The product's current choices
(see AGENTS.md and HARNESS.md) come from these runs.

- [model-runs.md](model-runs.md): every run in order, with method, results,
  costs and the decision it led to. Start here.
- [runs/](runs/): the raw outputs of each run: the lessons as JSON (with each
  lesson's trace: scores, revisions, fact checks, timings), the console logs,
  and the reviewer scores (`judge-*.tsv`: file, score, cost, the reviewer's
  first problems).

| Folder | Run |
| --- | --- |
| `runs/00-haiku-vs-deepseek` | Claude Haiku 5.5 vs DeepSeek V4.1 Flash, one lesson |
| `runs/01-four-writers` | 4 writers × 3 lessons, re-scored by two fixed reviewers |
| `runs/02-six-writers-first-try` | 6 writers × 3 lessons, cost measured from the key's balance (unreliable) |
| `runs/03-six-writers-exact-cost` | 6 writers × 3 lessons with exact per-lesson cost |
| `runs/04-luna-with-sol-reviewer` | GPT-6 Luna writes, GPT-6.1 Sol reviews, 6 lessons |
| `runs/05-sol-writes-and-reviews` | GPT-6.1 Sol writes and reviews, 6 lessons |
| `runs/06-opus-writer` | Claude Opus 5.5 writes, 10 lessons (ran out of credit) |
| `runs/07-current-gate` | The current gate live, with the online fact check, 10 lessons in parallel |
| `runs/08-gate-after-fixes` | Same, after capping output tokens and relaxing the evidence rule (still in parallel) |
| `runs/09-gate-one-at-a-time` | Same 10 topics one at a time, after the second round of fixes |
| `runs/10-end-to-end` | A real course through the app's HTTP API: two learners, shared plan and lesson 1 |

## Reproducing a run

    # Write the sample lessons with a given writer (all topics, or a filter like "niche")
    OPENROUTER_MODEL=openai/gpt-6.1-sol node --env-file=.env.local --import tsx scripts/sample-lessons.ts research/runs/<name> [filter]

    # A real course through the running app (needs `pnpm dev` and SUPABASE_SECRET_KEY)
    node --env-file=.env.local --import tsx scripts/e2e-course.ts research/runs/<name> "Stoicism" "stoic philosophy"

    # Re-score saved lessons with one fixed reviewer
    REVIEW_MODEL=openai/gpt-6-sol node --env-file=.env.local --import tsx scripts/judge-lessons.ts research/runs/<name>/*.json

Each lesson's printed line includes its time, score and real cost (OpenRouter's
`usage.cost`). Lessons depend on the model's randomness, so a rerun gives
different lessons and somewhat different scores.

## How to read the scores

- **Self-review scores** (the gate's own score) come from the same model that
  wrote the lesson in the early runs, so they flatter the writer. Compare
  writers only by **fixed-reviewer** scores: one model re-scoring every
  lesson.
- A reviewer may favour its own family's writing (GPT-6 Sol scoring GPT-6.1
  Sol). Runs 04-05 cross-check with DeepSeek, a different family.
- Samples are small (3-10 lessons per model). Treat differences under about
  half a point as noise.
