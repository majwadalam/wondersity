-- Certificates, notifications and browser push.
--
-- 1. certificates: issued once when a learner completes a course. The id is a
--    random, unguessable string; the public page (/certificate/<id>) is read by
--    the server with its secret key, so certificates can't be listed or
--    searched, only opened by someone given the link. A learner reads their own.
-- 2. notifications: what the bell in the app shows (a lesson ready, a streak
--    milestone, a certificate, a reminder). A learner reads and marks their own.
-- 3. push_subscriptions: a browser's Web Push endpoint, saved when the learner
--    turns browser notifications on.
-- 4. profiles.timezone and profiles.reminders: when "today" ends for the
--    streak, and whether the daily reminder may be sent. last_reminded_on keeps
--    it to one a day.

create table if not exists public.certificates (
  id text primary key check (id ~ '^[A-Za-z0-9]{10,32}$'),
  learner_id text not null,
  course_id bigint not null unique references public.courses (id) on delete cascade,
  learner_name text not null check (char_length(learner_name) between 1 and 80),
  course_title text not null,
  topic text not null,
  levels jsonb not null default '[]'::jsonb,
  lessons int not null,
  minutes int not null,
  accuracy int check (accuracy between 0 and 100),
  completed_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists certificates_learner_idx on public.certificates (learner_id);
alter table public.certificates enable row level security;
grant select, insert on public.certificates to authenticated;
drop policy if exists "own rows" on public.certificates;
create policy "own rows" on public.certificates for all to authenticated
  using (learner_id = (select auth.uid())::text) with check (learner_id = (select auth.uid())::text);

create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  learner_id text not null,
  kind text not null check (kind in ('lesson_ready', 'streak', 'certificate', 'reminder')),
  title text not null check (char_length(title) <= 120),
  body text not null default '' check (char_length(body) <= 300),
  href text check (href is null or href ~ '^/'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_learner_idx on public.notifications (learner_id, created_at desc);
alter table public.notifications enable row level security;
grant select, insert, update, delete on public.notifications to authenticated;
grant usage, select on all sequences in schema public to authenticated;
drop policy if exists "own rows" on public.notifications;
create policy "own rows" on public.notifications for all to authenticated
  using (learner_id = (select auth.uid())::text) with check (learner_id = (select auth.uid())::text);

create table if not exists public.push_subscriptions (
  endpoint text primary key check (endpoint ~ '^https://'),
  learner_id text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_learner_idx on public.push_subscriptions (learner_id);
alter table public.push_subscriptions enable row level security;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
drop policy if exists "own rows" on public.push_subscriptions;
create policy "own rows" on public.push_subscriptions for all to authenticated
  using (learner_id = (select auth.uid())::text) with check (learner_id = (select auth.uid())::text);

alter table public.profiles add column if not exists timezone text check (timezone is null or char_length(timezone) <= 64);
alter table public.profiles add column if not exists reminders boolean not null default true;
alter table public.profiles add column if not exists last_reminded_on date;
