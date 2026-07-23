import { createClient } from "@/lib/supabase/server";
import type { DealershipRole } from "@/lib/database.types";

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string | null;
  isSuperAdmin: boolean;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, is_super_admin")
    .eq("id", user.id)
    .single();

  return {
    id: user.id,
    email: user.email ?? "",
    fullName: profile?.full_name ?? null,
    isSuperAdmin: profile?.is_super_admin ?? false,
  };
}

/** Resolves the caller's effective role for one dealership (super admins are always editors). */
export function effectiveRole(
  user: CurrentUser,
  memberRole: DealershipRole | undefined,
): DealershipRole | null {
  if (user.isSuperAdmin) return "editor";
  return memberRole ?? null;
}
