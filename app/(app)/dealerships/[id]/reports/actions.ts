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
): Promise<{
  ok: boolean;
  imported: number;
  collapsed?: number;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, imported: 0, error: "Not signed in." };
  if (!dealershipId || rows.length === 0)
    return { ok: false, imported: 0, error: "Nothing to import." };
  if (rows.length > 2000)
    return { ok: false, imported: 0, error: "Too many rows (max 2000)." };

  // Whether this store keeps a Sprinter line. A CSV exported from a Mercedes
  // store carries Sprinter columns; pasted into another store's box those must
  // not create Sprinter units and gross out of nowhere, so they are zeroed for
  // any store that does not track them.
  const { data: store } = await supabase
    .from("dealerships")
    .select("tracks_sprinters")
    .eq("id", dealershipId)
    .single();
  const tracksSprinters = store?.tracks_sprinters ?? false;

  // One (store, date) can appear only once in an upsert, or Postgres rejects
  // the whole statement with "ON CONFLICT DO UPDATE command cannot affect row
  // a second time" — one repeated date otherwise loses every good row with it.
  // Last occurrence wins, matching how a person reads a spreadsheet top-down.
  const byDate = new Map<string, ImportRow>();
  for (const r of rows) byDate.set(r.entry_date, r);
  const deduped = [...byDate.values()];
  const collapsed = rows.length - deduped.length;

  const payload = deduped.map((r) => ({
    dealership_id: dealershipId,
    entry_date: r.entry_date,
    new_units: r.new_units,
    used_units: r.used_units,
    sprinter_units: tracksSprinters ? r.sprinter_units : 0,
    new_front_end_gross: r.new_front_end_gross,
    new_back_end_gross: r.new_back_end_gross,
    used_front_end_gross: r.used_front_end_gross,
    used_back_end_gross: r.used_back_end_gross,
    sprinter_front_end_gross: tracksSprinters ? r.sprinter_front_end_gross : 0,
    sprinter_back_end_gross: tracksSprinters ? r.sprinter_back_end_gross : 0,
    sales_calls: r.sales_calls,
    appointments: r.appointments,
    notes: r.notes && r.notes.length ? r.notes : null,
    created_by: user.id,
  }));

  const { error, count } = await supabase
    .from("daily_entries")
    .upsert(payload, { onConflict: "dealership_id,entry_date", count: "exact" });
  if (error) {
    // Postgres messages here are opaque to a sales manager; keep the detail in
    // the log and hand back something they can act on.
    console.error("[import] daily_entries upsert failed", {
      dealershipId,
      message: error.message,
    });
    return {
      ok: false,
      imported: 0,
      error:
        "Those rows could not be saved. Check the dates are all real dates and the numbers are plain figures.",
    };
  }

  revalidatePath(`/dealerships/${dealershipId}/reports`);
  revalidatePath("/dashboard");
  return { ok: true, imported: count ?? payload.length, collapsed };
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
