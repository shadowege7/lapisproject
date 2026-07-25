-- Employee positions/titles, manageable from the Admin page.
create table public.positions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.positions enable row level security;

-- Any signed-in user can read positions (to populate dropdowns); only super
-- admins can add/edit/remove them.
create policy "positions_select" on public.positions
  for select using (auth.uid() is not null);

create policy "positions_admin_write" on public.positions
  for all using (public.is_super_admin())
  with check (public.is_super_admin());

insert into public.positions (name, sort_order) values
  ('Owner', 1),
  ('General Manager', 2),
  ('Sales Manager', 3),
  ('Finance Manager', 4),
  ('COO', 5);

-- A user's position (job title). Kept if the position is later deleted.
alter table public.profiles
  add column position_id uuid references public.positions (id) on delete set null;
