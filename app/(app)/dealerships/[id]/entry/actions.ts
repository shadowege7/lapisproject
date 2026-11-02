"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, todayISODate } from "@/lib/format";
import { notifyStoreEntry } from "@/lib/push";
import { sendDailyReport } from "@/lib/send-daily-report";
import { entryChanged, type EntryValues } from "@/lib/entry-diff";
import { parseSalespersonFields } from "@/lib/salespeople";

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

  // Read up front now (it used to be read only for the notification) because
  // it decides how this day is saved.
  const { data: dealership } = await supabase
    .from("dealerships")
    .select("name, tracks_sprinters, tracks_salespeople")
    .eq("id", dealershipId)
    .single();

  // Salesperson rows go only when the form actually carried the salesperson
  // section. A form loaded before an admin switched the feature on has none,
  // and sending an empty list would wipe rows someone else just entered.
  const salespeople =
    dealership?.tracks_salespeople && formData.get("sp_present") === "1"
      ? parseSalespersonFields(formData, dealership.tracks_sprinters)
      : null;
  if (salespeople && !salespeople.ok) {
    redirect(
      `/dealerships/${dealershipId}/entry?date=${entryDate}&error=${encodeURIComponent(salespeople.error)}`,
    );
  }

  // Asked before the upsert, so the email can say "numbers for" rather than
  // "updated numbers for" on the first save of a day, and so a save that
  // changes nothing can be told from one that does — an identical re-save
  // (double-click, stuck client) must not fire another notification.
  const { data: previous } = await supabase
    .from("daily_entries")
    .select(
      "new_units, used_units, new_front_end_gross, new_back_end_gross, used_front_end_gross, used_back_end_gross, sprinter_units, sprinter_front_end_gross, sprinter_back_end_gross, sales_calls, appointments, notes",
    )
    .eq("dealership_id", dealershipId)
    .eq("entry_date", entryDate)
    .maybeSingle();

  const nextValues: EntryValues = {
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
  };
  const changed = entryChanged(previous as EntryValues | null, nextValues);

  const entry = {
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
  };

  // Stores tracking salespeople save the day and its salesperson rows in one
  // database transaction (0040_salesperson_tracking.sql), so neither half can
  // land without the other. Every other store keeps the plain upsert, exactly
  // as before. The function's column list mirrors `entry` above — a new
  // daily_entries column has to be added to both.
  const { error } = dealership?.tracks_salespeople
    ? await supabase.rpc("save_daily_entry_with_salespeople", {
        p_entry: entry,
        p_salespeople: salespeople?.ok ? salespeople.rows : null,
      })
    : await supabase
        .from("daily_entries")
        .upsert(entry, { onConflict: "dealership_id,entry_date" });

  if (error) {
    redirect(
      `/dealerships/${dealershipId}/entry?date=${entryDate}&error=${encodeURIComponent(error.message)}`,
    );
  }

  // Only when the numbers are for today AND this save changed something. A
  // no-op re-save stays silent, so a resubmit loop can't blast the recipient
  // list — the root of the "23 emails in 2 minutes" report.
  if (isToday && changed) {
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
