-- Matching shared plans by meaning, and sharing lesson 1.
--
-- 1. course_plans.embedding: the topic's embedding (openai/text-embedding-3-small,
--    1536 numbers), so "stoic philosophy" can find the plan made for "Stoicism".
--    match_course_plans() returns the closest plans; a model then confirms the
--    match before it's used (lib/planCache.ts).
-- 2. course_plans.first_lesson: lesson 1 of the shared plan, cached once it
--    passed every check, with its scenes and "Go deeper" once staged.
--    lesson_version retires it when the lesson guide or writer model changes.
-- 3. courses.plan_key: the shared plan a course was made from (or seeded), so
--    its lesson 1 and its painted world can be shared with that plan.

create extension if not exists vector with schema extensions;

alter table public.course_plans add column if not exists embedding extensions.vector(1536);
alter table public.course_plans add column if not exists first_lesson jsonb;
alter table public.course_plans add column if not exists first_lesson_score numeric;
alter table public.course_plans add column if not exists lesson_version text;

create index if not exists course_plans_embedding_idx on public.course_plans
  using hnsw (embedding extensions.vector_cosine_ops);

alter table public.courses add column if not exists plan_key text;

create or replace function public.match_course_plans(query text, version text, max_results int default 3)
returns table (topic_key text, topic text, title text, description text, similarity double precision)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select p.topic_key, p.topic, p.title, p.description, 1 - (p.embedding <=> query::extensions.vector) as similarity
  from public.course_plans p
  where p.planner_version = version and p.embedding is not null
  order by p.embedding <=> query::extensions.vector
  limit greatest(1, least(max_results, 10));
$$;

revoke all on function public.match_course_plans(text, text, int) from public, anon;
grant execute on function public.match_course_plans(text, text, int) to authenticated;
