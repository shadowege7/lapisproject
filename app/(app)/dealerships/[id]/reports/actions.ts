"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ImportRow {
  entry_date: string;
  new_units: number;
  used_units: number;
  /** Zero unless the file carried Sprinter columns. */
  sprinter_units: number;
  new_front_end_gross: number;
  new_back_end_gross: number;
  used_front_end_gross: number;
  used_back_end_gross: number;
  sprinter_front_end_gross: number;
  sprinter_back_end_gross: number;
  sales_calls: number;
  appointments: number;
  notes: string | null;
}

/**
 * Bulk-import/backfill daily entries for a store (upsert by date). RLS ensures
 * the caller can only write stores they edit (or as super admin).
 */
export async function importEntries(
  dealershipId: string,
  rows: ImportRow[],
): Promise<{ ok: boolean; imported: number; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, imported: 0, error: "Not signed in." };
  if (!dealershipId || rows.length === 0)
    return { ok: false, imported: 0, error: "Nothing to import." };
  if (rows.length > 2000)
    return { ok: false, imported: 0, error: "Too many rows (max 2000)." };

  const payload = rows.map((r) => ({
    dealership_id: dealershipId,
    entry_date: r.entry_date,
    new_units: r.new_units,
    used_units: r.used_units,
    sprinter_units: r.sprinter_units,
    new_front_end_gross: r.new_front_end_gross,
    new_back_end_gross: r.new_back_end_gross,
    used_front_end_gross: r.used_front_end_gross,
    used_back_end_gross: r.used_back_end_gross,
    sprinter_front_end_gross: r.sprinter_front_end_gross,
    sprinter_back_end_gross: r.sprinter_back_end_gross,
    sales_calls: r.sales_calls,
    appointments: r.appointments,
    notes: r.notes && r.notes.length ? r.notes : null,
    created_by: user.id,
  }));

  const { error, count } = await supabase
    .from("daily_entries")
    .upsert(payload, { onConflict: "dealership_id,entry_date", count: "exact" });
  if (error) return { ok: false, imported: 0, error: error.message };

  revalidatePath(`/dealerships/${dealershipId}/reports`);
  revalidatePath("/dashboard");
  return { ok: true, imported: count ?? payload.length };
}

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
