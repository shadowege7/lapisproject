-- A user's "main" / home store, useful when they have access to every store.
alter table public.profiles
  add column main_dealership_id uuid references public.dealerships (id) on delete set null;
