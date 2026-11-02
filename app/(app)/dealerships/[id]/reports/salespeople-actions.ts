"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parsePeriod, parseRank } from "@/lib/salespeople";

/**
 * Roster changes from Dealership Insights. Who may make them is decided by RLS
 * (public.can_edit_salespeople: an active editor of the store, or a super
 * admin, and only while the store has the feature on) — these actions use the
 * signed-in user's own client, so a hand-made POST gets no further than the UI.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function back(
  dealershipId: string,
  formData: FormData,
  outcome: { error?: string; done?: string },
): never {
  const q = new URLSearchParams({ manage: "1" });
  const period = parsePeriod(String(formData.get("sp") ?? ""));
  const rank = parseRank(String(formData.get("rank") ?? ""));
  if (period !== "mtd") q.set("sp", period);
  if (rank !== "units") q.set("rank", rank);
  if (outcome.error) q.set("sp_error", outcome.error);
  if (outcome.done) q.set("sp_done", outcome.done);
  redirect(`/dealerships/${dealershipId}/reports?${q.toString()}#salespeople`);
}

function refresh(dealershipId: string) {
  revalidatePath(`/dealerships/${dealershipId}/reports`);
  revalidatePath(`/dealerships/${dealershipId}/entry`);
}

export async function addSalesperson(formData: FormData) {
  const dealershipId = String(formData.get("dealership_id") ?? "");
  if (!UUID.test(dealershipId)) redirect("/dashboard");

  const first = String(formData.get("first_name") ?? "").trim().replace(/\s+/g, " ");
  const last = String(formData.get("last_name") ?? "").trim().replace(/\s+/g, " ");
  if (!first) back(dealershipId, formData, { error: "Enter a first name." });
  if (first.length > 60 || last.length > 60) {
    back(dealershipId, formData, { error: "Names can be up to 60 characters." });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("salespeople").insert({
    dealership_id: dealershipId,
    first_name: first,
    last_name: last,
    created_by: user.id,
    updated_by: user.id,
  });

  if (error) {
    back(dealershipId, formData, {
      error:
        error.code === "23505"
          ? `${[first, last].join(" ").trim()} is already on the roster.`
          : "Couldn't add them. Only this store's editors can change the roster.",
    });
  }

  refresh(dealershipId);
  back(dealershipId, formData, { done: `Added ${[first, last].join(" ").trim()}.` });
}

/**
 * Remove (soft) or restore a salesperson. Removing keeps every number they
 * logged — month and year totals do not move — and takes them off the entry
 * form. There is deliberately no hard delete.
 */
export async function setSalespersonActive(formData: FormData) {
  const dealershipId = String(formData.get("dealership_id") ?? "");
  const salespersonId = String(formData.get("salesperson_id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!UUID.test(dealershipId)) redirect("/dashboard");
  if (!UUID.test(salespersonId)) back(dealershipId, formData, {});

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // .select() so a write RLS filtered out (no permission) comes back as zero
  // rows rather than as a silent success.
  const { data, error } = await supabase
    .from("salespeople")
    .update({
      is_active: active,
      removed_at: active ? null : new Date().toISOString(),
      updated_by: user.id,
    })
    .eq("id", salespersonId)
    .eq("dealership_id", dealershipId)
    .select("first_name, last_name");

  if (error || !data || data.length === 0) {
    back(dealershipId, formData, {
      error:
        error?.code === "23505"
          ? "Someone with that name is already on the roster."
          : "Couldn't update the roster. Only this store's editors can change it.",
    });
  }

  const name = [data[0].first_name, data[0].last_name].join(" ").trim();
  refresh(dealershipId);
  back(dealershipId, formData, { done: active ? `Restored ${name}.` : `Removed ${name}.` });
}
