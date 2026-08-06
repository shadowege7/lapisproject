"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { monthStartISODate } from "@/lib/format";

/**
 * Sets a store's unit goal for a month.
 *
 * Written with the caller's own client, not the admin one, so the
 * `store_budgets_write` policy decides whether it is allowed. Someone without
 * the permission never sees the form, but that is presentation — this is where
 * it actually holds.
 */
export async function saveBudget(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dealershipId = String(formData.get("dealership_id") ?? "");
  // Only ever the current month: the form is for setting this month's goal,
  // and accepting an arbitrary month from a form field would let a stray value
  // rewrite a past month's target.
  const month = monthStartISODate();

  const count = (name: string) => {
    const value = Math.trunc(Number(formData.get(name) ?? 0));
    return Number.isFinite(value) && value > 0 ? value : 0;
  };

  const { error } = await supabase.from("store_budgets").upsert(
    {
      dealership_id: dealershipId,
      month,
      new_units: count("new_units"),
      used_units: count("used_units"),
      sprinter_units: count("sprinter_units"),
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    },
    { onConflict: "dealership_id,month" },
  );

  if (error) {
    redirect(
      `/dealerships/${dealershipId}?budget_error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath(`/dealerships/${dealershipId}`);
  revalidatePath("/dashboard");
  redirect(`/dealerships/${dealershipId}?budget=saved`);
}
