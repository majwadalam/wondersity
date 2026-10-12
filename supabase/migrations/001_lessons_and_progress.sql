-- Lessons and per-topic progress: the tables the app started with.
-- Run first in Supabase: Dashboard → SQL Editor → paste → Run. Safe to re-run.
-- Then run 002_courses.sql.

-- One generated lesson. Course columns (course_id, module_index, completed_at)
-- are added by 002_courses.sql.
create table if not exists public.lessons (
  id bigint generated always as identity primary key,
  learner_id text not null,
  topic text not null,
  lesson_data jsonb not null,            -- a Lesson (src/lib/lessonBlocks.ts)
  score numeric,                         -- evaluator score, 0-10
  created_at timestamptz not null default now()
);

create index if not exists lessons_learner_idx on public.lessons (learner_id, created_at desc);

-- Where a learner is in each topic.
create table if not exists public.progress (
  id bigint generated always as identity primary key,
  learner_id text not null,
  topic text not null,
  status text not null check (status in ('started', 'completed')),
  last_lesson_id bigint references public.lessons (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (learner_id, topic)
);

-- Row Level Security. The app talks to Supabase only from the server, with the
-- publishable key (the anon role), so these give that role what the app needs:
-- read and add lessons; read, add and update progress.
grant select, insert on public.lessons to anon;
grant select, insert, update on public.progress to anon;

alter table public.lessons enable row level security;
alter table public.progress enable row level security;

drop policy if exists "app read" on public.lessons;
create policy "app read" on public.lessons
  for select to anon using (true);

drop policy if exists "app insert" on public.lessons;
create policy "app insert" on public.lessons
  for insert to anon with check (true);

drop policy if exists "app access" on public.progress;
create policy "app access" on public.progress
  for all to anon using (true) with check (true);
