-- Admin-controlled per-user notification opt-in.
alter table public.profiles
  add column notifications_enabled boolean not null default false;

-- Web Push device subscriptions (one row per user/device/browser).
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- A user manages only their own subscriptions. The server sends via the
-- service-role key, which bypasses RLS, so no broader read policy is needed.
create policy "push_subscriptions_select_own" on public.push_subscriptions
  for select using (user_id = auth.uid());

create policy "push_subscriptions_insert_own" on public.push_subscriptions
  for insert with check (user_id = auth.uid());

create policy "push_subscriptions_delete_own" on public.push_subscriptions
  for delete using (user_id = auth.uid());
