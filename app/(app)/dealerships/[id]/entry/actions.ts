"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, todayISODate } from "@/lib/format";
import { notifyStoreEntry } from "@/lib/push";

export async function saveEntry(formData: FormData) {
  const dealershipId = String(formData.get("dealership_id") ?? "");
  const entryDate = String(formData.get("entry_date") ?? "");
  const newUnits = Number(formData.get("new_units") ?? 0);
  const usedUnits = Number(formData.get("used_units") ?? 0);
  const newFrontEndGross = Number(formData.get("new_front_end_gross") ?? 0);
  const newBackEndGross = Number(formData.get("new_back_end_gross") ?? 0);
  const usedFrontEndGross = Number(formData.get("used_front_end_gross") ?? 0);
  const usedBackEndGross = Number(formData.get("used_back_end_gross") ?? 0);
  // Absent for every store that does not sell Sprinters, where the fieldset is
  // never rendered — which reads as zero, and zero is right.
  const sprinterUnits = Number(formData.get("sprinter_units") ?? 0);
  const sprinterFrontEndGross = Number(
    formData.get("sprinter_front_end_gross") ?? 0,
  );
  const sprinterBackEndGross = Number(
    formData.get("sprinter_back_end_gross") ?? 0,
  );
  const managerCalls = Number(formData.get("manager_calls") ?? 0);
  const salesCalls = Number(formData.get("sales_calls") ?? 0);
  const appointments = Number(formData.get("appointments") ?? 0);
  const confirmedAppointments = Number(
    formData.get("confirmed_appointments") ?? 0,
  );
  const notes = String(formData.get("notes") ?? "").trim();

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
      sprinter_units: sprinterUnits,
      sprinter_front_end_gross: sprinterFrontEndGross,
      sprinter_back_end_gross: sprinterBackEndGross,
      manager_calls: managerCalls,
      sales_calls: salesCalls,
      appointments: appointments,
      confirmed_appointments: confirmedAppointments,
      notes: notes.length ? notes : null,
      created_by: user.id,
    },
    { onConflict: "dealership_id,entry_date" },
  );

  if (error) {
    redirect(
      `/dealerships/${dealershipId}/entry?date=${entryDate}&error=${encodeURIComponent(error.message)}`,
    );
  }

  const { data: dealership } = await supabase
    .from("dealerships")
    .select("name, tracks_sprinters")
    .eq("id", dealershipId)
    .single();

  const totalGross =
    newFrontEndGross +
    newBackEndGross +
    usedFrontEndGross +
    usedBackEndGross +
    sprinterFrontEndGross +
    sprinterBackEndGross;
  const when =
    entryDate === todayISODate()
      ? "Today's numbers are in"
      : `Numbers updated for ${entryDate}`;

  // Mentioned wherever the store tracks them, including at zero — that is a
  // real fact about the day for a Sprinter store. Stores that never sell one
  // keep the shorter notification.
  const counts = [
    `${newUnits} new`,
    `${usedUnits} used`,
    ...(dealership?.tracks_sprinters ? [`${sprinterUnits} Sprinter`] : []),
  ].join(" · ");

  await notifyStoreEntry({
    dealershipId,
    title: dealership?.name ?? "Store update",
    body: `${when}: ${counts} · ${formatCurrency(totalGross)} gross`,
    excludeUserId: user.id,
  });

  revalidatePath(`/dealerships/${dealershipId}/reports`);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
