# Weavr

<img src="public/brand/weavr-logo-original.webp" alt="Weavr logo" width="200" />

An agentic tutor, in the spirit of Brilliant. Name any topic and a tutor
agent plans a course in levels of short modules, writes each 5-10 minute module (checked by a
separate evaluator before you see it), grades your quizzes, and picks up where
you left off when you come back.

- [AGENTS.md](AGENTS.md): architecture and rules
- [HARNESS.md](HARNESS.md): harness engineering notes and design decisions

## Run locally

Requires Node.js 20+.

```bash
pnpm install
cp .env.example .env.local   # then fill in the values
pnpm dev
```

**Database:** the migrations in [`supabase/migrations/`](supabase/migrations/)
are applied with the Supabase CLI (run through `npx`, no install needed):

```bash
pnpm db:link    # once per machine: link this repo to the Supabase project
pnpm db:push    # apply any new migrations
pnpm db:status  # which migrations are applied
pnpm db:types   # regenerate src/lib/database.types.ts from the live schema
pnpm db:new name  # start a new migration file
```

Open http://localhost:3000.

| Variable | Purpose |
| --- | --- |
| `OPENROUTER_API_KEY` | Model calls via OpenRouter |
| `OPENROUTER_MODEL` | Model id (default `deepseek/deepseek-v4.1-flash`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key (`sb_publishable_...`), used by the server |

All four are read only on the server; none reach the browser.

Before deploying, check that it builds and lints:

```bash
pnpm lint
pnpm build
```

## Deploy (Vercel)

1. Push the repo to GitHub and import it in Vercel.
2. Add the four environment variables above under
   **Project → Settings → Environment Variables**.
3. Deploy. `/api/learn` declares `maxDuration = 300` because one lesson can
   take several model calls; this fits Vercel's default function limit.

### Production checklist

- **Rate limiting.** The API routes include a per-IP limiter (6 lessons per
  10 minutes; 60 library reads per minute), but it is in-memory, so each
  serverless instance counts separately. For a public deployment, also add a
  rate-limit rule in Vercel Firewall for `/api/learn`, and set a spending limit
  on your OpenRouter key.
- **Supabase access.** The server uses the publishable key (the `anon` role).
  The migrations turn on Row Level Security for every table, with policies for
  what the app does. Anyone with the key can still read every learner's rows;
  see "No accounts" below.
- **No accounts.** Learners are identified by a random 128-bit ID stored in
  the browser. It is unguessable, but anyone who has a learner's ID can read
  that learner's lessons, and clearing browser storage loses the library.
  Add real authentication before storing anything sensitive.
