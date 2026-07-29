-- Positions can be granted access to the group-wide dashboard rollup
-- (all-stores totals). Super admins always see it regardless of this flag.
alter table public.positions
  add column can_view_rollup boolean not null default false;
