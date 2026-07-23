-- Separate front-end and back-end gross by vehicle type (new vs used).
-- Replaces the two combined columns (front_end_gross, back_end_gross) with
-- four: {new,used} x {front,back}. The rollup views keep the old combined
-- totals (total_front_end_gross, total_back_end_gross, total_gross) and add
-- per-type breakdowns.

-- Views depend on the old columns, so drop them first.
drop view if exists public.monthly_summary;
drop view if exists public.annual_summary;

alter table public.daily_entries
  add column new_front_end_gross  numeric(12, 2) not null default 0,
  add column new_back_end_gross   numeric(12, 2) not null default 0,
  add column used_front_end_gross numeric(12, 2) not null default 0,
  add column used_back_end_gross  numeric(12, 2) not null default 0;

-- Preserve any existing data: fold the old combined figures into the "new"
-- buckets so no dollars are lost (there is no basis to split them by type).
update public.daily_entries
  set new_front_end_gross = front_end_gross,
      new_back_end_gross  = back_end_gross;

alter table public.daily_entries
  drop column front_end_gross,
  drop column back_end_gross;

create view public.monthly_summary
with (security_invoker = on) as
select
  dealership_id,
  date_trunc('month', entry_date)::date as month,
  sum(new_units) as total_new_units,
  sum(used_units) as total_used_units,
  sum(new_front_end_gross) as total_new_front_end_gross,
  sum(new_back_end_gross) as total_new_back_end_gross,
  sum(used_front_end_gross) as total_used_front_end_gross,
  sum(used_back_end_gross) as total_used_back_end_gross,
  sum(new_front_end_gross + used_front_end_gross) as total_front_end_gross,
  sum(new_back_end_gross + used_back_end_gross) as total_back_end_gross,
  sum(new_front_end_gross + new_back_end_gross
      + used_front_end_gross + used_back_end_gross) as total_gross,
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
  sum(new_front_end_gross) as total_new_front_end_gross,
  sum(new_back_end_gross) as total_new_back_end_gross,
  sum(used_front_end_gross) as total_used_front_end_gross,
  sum(used_back_end_gross) as total_used_back_end_gross,
  sum(new_front_end_gross + used_front_end_gross) as total_front_end_gross,
  sum(new_back_end_gross + used_back_end_gross) as total_back_end_gross,
  sum(new_front_end_gross + new_back_end_gross
      + used_front_end_gross + used_back_end_gross) as total_gross,
  count(*) as days_logged
from public.daily_entries
group by dealership_id, date_trunc('year', entry_date);
