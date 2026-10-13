-- The admin activity log: every change made from the admin panel (editing a
-- course, moving a learner, rewriting or retiring a lesson, granting a role),
-- who made it, and what the thing looked like before and after. Written and
-- read only with the server's secret key, after the admin check; learners
-- can't see it.

create table if not exists public.admin_actions (
  id bigint generated always as identity primary key,
  admin_id uuid references auth.users (id) on delete set null,
  admin_email text,
  action text not null,
  target_type text not null,
  target_id text not null,
  summary text not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_actions_created_idx on public.admin_actions (created_at desc);
create index if not exists admin_actions_target_idx on public.admin_actions (target_type, target_id);

alter table public.admin_actions enable row level security;
