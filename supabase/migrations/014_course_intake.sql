-- Tailored courses: what the learner said they want, and the materials they added.
--
-- 1. jobs.intake: the learner's brief, carried from POST /api/learn to the run
--    that plans the course (lib/intake.ts). Uploaded text rides along once, and
--    is moved into course_materials when the course is created.
-- 2. courses.intake: the brief without the materials' text (goal, purpose,
--    starting point, things to cover, length, material names). Null for a
--    course planned with "Plan it for me".
-- 3. courses.outcomes: the course's learning outcomes, written by the planner
--    from the learner's goal (backward design); each level serves one.
-- 4. course_materials: the learner's notes and files, in chunks with their
--    embeddings, so each lesson is written from the passages it needs. Private
--    to the learner; deleted with the course.

alter table public.jobs add column if not exists intake jsonb;
alter table public.courses add column if not exists intake jsonb;
alter table public.courses add column if not exists outcomes jsonb;

create table if not exists public.course_materials (
  id bigint generated always as identity primary key,
  learner_id text not null,
  course_id bigint not null references public.courses (id) on delete cascade,
  source text not null,
  chunk_index int not null,
  content text not null,
  embedding extensions.vector(1536),
  created_at timestamptz not null default now()
);

create index if not exists course_materials_course_idx on public.course_materials (course_id, chunk_index);

alter table public.course_materials enable row level security;
grant select, insert, delete on public.course_materials to authenticated;
drop policy if exists "own rows" on public.course_materials;
create policy "own rows" on public.course_materials for all to authenticated
  using (learner_id = (select auth.uid())::text) with check (learner_id = (select auth.uid())::text);

-- The passages of a course's materials closest to a query (a module's title and
-- goal). security invoker: the row rules above still apply.
create or replace function public.match_course_materials(course bigint, query text, max_results int default 5)
returns table (source text, chunk_index int, content text, similarity double precision)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select m.source, m.chunk_index, m.content, 1 - (m.embedding <=> query::extensions.vector) as similarity
  from public.course_materials m
  where m.course_id = course and m.embedding is not null
  order by m.embedding <=> query::extensions.vector
  limit greatest(1, least(max_results, 12));
$$;

revoke all on function public.match_course_materials(bigint, text, int) from public, anon;
grant execute on function public.match_course_materials(bigint, text, int) to authenticated;
