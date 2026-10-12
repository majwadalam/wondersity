-- 1. Ask before moving pre-account progress into an account. Signing in used
--    to move it automatically, which put an old course into a brand-new
--    account (and, on a shared computer, could hand one person's progress to
--    another). preview_browser_learner lists what would move, without moving
--    it, for the app to ask first. The old id is a secret kept only in that
--    browser, so knowing it is the proof of ownership, as for claiming.
-- 2. "Delete your data" also removes the learner's run logs (migration 008
--    let learners add and read them, but not delete them).

create or replace function public.preview_browser_learner(old_id text)
returns table (topic text, title text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.topic, c.title
  from public.courses c
  where old_id ~ '^learner-[a-z0-9-]{4,64}$'
    and c.learner_id = old_id
  order by c.updated_at desc
  limit 20;
$$;

revoke all on function public.preview_browser_learner(text) from public, anon;
grant execute on function public.preview_browser_learner(text) to authenticated;

grant delete on public.runs to authenticated;
