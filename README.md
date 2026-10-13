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

## Deploy with Docker (Coolify)

The `Dockerfile` builds a small production image from Next.js's standalone
output. Run it as one long-lived container: lessons are background jobs
inside the server process (`lib/jobs.ts`), so a serverless host that stops
after each response would cut them off.

In Coolify:

1. New resource → your Git repository → build pack **Dockerfile**, port **3000**.
2. Environment variables. Tick **Build Variable** for every `NEXT_PUBLIC_*`
   one, because Next.js bakes those into the build:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `NEXT_PUBLIC_SITE_URL` (your domain, for share images)
   - `NEXT_PUBLIC_PADDLE_*` once billing is set up
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (browser notifications)

   The rest are only needed when the container runs:
   - `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `REVIEW_MODEL`
   - `SUPABASE_SECRET_KEY`
   - `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET` once billing is set up
   - `VAPID_PRIVATE_KEY` (browser notifications) and `CRON_SECRET` (the daily reminder)

   Make the push keys once with `npx web-push generate-vapid-keys`; keep the
   same pair afterwards, or browsers that turned notifications on stop getting them.

   `.env.example` lists them all.
3. Add your domain and deploy. The image's health check loads the landing
   page. `/api/health` also reports the AI provider's credit, so it fails when
   the OpenRouter account is empty, and isn't used to restart the container.
4. In Supabase → Authentication → URL configuration, add the domain to the
   site URL and redirect URLs, so sign-in links and Google sign-in return to it.
5. The daily streak reminder: in Coolify → the resource → Scheduled Tasks, add
   one that runs every hour (`0 * * * *`) with
   `wget -qO- --header="Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/reminders`.
   It sends each learner at most one reminder a day, in their evening.

Database migrations are applied separately, from a developer machine, with
`pnpm db:push`.

Without Coolify:

    docker build -t wondersity \
      --build-arg NEXT_PUBLIC_SUPABASE_URL=... \
      --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=... \
      --build-arg NEXT_PUBLIC_SITE_URL=https://your-domain .
    docker run -p 3000:3000 --env-file .env.production wondersity

### Production checklist

- **OpenRouter credit.** Keys spend the account's balance; a key's limit is
  only a cap. Keep the account well above $1: below that, paintings and voice
  are refused, and lessons fail too when calls can't reserve credit (see
  `research/model-runs.md`, runs 07-11).
- **Rate limiting** is per process and in memory. Fine for one container; put
  a rate limit at the proxy (Coolify/Traefik) for `/api/learn` if you scale out.
- **Accounts and data.** Learners are Supabase Auth users, and row-level
  security keeps each to their own rows (migration 004). The secret key is
  used only on the server, for shared caches, subscriptions and test users.
