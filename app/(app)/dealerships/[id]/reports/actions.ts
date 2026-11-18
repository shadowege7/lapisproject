"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Delete a daily entry. Super-admin only (also enforced by RLS). */
export async function deleteEntry(formData: FormData) {
  const entryId = String(formData.get("entry_id") ?? "");
  const dealershipId = String(formData.get("dealership_id") ?? "");
  if (!entryId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_super_admin) return;

  await supabase.from("daily_entries").delete().eq("id", entryId);

  if (dealershipId) {
    revalidatePath(`/dealerships/${dealershipId}/reports`);
  }
  revalidatePath("/dashboard");
}
