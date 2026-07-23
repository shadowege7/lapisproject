-- Deleting a user (from the Admin page) cascades auth.users -> profiles.
-- daily_entries.created_by references profiles, so without an ON DELETE rule
-- the delete would be blocked for anyone who has logged entries. Switch it to
-- SET NULL so the historical sales entries are preserved (author link cleared).

alter table public.daily_entries
  drop constraint daily_entries_created_by_fkey,
  add constraint daily_entries_created_by_fkey
    foreign key (created_by) references public.profiles (id) on delete set null;
