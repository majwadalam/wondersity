-- Roles: who may open the admin panel (/admin). A role lives in its own table,
-- not on profiles, because learners write their own profile row and could
-- give themselves one. Learners can read only their own role (so the app can
-- show an admin the "Admin" link); only the server's secret key writes roles:
-- an admin granting one in the panel, or scripts/grant-role.ts for the first.

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('admin')),
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;
grant select on public.user_roles to authenticated;
drop policy if exists "read own role" on public.user_roles;
create policy "read own role" on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()));
