-- Small things a full product has (CHANGES.md, 2026-10-13):
--
-- 1. courses.voices: the course's cast, so every character keeps one voice
--    across lessons and different characters sound different. A map from a
--    character's name (lower case) to { name, voice, manner?, portrait?, chosen? };
--    `chosen` marks a voice the learner picked on the course page.
-- 2. courses.archived_at: the learner tidied the course away (still opens).
-- 3. lesson_ratings: a thumbs up or down (and an optional word) on a finished lesson.
-- 4. review_clears: a missed check the learner later got right on the Review page
--    (graded on the server like any check; the original attempt is never changed).
-- 5. bookmarks: starred courses, kept with the account instead of one browser.
-- 6. support_messages: Help and contact. Signed-out messages are written with
--    the server key by /api/support; signed-in learners write and read their own.
-- 7. profiles.last_recap_on and the 'recap' notification: the weekly recap.

alter table public.courses add column if not exists voices jsonb not null default '{}'::jsonb;
alter table public.courses add column if not exists archived_at timestamptz;

create table if not exists public.lesson_ratings (
  learner_id text not null,
  lesson_id bigint not null references public.lessons (id) on delete cascade,
  rating smallint not null check (rating in (-1, 1)),
  comment text check (comment is null or char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (learner_id, lesson_id)
);
create index if not exists lesson_ratings_created_idx on public.lesson_ratings (created_at desc);
alter table public.lesson_ratings enable row level security;
grant select, insert, update on public.lesson_ratings to authenticated;
drop policy if exists "own rows" on public.lesson_ratings;
create policy "own rows" on public.lesson_ratings for all to authenticated
  using (learner_id = (select auth.uid())::text) with check (learner_id = (select auth.uid())::text);

create table if not exists public.review_clears (
  learner_id text not null,
  lesson_id bigint not null references public.lessons (id) on delete cascade,
  question_index int not null check (question_index >= 0),
  cleared_at timestamptz not null default now(),
  primary key (learner_id, lesson_id, question_index)
);
alter table public.review_clears enable row level security;
grant select, insert on public.review_clears to authenticated;
drop policy if exists "own rows" on public.review_clears;
create policy "own rows" on public.review_clears for all to authenticated
  using (learner_id = (select auth.uid())::text) with check (learner_id = (select auth.uid())::text);

create table if not exists public.bookmarks (
  learner_id text not null,
  topic_key text not null check (char_length(topic_key) <= 200),
  topic text not null check (char_length(topic) <= 200),
  created_at timestamptz not null default now(),
  primary key (learner_id, topic_key)
);
alter table public.bookmarks enable row level security;
grant select, insert, delete on public.bookmarks to authenticated;
drop policy if exists "own rows" on public.bookmarks;
create policy "own rows" on public.bookmarks for all to authenticated
  using (learner_id = (select auth.uid())::text) with check (learner_id = (select auth.uid())::text);

create table if not exists public.support_messages (
  id bigint generated always as identity primary key,
  learner_id text,
  email text check (email is null or char_length(email) <= 200),
  kind text not null check (kind in ('question', 'problem', 'idea', 'billing', 'other')),
  message text not null check (char_length(message) between 1 and 4000),
  page text check (page is null or char_length(page) <= 300),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists support_messages_created_idx on public.support_messages (created_at desc);
alter table public.support_messages enable row level security;
grant select, insert on public.support_messages to authenticated;
drop policy if exists "own rows" on public.support_messages;
create policy "own rows" on public.support_messages for all to authenticated
  using (learner_id = (select auth.uid())::text) with check (learner_id = (select auth.uid())::text);

alter table public.profiles add column if not exists last_recap_on date;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('lesson_ready', 'streak', 'certificate', 'reminder', 'recap'));
