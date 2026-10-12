-- 1. course_plans: a course plan per topic, shared across learners, so a topic
--    is planned (and its world painted) once. Only plans made for learners with
--    no other courses are cached, since others' plans are tailored to their
--    history. Written only by the server with its secret key, so no learner
--    can plant a plan that others would get; anyone signed in can read it.
--    planner_version lets a change to the planning guide retire old plans.
--
-- 2. runs: every tutor run, staging and world painting, with its trace, how
--    long it took and what its model calls cost (OpenRouter's usage.cost), so
--    cost per lesson and per learner is measured, not estimated.

create table if not exists public.course_plans (
  topic_key text primary key,
  topic text not null,
  title text not null,
  description text not null,
  modules jsonb not null,
  cover_url text,
  planner_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.course_plans enable row level security;
grant select on public.course_plans to authenticated;
drop policy if exists "read plans" on public.course_plans;
create policy "read plans" on public.course_plans for select to authenticated using (true);

create table if not exists public.runs (
  id bigint generated always as identity primary key,
  learner_id text not null,
  kind text not null check (kind in ('learn', 'stage', 'cover')),
  topic text,
  lesson_id bigint references public.lessons (id) on delete set null,
  outcome text,
  ok boolean not null,
  error text,
  ms integer not null,
  cost_usd numeric(10, 5) not null default 0,
  calls integer not null default 0,
  tokens_in integer not null default 0,
  tokens_out integer not null default 0,
  trace jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists runs_learner_idx on public.runs (learner_id, created_at);
create index if not exists runs_created_idx on public.runs (created_at);

alter table public.runs enable row level security;
grant select, insert on public.runs to authenticated;
grant usage, select on all sequences in schema public to authenticated;
drop policy if exists "own rows" on public.runs;
create policy "own rows" on public.runs for all to authenticated
  using (learner_id = (select auth.uid())::text) with check (learner_id = (select auth.uid())::text);
