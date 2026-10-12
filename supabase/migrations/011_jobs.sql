-- Lesson jobs: the tutor runs on the server as a background job, so a lesson
-- (and its scenes and the course world) is finished even if the browser is
-- closed. The browser only starts a job and watches it; on reload it finds
-- jobs still running. A job that hasn't been touched for 6 minutes is past
-- the route's 5-minute limit and is treated as failed (lib/jobs.ts).

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  learner_id text not null,
  kind text not null check (kind in ('learn', 'ahead')),
  topic text not null,
  topic_key text not null,
  status text not null default 'running' check (status in ('running', 'done', 'failed')),
  -- What the tutor returned (lib/harness.ts TutorResult), once done.
  result jsonb,
  -- A plain message for the learner and a reference to the server log, if failed.
  error text,
  ref text,
  retryable boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jobs_learner_status_idx on public.jobs (learner_id, status, created_at desc);

alter table public.jobs enable row level security;
grant select, insert, update, delete on public.jobs to authenticated;
drop policy if exists "own rows" on public.jobs;
create policy "own rows" on public.jobs for all to authenticated
  using (learner_id = (select auth.uid())::text) with check (learner_id = (select auth.uid())::text);
