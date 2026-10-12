-- Accounts. Every learner is now a Supabase Auth user (email code or Google),
-- and learner_id holds their user id. The server queries as the signed-in
-- user, so these rules keep each learner to their own rows. Before this, the
-- anon role (the public publishable key) could read and change every row.

-- 1. Signed-out requests (the anon role) lose all access to learner data.
--    SELECT stays granted so the health check can reach the tables, but with
--    no anon policy it sees no rows.
drop policy if exists "app read" on public.lessons;
drop policy if exists "app insert" on public.lessons;
drop policy if exists "app update" on public.lessons;
drop policy if exists "app access" on public.progress;
drop policy if exists "app access" on public.courses;
drop policy if exists "app access" on public.attempts;
revoke insert, update, delete on public.lessons, public.progress, public.courses, public.attempts from anon;

-- 2. Signed-in learners: their own rows only.
grant select, insert, update, delete on public.courses, public.lessons, public.attempts, public.progress to authenticated;
grant usage, select on all sequences in schema public to authenticated;

create policy "own rows" on public.courses for all to authenticated
  using (learner_id = (select auth.uid())::text) with check (learner_id = (select auth.uid())::text);
create policy "own rows" on public.lessons for all to authenticated
  using (learner_id = (select auth.uid())::text) with check (learner_id = (select auth.uid())::text);
create policy "own rows" on public.attempts for all to authenticated
  using (learner_id = (select auth.uid())::text) with check (learner_id = (select auth.uid())::text);
create policy "own rows" on public.progress for all to authenticated
  using (learner_id = (select auth.uid())::text) with check (learner_id = (select auth.uid())::text);

-- 3. Profiles: what onboarding and settings save.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  reason text check (char_length(reason) <= 40),
  daily_goal_minutes int not null default 10 check (daily_goal_minutes between 5 and 60),
  voice_on boolean not null default true,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
grant select, insert, update, delete on public.profiles to authenticated;
create policy "own profile" on public.profiles for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- 4. Images and voice clips: uploaded by signed-in learners now.
drop policy if exists "covers upload" on storage.objects;
create policy "covers upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'covers');

-- 5. Moving a learner's progress from before accounts (a browser-made id like
--    "learner-ab12…") into their account. The old id was a secret kept only in
--    that browser, so presenting it is the proof of ownership. A course the
--    account already has for the same topic is left where it was.
create or replace function public.claim_browser_learner(old_id text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  me text := (select auth.uid())::text;
  moved int;
begin
  if me is null or old_id !~ '^learner-[a-z0-9-]{4,64}$' then
    return 0;
  end if;

  update public.courses c set learner_id = me
  where c.learner_id = old_id
    and not exists (select 1 from public.courses x where x.learner_id = me and x.topic_key = c.topic_key);
  get diagnostics moved = row_count;

  update public.lessons l set learner_id = me
  where l.learner_id = old_id
    and (l.course_id is null or exists (select 1 from public.courses c where c.id = l.course_id and c.learner_id = me));

  update public.attempts a set learner_id = me
  where a.learner_id = old_id
    and exists (select 1 from public.lessons l where l.id = a.lesson_id and l.learner_id = me);

  update public.progress p set learner_id = me
  where p.learner_id = old_id
    and not exists (select 1 from public.progress x where x.learner_id = me and x.topic = p.topic);

  return moved;
end;
$$;

revoke all on function public.claim_browser_learner(text) from public, anon;
grant execute on function public.claim_browser_learner(text) to authenticated;
