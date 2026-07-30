-- Global, app-wide settings (key/value) that apply to every user at once.
-- Readable by any signed-in user (they drive shared UI); only super admins can
-- change them. First use: whether the dashboard "Leaders" section is shown.
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

alter table public.app_settings enable row level security;

-- Any signed-in user can read settings.
create policy "app_settings_select" on public.app_settings
  for select using (auth.uid() is not null);

-- Only super admins can add/change settings.
create policy "app_settings_admin_write" on public.app_settings
  for all using (public.is_super_admin())
  with check (public.is_super_admin());

-- Seed the leaderboard flag (shown by default).
insert into public.app_settings (key, value) values
  ('show_leaderboard', 'true'::jsonb);
