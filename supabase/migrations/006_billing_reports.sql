-- Paid plans, mistake reports and the age check.
--
-- 1. subscriptions: one row per learner, written only by the Paddle webhook
--    (with the server's secret key), read by the learner it belongs to. Paddle
--    is the merchant of record; this table only mirrors what it reports.
-- 2. lesson_reports: a learner flags something wrong in a lesson.
-- 3. profiles.age_confirmed_at: when the learner confirmed they are 13 or older.

create table if not exists public.subscriptions (
  learner_id text primary key,
  paddle_customer_id text not null,
  paddle_subscription_id text not null unique,
  status text not null check (status in ('active', 'trialing', 'past_due', 'paused', 'canceled')),
  price_id text not null,
  plan text not null check (plan in ('monthly', 'yearly')),
  current_period_end timestamptz,
  canceled_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;
grant select on public.subscriptions to authenticated;
drop policy if exists "own subscription" on public.subscriptions;
create policy "own subscription" on public.subscriptions for select to authenticated
  using (learner_id = (select auth.uid())::text);

create table if not exists public.lesson_reports (
  id bigint generated always as identity primary key,
  learner_id text not null,
  lesson_id bigint not null references public.lessons (id) on delete cascade,
  step integer not null check (step >= 0),
  kind text not null check (kind in ('wrong_fact', 'confusing', 'broken', 'other')),
  message text not null default '' check (char_length(message) <= 1000),
  created_at timestamptz not null default now()
);

create index if not exists lesson_reports_lesson_idx on public.lesson_reports (lesson_id);

alter table public.lesson_reports enable row level security;
grant select, insert on public.lesson_reports to authenticated;
grant usage, select on all sequences in schema public to authenticated;
drop policy if exists "own rows" on public.lesson_reports;
create policy "own rows" on public.lesson_reports for all to authenticated
  using (learner_id = (select auth.uid())::text) with check (learner_id = (select auth.uid())::text);

alter table public.profiles add column if not exists age_confirmed_at timestamptz;
