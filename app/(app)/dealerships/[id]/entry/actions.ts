"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function saveEntry(formData: FormData) {
  const dealershipId = String(formData.get("dealership_id") ?? "");
  const entryDate = String(formData.get("entry_date") ?? "");
  const newUnits = Number(formData.get("new_units") ?? 0);
  const usedUnits = Number(formData.get("used_units") ?? 0);
  const newFrontEndGross = Number(formData.get("new_front_end_gross") ?? 0);
  const newBackEndGross = Number(formData.get("new_back_end_gross") ?? 0);
  const usedFrontEndGross = Number(formData.get("used_front_end_gross") ?? 0);
  const usedBackEndGross = Number(formData.get("used_back_end_gross") ?? 0);
  const managerCalls = Number(formData.get("manager_calls") ?? 0);
  const salesCalls = Number(formData.get("sales_calls") ?? 0);
  const appointments = Number(formData.get("appointments") ?? 0);
  const confirmedAppointments = Number(
    formData.get("confirmed_appointments") ?? 0,
  );

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("daily_entries").upsert(
    {
      dealership_id: dealershipId,
      entry_date: entryDate,
      new_units: newUnits,
      used_units: usedUnits,
      new_front_end_gross: newFrontEndGross,
      new_back_end_gross: newBackEndGross,
      used_front_end_gross: usedFrontEndGross,
      used_back_end_gross: usedBackEndGross,
      manager_calls: managerCalls,
      sales_calls: salesCalls,
      appointments: appointments,
      confirmed_appointments: confirmedAppointments,
      created_by: user.id,
    },
    { onConflict: "dealership_id,entry_date" },
  );

  if (error) {
    redirect(
      `/dealerships/${dealershipId}/entry?date=${entryDate}&error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath(`/dealerships/${dealershipId}/reports`);
  revalidatePath("/dashboard");
  redirect(`/dealerships/${dealershipId}/entry?date=${entryDate}&saved=1`);
}
