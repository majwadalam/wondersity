-- How far learners get inside a lesson. The lesson player adds a row each time
-- a learner reaches a step further than before (step 0 is opening the lesson),
-- so a lesson's furthest step shows where people stop, and the days with rows
-- show who comes back. Completions and answers are already in lessons and
-- attempts; supabase/queries/metrics.sql puts them together.

create table if not exists public.lesson_views (
  id bigint generated always as identity primary key,
  learner_id text not null,
  lesson_id bigint not null references public.lessons (id) on delete cascade,
  step integer not null check (step >= 0),
  step_count integer not null check (step_count > 0),
  created_at timestamptz not null default now()
);

create index if not exists lesson_views_lesson_idx on public.lesson_views (lesson_id);
create index if not exists lesson_views_learner_idx on public.lesson_views (learner_id, created_at);

alter table public.lesson_views enable row level security;
grant select, insert, delete on public.lesson_views to authenticated;
grant usage, select on all sequences in schema public to authenticated;

drop policy if exists "own rows" on public.lesson_views;
create policy "own rows" on public.lesson_views for all to authenticated
  using (learner_id = (select auth.uid())::text) with check (learner_id = (select auth.uid())::text);
