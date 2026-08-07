import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { greetingName } from "@/lib/names";
import type { DealershipRole } from "@/lib/database.types";

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string | null;
  /** What to call them: their preferred name, else their first. */
  greetingName: string | null;
  isSuperAdmin: boolean;
  /** May set monthly unit budgets. Super admins always may. */
  canEditBudgets: boolean;
  /** Still on the temporary password an admin issued them. */
  mustChangePassword: boolean;
  /** False once an admin has deactivated them. */
  isActive: boolean;
}

/**
 * Wrapped in React's `cache` so the several `require*` calls in one render (the
 * layout, then the page) share a single `auth.getUser()` round trip and one
 * profile read rather than repeating both.
 */
export const getCurrentUser = cache(
  async (): Promise<CurrentUser | null> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "full_name, first_name, preferred_name, is_super_admin, can_edit_budgets, must_change_password, is_active",
      )
      .eq("id", user.id)
      .single();

    const isSuperAdmin = profile?.is_super_admin ?? false;

    return {
      id: user.id,
      email: user.email ?? "",
      fullName: profile?.full_name ?? null,
      greetingName: profile ? greetingName(profile) : null,
      isSuperAdmin,
      // Mirrors public.can_edit_budgets() in the database, which is what
      // actually enforces this — the flag here only decides what to show.
      canEditBudgets: isSuperAdmin || (profile?.can_edit_budgets ?? false),
      mustChangePassword: profile?.must_change_password ?? false,
      isActive: profile?.is_active ?? true,
    };
  },
);

/**
 * The signed-in user, sent to /set-password first if they are still on a
 * temporary one.
 *
 * The gate lives here rather than in proxy.ts because the flag is on the
 * profile row, and the proxy only holds the session — checking it there would
 * mean a database round trip on every request, including every static asset.
 * Every page in the (app) group goes through this.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // A deactivated account is turned away here, the same as on the Launchpad.
  // The database backs this up: 0021 made is_super_admin(), can_edit_budgets()
  // and dealership_role() all return nothing for an inactive user, so even a
  // still-valid token gets no rows.
  if (!user.isActive) {
    redirect("/login?error=Your+account+has+been+disabled");
  }
  if (user.mustChangePassword) redirect("/set-password");
  return user;
}

/** Resolves the caller's effective role for one dealership (super admins are always editors). */
export function effectiveRole(
  user: CurrentUser,
  memberRole: DealershipRole | undefined,
): DealershipRole | null {
  if (user.isSuperAdmin) return "editor";
  return memberRole ?? null;
}
