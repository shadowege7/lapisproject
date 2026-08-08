"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, todayISODate } from "@/lib/format";
import { notifyStoreEntry } from "@/lib/push";
import { sendDailyReport } from "@/lib/send-daily-report";

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
  const salesCalls = Number(formData.get("sales_calls") ?? 0);
  const appointments = Number(formData.get("appointments") ?? 0);
  const notes = String(formData.get("notes") ?? "").trim();

  // A day cannot be logged before it has happened. The form caps the picker at
  // today, but that is a client control; re-checked here so a crafted post
  // cannot park numbers on a future date. An empty date is rejected too.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate) || entryDate > todayISODate()) {
    redirect(
      `/dealerships/${dealershipId}/entry?error=${encodeURIComponent("Pick a valid date no later than today.")}`,
    );
  }

  // Only numbers entered for today trigger a push and an emailed report.
  // Backfilling or correcting a prior day saves silently — nobody wants a
  // phone buzz or an inbox note for last week's figures.
  const isToday = entryDate === todayISODate();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Asked before the upsert, so the email can say "numbers for" rather than
  // "updated numbers for" on the first save of a day. Afterwards there is no
  // way to tell the two apart.
  const { data: previous } = await supabase
    .from("daily_entries")
    .select("id")
    .eq("dealership_id", dealershipId)
    .eq("entry_date", entryDate)
    .maybeSingle();

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
      sales_calls: salesCalls,
      appointments: appointments,
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

  if (isToday) {
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
      body: `Today's numbers are in: ${counts} · ${formatCurrency(totalGross)} gross`,
      excludeUserId: user.id,
    });

    // The emailed report goes to whoever an admin subscribed to this store.
    // Deliberately awaited rather than left dangling: a serverless function can
    // be frozen the moment its response is sent, and an unawaited send would be
    // killed part-way often enough to look like flaky delivery. It never throws.
    const { data: me } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    await sendDailyReport(dealershipId, {
      entryDate,
      isNew: !previous,
      newUnits,
      newFront: newFrontEndGross,
      newBack: newBackEndGross,
      usedUnits,
      usedFront: usedFrontEndGross,
      usedBack: usedBackEndGross,
      sprinterUnits,
      sprinterFront: sprinterFrontEndGross,
      sprinterBack: sprinterBackEndGross,
      salesCalls,
      appointments,
      notes: notes.length ? notes : null,
      enteredBy: me?.full_name ?? null,
    });
  }

  revalidatePath(`/dealerships/${dealershipId}/reports`);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
