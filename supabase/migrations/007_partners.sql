-- Creator partnerships (see docs/CREATORS.md).
--
-- partners:   a creator (or institution) with a referral code, a revenue share
--             and, optionally, a Paddle discount code for their audience.
-- companions: a public, co-branded course page (/c/<slug>) that goes with one
--             of a partner's videos or episodes and starts a course on it.
-- Who referred a learner is kept on their profile (first referral wins) and on
-- their subscription (from the checkout), so payouts can be worked out.
-- Rows are added by us with SQL or the dashboard; the app only reads them.

create table if not exists public.partners (
  code text primary key check (code ~ '^[a-z0-9][a-z0-9-]{1,30}$'),
  name text not null,
  url text,
  -- Share of a referred subscriber's revenue we pay, and for how long.
  commission_pct int not null default 30 check (commission_pct between 0 and 100),
  commission_months int not null default 12 check (commission_months between 0 and 120),
  -- A Paddle discount code applied at checkout for this partner's audience.
  discount_code text,
  contact_email text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.companions (
  slug text primary key check (slug ~ '^[a-z0-9][a-z0-9-]{1,60}$'),
  partner_code text not null references public.partners (code) on delete cascade,
  topic text not null check (char_length(topic) between 2 and 120),
  title text not null,
  blurb text not null default '',
  video_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.partners enable row level security;
alter table public.companions enable row level security;

-- Anyone may read what a public page shows; terms and contact details stay private.
revoke all on public.partners from anon, authenticated;
grant select (code, name, url, discount_code, active) on public.partners to anon, authenticated;
drop policy if exists "active partners" on public.partners;
create policy "active partners" on public.partners for select to anon, authenticated using (active);

grant select on public.companions to anon, authenticated;
drop policy if exists "active companions" on public.companions;
create policy "active companions" on public.companions for select to anon, authenticated using (active);

alter table public.profiles add column if not exists referred_by text references public.partners (code) on delete set null;
alter table public.profiles add column if not exists referred_at timestamptz;

alter table public.subscriptions add column if not exists referred_by text references public.partners (code) on delete set null;
alter table public.subscriptions add column if not exists started_at timestamptz not null default now();
