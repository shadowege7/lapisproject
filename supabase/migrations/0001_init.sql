-- Dealership Sales Tracker: initial schema, views, and RLS policies
-- Run this once in the Supabase project's SQL editor (or via `supabase db push`).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.dealerships (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create type public.dealership_role as enum ('editor', 'viewer');

create table public.dealership_members (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references public.dealerships (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.dealership_role not null,
  created_at timestamptz not null default now(),
  unique (dealership_id, user_id)
);

create table public.daily_entries (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references public.dealerships (id) on delete cascade,
  entry_date date not null,
  new_units integer not null default 0,
  used_units integer not null default 0,
  front_end_gross numeric(12, 2) not null default 0,
  back_end_gross numeric(12, 2) not null default 0,
  created_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  unique (dealership_id, entry_date),
  constraint new_units_non_negative check (new_units >= 0),
  constraint used_units_non_negative check (used_units >= 0)
);

-- ---------------------------------------------------------------------------
-- Auto-create a profile row whenever a new auth user signs up
-- ---------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger daily_entries_set_updated_at
  before update on public.daily_entries
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Helper functions used by RLS policies (security definer avoids recursive
-- RLS lookups on dealership_members / profiles)
-- ---------------------------------------------------------------------------

create function public.is_super_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select is_super_admin from public.profiles where id = auth.uid()), false);
$$;

create function public.dealership_role(target_dealership uuid)
returns public.dealership_role
language sql
security definer
stable
set search_path = public
as $$
  select role from public.dealership_members
  where dealership_id = target_dealership and user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.dealerships enable row level security;
alter table public.dealership_members enable row level security;
alter table public.daily_entries enable row level security;

-- profiles: everyone can read their own row; super admins can read all
create policy "profiles_select" on public.profiles
  for select using (id = auth.uid() or public.is_super_admin());

create policy "profiles_update_self" on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_admin_write" on public.profiles
  for update using (public.is_super_admin())
  with check (public.is_super_admin());

-- dealerships: members (any role) and super admins can read; only super
-- admins can create/edit/delete
create policy "dealerships_select" on public.dealerships
  for select using (
    public.is_super_admin()
    or exists (
      select 1 from public.dealership_members m
      where m.dealership_id = dealerships.id and m.user_id = auth.uid()
    )
  );

create policy "dealerships_insert" on public.dealerships
  for insert with check (public.is_super_admin());

create policy "dealerships_update" on public.dealerships
  for update using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "dealerships_delete" on public.dealerships
  for delete using (public.is_super_admin());

-- dealership_members: a user can see their own membership rows; only super
-- admins can see/manage all memberships (i.e. assign access)
create policy "members_select" on public.dealership_members
  for select using (user_id = auth.uid() or public.is_super_admin());

create policy "members_admin_write" on public.dealership_members
  for all using (public.is_super_admin())
  with check (public.is_super_admin());

-- daily_entries: any member (editor or viewer) of the dealership can read;
-- only editors (or super admins) can write
create policy "entries_select" on public.daily_entries
  for select using (
    public.is_super_admin()
    or public.dealership_role(dealership_id) is not null
  );

create policy "entries_insert" on public.daily_entries
  for insert with check (
    public.is_super_admin() or public.dealership_role(dealership_id) = 'editor'
  );

create policy "entries_update" on public.daily_entries
  for update using (
    public.is_super_admin() or public.dealership_role(dealership_id) = 'editor'
  )
  with check (
    public.is_super_admin() or public.dealership_role(dealership_id) = 'editor'
  );

create policy "entries_delete" on public.daily_entries
  for delete using (
    public.is_super_admin() or public.dealership_role(dealership_id) = 'editor'
  );

-- ---------------------------------------------------------------------------
-- Rollup views. security_invoker makes the view run with the querying
-- user's permissions, so the daily_entries RLS policies above still apply.
-- ---------------------------------------------------------------------------

create view public.monthly_summary
with (security_invoker = on) as
select
  dealership_id,
  date_trunc('month', entry_date)::date as month,
  sum(new_units) as total_new_units,
  sum(used_units) as total_used_units,
  sum(front_end_gross) as total_front_end_gross,
  sum(back_end_gross) as total_back_end_gross,
  sum(front_end_gross + back_end_gross) as total_gross,
  count(*) as days_logged
from public.daily_entries
group by dealership_id, date_trunc('month', entry_date);

create view public.annual_summary
with (security_invoker = on) as
select
  dealership_id,
  date_trunc('year', entry_date)::date as year,
  sum(new_units) as total_new_units,
  sum(used_units) as total_used_units,
  sum(front_end_gross) as total_front_end_gross,
  sum(back_end_gross) as total_back_end_gross,
  sum(front_end_gross + back_end_gross) as total_gross,
  count(*) as days_logged
from public.daily_entries
group by dealership_id, date_trunc('year', entry_date);

-- ---------------------------------------------------------------------------
-- First super admin: after creating your first user via Supabase Auth,
-- run this once (replace the email) to grant them super-admin access.
-- ---------------------------------------------------------------------------

-- update public.profiles set is_super_admin = true
-- where id = (select id from auth.users where email = 'you@example.com');
