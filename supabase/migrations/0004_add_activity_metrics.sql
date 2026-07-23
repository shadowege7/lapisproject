-- Daily activity metrics captured alongside the sales numbers. Dealership-level
-- (not split by new/used). Non-negative integers, default 0.
alter table public.daily_entries
  add column manager_calls          integer not null default 0,
  add column sales_calls            integer not null default 0,
  add column appointments           integer not null default 0,
  add column confirmed_appointments integer not null default 0,
  add constraint manager_calls_non_negative check (manager_calls >= 0),
  add constraint sales_calls_non_negative check (sales_calls >= 0),
  add constraint appointments_non_negative check (appointments >= 0),
  add constraint confirmed_appointments_non_negative
    check (confirmed_appointments >= 0);
