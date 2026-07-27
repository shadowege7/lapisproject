-- L1 follow-up. Fully revoking EXECUTE from PUBLIC on the RLS helper functions
-- (is_super_admin, dealership_role) BREAKS RLS — policy evaluation requires the
-- querying role to hold EXECUTE (verified) — so those must keep the default
-- PUBLIC grant. Their exposure is low: they only ever reveal the caller's own
-- auth status. The trigger-only functions are invoked by triggers regardless of
-- the caller's EXECUTE, so we take them off the public RPC surface.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.guard_profile_privileged_columns()
  from public, anon, authenticated;
