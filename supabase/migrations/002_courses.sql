-- Courses, module lessons and quiz attempts.
-- Run after 001_lessons_and_progress.sql: Dashboard → SQL Editor → paste → Run.
-- Safe to re-run.

-- A course is a planned path of 4-6 modules for one learner and topic.
create table if not exists public.courses (
  id bigint generated always as identity primary key,
  learner_id text not null,
  topic text not null,
  topic_key text not null,               -- normalized topic, one course per topic
  title text not null,
  description text not null,
  modules jsonb not null,                -- [{ "title": "...", "goal": "..." }]
  current_module integer not null default 0,
  status text not null default 'active' check (status in ('active', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (learner_id, topic_key)
);

-- Lessons can now belong to a course module and be marked complete.
alter table public.lessons
  add column if not exists course_id bigint references public.courses (id) on delete cascade,
  add column if not exists module_index integer,
  add column if not exists completed_at timestamptz;

create index if not exists lessons_course_module_idx on public.lessons (course_id, module_index);

-- One row per answered quiz question. Graded on the server.
create table if not exists public.attempts (
  id bigint generated always as identity primary key,
  learner_id text not null,
  lesson_id bigint not null references public.lessons (id) on delete cascade,
  question_index integer not null,
  chosen text not null,
  correct boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists attempts_lesson_idx on public.attempts (lesson_id);

-- Row Level Security. The app talks to Supabase only from the server, with the
-- publishable key (the anon role), so these give that role the access the app needs.
grant select, insert, update on public.courses to anon;
grant select, insert on public.attempts to anon;
grant update on public.lessons to anon;

alter table public.courses enable row level security;
alter table public.attempts enable row level security;

drop policy if exists "app access" on public.courses;
create policy "app access" on public.courses
  for all to anon using (true) with check (true);

drop policy if exists "app access" on public.attempts;
create policy "app access" on public.attempts
  for all to anon using (true) with check (true);

-- Marking a lesson complete is an UPDATE on lessons.
drop policy if exists "app update" on public.lessons;
create policy "app update" on public.lessons
  for update to anon using (true) with check (true);
