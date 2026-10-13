-- profiles.avatar: the avatar the learner picked in Settings, by id
-- (src/lib/avatars.ts; pictures in public/art/avatars/). Null shows their
-- Google photo, else their initial. The API accepts only known ids; the check
-- keeps the column to a short slug either way.
alter table public.profiles add column if not exists avatar text
  check (avatar is null or avatar ~ '^[a-z][a-z0-9-]{0,31}$');
