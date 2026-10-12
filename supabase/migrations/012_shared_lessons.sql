-- Shared lessons beyond lesson 1. On a shared course plan (course_plans), a
-- learner who hasn't answered any check wrong gets the same lesson as anyone
-- else on that path: there's nothing of theirs to adapt to. So every lesson of
-- a shared plan written for such a learner, once it passes every check, is
-- kept here and reused; learners whose mistakes change the next lesson still
-- get one written for them. lesson_version retires lessons when the lesson
-- guide or models change. Written only by the server (secret key).

create table if not exists public.shared_lessons (
  plan_key text not null references public.course_plans (topic_key) on delete cascade,
  module_index int not null check (module_index >= 0),
  lesson_version text not null,
  lesson jsonb not null,
  score numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (plan_key, module_index, lesson_version)
);

alter table public.shared_lessons enable row level security;
grant select on public.shared_lessons to authenticated;
drop policy if exists "read shared lessons" on public.shared_lessons;
create policy "read shared lessons" on public.shared_lessons for select to authenticated using (true);

-- Lesson 1s cached before this table existed move in (course_plans.first_lesson is no longer read).
insert into public.shared_lessons (plan_key, module_index, lesson_version, lesson, score)
select topic_key, 0, lesson_version, first_lesson, coalesce(first_lesson_score, 0)
from public.course_plans
where first_lesson is not null and lesson_version is not null
on conflict do nothing;
