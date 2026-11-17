"use server";

import { refresh, revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { todayISODate } from "@/lib/format";
import {
  MAX_DEALS,
  MAX_SPAN_DAYS,
  autoMatch,
  collectNames,
  dateSpan,
  eachDay,
  rollupDeals,
  splitName,
  validDeal,
  type Assignment,
  type Deal,
  type RosterName,
} from "@/lib/deal-import";

/**
 * Replacing a store's days from a DMS deal export. The browser reads the file
 * and previews; these two actions look up what is already saved and then do
 * the writing. Both use the signed-in user's own client, so RLS decides who
 * may write — the same rule as typing the numbers in by hand.
 */

export interface ExistingDay {
  new_units: number;
  used_units: number;
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

export interface PreviewResult {
  ok: boolean;
  error?: string;
  tracksSalespeople?: boolean;
  today?: string;
  existing?: Record<string, ExistingDay>;
  roster?: RosterName[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EXISTING_COLUMNS =
  "entry_date, new_units, used_units, sprinter_units, new_front_end_gross, new_back_end_gross, used_front_end_gross, used_back_end_gross, sprinter_front_end_gross, sprinter_back_end_gross, sales_calls, appointments, notes";

function spanError(from: string, to: string): string | null {
  if (to > todayISODate()) {
    return "The file has deals dated after today. Numbers can't be saved for a day that hasn't happened.";
  }
  if (eachDay(from, to).length > MAX_SPAN_DAYS) {
    return `The file covers more than ${MAX_SPAN_DAYS} days. Split it into smaller exports.`;
  }
  return null;
}

async function loadExisting(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dealershipId: string,
  from: string,
  to: string,
) {
  const { data, error } = await supabase
    .from("daily_entries")
    .select(EXISTING_COLUMNS)
    .eq("dealership_id", dealershipId)
    .gte("entry_date", from)
    .lte("entry_date", to);
  const out: Record<string, ExistingDay> = {};
  for (const r of data ?? []) {
    const { entry_date, ...rest } = r as ExistingDay & { entry_date: string };
    out[entry_date] = {
      ...rest,
      new_front_end_gross: Number(rest.new_front_end_gross),
      new_back_end_gross: Number(rest.new_back_end_gross),
      used_front_end_gross: Number(rest.used_front_end_gross),
      used_back_end_gross: Number(rest.used_back_end_gross),
      sprinter_front_end_gross: Number(rest.sprinter_front_end_gross),
      sprinter_back_end_gross: Number(rest.sprinter_back_end_gross),
    };
  }
  return { existing: out, error };
}

/** What is already saved for the file's date span, and who is on the roster. */
export async function previewDealImport(
  dealershipId: string,
  from: string,
  to: string,
): Promise<PreviewResult> {
  if (!UUID.test(dealershipId)) return { ok: false, error: "Unknown store." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
    return { ok: false, error: "The file's dates couldn't be read." };
  }
  const bad = spanError(from, to);
  if (bad) return { ok: false, error: bad };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: store } = await supabase
    .from("dealerships")
    .select("tracks_salespeople, archived_at")
    .eq("id", dealershipId)
    .single();
  if (!store) return { ok: false, error: "Unknown store." };
  if (store.archived_at) return { ok: false, error: "This store is archived." };

  const [{ existing, error }, { data: roster }] = await Promise.all([
    loadExisting(supabase, dealershipId, from, to),
    store.tracks_salespeople
      ? supabase
          .from("salespeople")
          .select("id, first_name, last_name")
          .eq("dealership_id", dealershipId)
          .eq("is_active", true)
      : Promise.resolve({ data: [] as RosterName[] }),
  ]);
  if (error) return { ok: false, error: "Couldn't read this store's saved numbers." };

  return {
    ok: true,
    tracksSalespeople: store.tracks_salespeople,
    today: todayISODate(),
    existing,
    roster: roster ?? [],
  };
}

export interface ApplyResult {
  ok: boolean;
  error?: string;
  daysWritten?: number;
  daysZeroed?: number;
  added?: string[];
  failedDays?: string[];
}

/**
 * Replace the numbers for every day in the file (and, with `zeroMissing`,
 * zero any saved day inside the file's date span that has no deals in it).
 * Sales calls, appointments and notes are carried over from what is saved.
 * For stores tracking salespeople, each day's salesperson rows are replaced
 * too, through the same one-transaction-per-day function the entry form uses.
 */
export async function applyDealImport(
  dealershipId: string,
  rawDeals: unknown[],
  assignments: Record<string, Assignment>,
  zeroMissing: boolean,
): Promise<ApplyResult> {
  if (!UUID.test(dealershipId)) return { ok: false, error: "Unknown store." };
  if (!Array.isArray(rawDeals) || rawDeals.length === 0) {
    return { ok: false, error: "No deals to import." };
  }
  if (rawDeals.length > MAX_DEALS) {
    return { ok: false, error: `Too many deals (max ${MAX_DEALS}).` };
  }
  if (!rawDeals.every(validDeal)) {
    return { ok: false, error: "Some deals in the file couldn't be read. Re-select the file and try again." };
  }
  const deals = rawDeals as Deal[];
  const span = dateSpan(deals)!;
  const bad = spanError(span.from, span.to);
  if (bad) return { ok: false, error: bad };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: store } = await supabase
    .from("dealerships")
    .select("tracks_sprinters, tracks_salespeople, archived_at")
    .eq("id", dealershipId)
    .single();
  if (!store) return { ok: false, error: "Unknown store." };
  if (store.archived_at) return { ok: false, error: "This store is archived." };

  // Sprinter deals only land on stores that keep a Sprinter line. The browser
  // already classifies by the store's setting; this guards a stale tab.
  if (!store.tracks_sprinters && deals.some((d) => d.type === "sprinter")) {
    return { ok: false, error: "This store doesn't track Sprinters. Re-select the file and try again." };
  }

  // ---- Salespeople: resolve every name to a roster id or the house ----------
  const tracking = store.tracks_salespeople;
  const added: string[] = [];
  let resolve: ((key: string) => string | null) | undefined;

  if (tracking) {
    const { data: rosterData } = await supabase
      .from("salespeople")
      .select("id, first_name, last_name")
      .eq("dealership_id", dealershipId)
      .eq("is_active", true);
    const roster: RosterName[] = rosterData ?? [];
    const activeIds = new Set(roster.map((p) => p.id));
    const resolved = new Map<string, string | null>();

    for (const [key, { label }] of collectNames(deals)) {
      const a = assignments?.[key];
      if (a?.kind === "house") {
        resolved.set(key, null);
      } else if (a?.kind === "person" && activeIds.has(a.id)) {
        resolved.set(key, a.id);
      } else if (a?.kind === "add") {
        const { first, last } = splitName(label);
        const same = roster.find(
          (p) =>
            p.first_name.trim().toLowerCase() === first.toLowerCase() &&
            p.last_name.trim().toLowerCase() === last.toLowerCase(),
        );
        if (same) {
          resolved.set(key, same.id);
          continue;
        }
        const { data: row, error } = await supabase
          .from("salespeople")
          .insert({
            dealership_id: dealershipId,
            first_name: first.slice(0, 60),
            last_name: last.slice(0, 60),
            created_by: user.id,
            updated_by: user.id,
          })
          .select("id, first_name, last_name")
          .single();
        if (error || !row) {
          return {
            ok: false,
            error: `Couldn't add ${label} to the roster. Only this store's editors can change it.`,
          };
        }
        roster.push(row);
        activeIds.add(row.id);
        resolved.set(key, row.id);
        added.push(label);
      } else {
        // No choice sent (or a stale one): fall back to the same automatic
        // match the preview showed, else the house.
        resolved.set(key, autoMatch(key, roster));
      }
    }
    resolve = (key) => resolved.get(key) ?? null;
  }

  const { days, people } = rollupDeals(deals, resolve);

  // ---- Which days get written ----------------------------------------------
  const { existing, error: readError } = await loadExisting(
    supabase,
    dealershipId,
    span.from,
    span.to,
  );
  if (readError) return { ok: false, error: "Couldn't read this store's saved numbers." };

  const dates = new Set(days.keys());
  let daysZeroed = 0;
  if (zeroMissing) {
    for (const date of Object.keys(existing)) {
      if (!dates.has(date)) {
        dates.add(date);
        daysZeroed++;
      }
    }
  }

  const entries = [...dates].sort().map((date) => {
    const t = days.get(date);
    const keep = existing[date];
    return {
      dealership_id: dealershipId,
      entry_date: date,
      new_units: t?.new_units ?? 0,
      used_units: t?.used_units ?? 0,
      sprinter_units: t?.sprinter_units ?? 0,
      new_front_end_gross: t?.new_front_end_gross ?? 0,
      new_back_end_gross: t?.new_back_end_gross ?? 0,
      used_front_end_gross: t?.used_front_end_gross ?? 0,
      used_back_end_gross: t?.used_back_end_gross ?? 0,
      sprinter_front_end_gross: t?.sprinter_front_end_gross ?? 0,
      sprinter_back_end_gross: t?.sprinter_back_end_gross ?? 0,
      // Never touched by an import: whatever the store logged stays.
      sales_calls: keep?.sales_calls ?? 0,
      appointments: keep?.appointments ?? 0,
      notes: keep?.notes ?? null,
      created_by: user.id,
    };
  });

  // ---- Write ---------------------------------------------------------------
  const failedDays: string[] = [];
  if (tracking) {
    // One call per day: the function saves the day and replaces its
    // salesperson rows in a single transaction. A handful at a time keeps a
    // month's import quick without flooding the connection pool.
    const queue = [...entries];
    const worker = async () => {
      for (let entry = queue.shift(); entry; entry = queue.shift()) {
        const rows = [...(people.get(entry.entry_date) ?? new Map()).entries()].map(
          ([salesperson_id, p]) => ({ salesperson_id, ...p }),
        );
        const { error } = await supabase.rpc("save_daily_entry_with_salespeople", {
          p_entry: entry,
          p_salespeople: rows,
        });
        if (error) {
          console.error("[deal-import] day save failed", {
            dealershipId,
            date: entry.entry_date,
            message: error.message,
          });
          failedDays.push(entry.entry_date);
        }
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
  } else {
    const { error } = await supabase
      .from("daily_entries")
      .upsert(entries, { onConflict: "dealership_id,entry_date" });
    if (error) {
      console.error("[deal-import] upsert failed", { dealershipId, message: error.message });
      return {
        ok: false,
        error: "Those days could not be saved. Only this store's editors can change its numbers.",
        added,
      };
    }
  }

  revalidatePath(`/dealerships/${dealershipId}/reports`);
  revalidatePath(`/dealerships/${dealershipId}/entry`);
  revalidatePath(`/dealerships/${dealershipId}`);
  revalidatePath("/dashboard");
  refresh();

  if (failedDays.length) {
    failedDays.sort();
    return {
      ok: false,
      error: `${failedDays.length} day${failedDays.length === 1 ? "" : "s"} couldn't be saved (${failedDays.join(", ")}). The rest were updated.`,
      daysWritten: entries.length - failedDays.length,
      daysZeroed,
      added,
      failedDays,
    };
  }
  return { ok: true, daysWritten: entries.length, daysZeroed, added };
}
