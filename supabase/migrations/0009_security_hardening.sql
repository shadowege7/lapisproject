-- Security hardening (from the 2026-07 audit).

-- C1 (critical): block non-super-admins from changing privileged profile
-- columns. RLS's self-update policy checks the row but not the column, and
-- column grants let a user PATCH their own is_super_admin -> full takeover.
-- This trigger enforces it at the row level regardless of how the write comes
-- in. Service-role / postgres (no auth.uid()) stays trusted for admin writes.
create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_super_admin() and (
       new.is_super_admin is distinct from old.is_super_admin
    or new.notifications_enabled is distinct from old.notifications_enabled
    or new.position_id is distinct from old.position_id
    or new.main_dealership_id is distinct from old.main_dealership_id
  ) then
    raise exception 'Not authorized to modify privileged profile fields';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_profile_privileged_columns()
  from anon, authenticated;

drop trigger if exists profiles_guard_privileged on public.profiles;
create trigger profiles_guard_privileged
  before update on public.profiles
  for each row execute function public.guard_profile_privileged_columns();

-- L1: take the SECURITY DEFINER helpers off the public RPC surface. RLS
-- policies still invoke them internally (policy evaluation does not require the
-- caller's EXECUTE grant).
revoke execute on function public.is_super_admin() from anon, authenticated;
revoke execute on function public.dealership_role(uuid) from anon, authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated;

-- L2: pin the trigger function's search_path.
alter function public.set_updated_at() set search_path = public;
