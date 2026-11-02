import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, effectiveRole } from "@/lib/auth";
import { todayISODate } from "@/lib/format";
import { saveEntry } from "./actions";
import { EntrySanityWarnings } from "./sanity-warnings";
import { SaveEntryButton } from "./save-entry-button";
import {
  SalespeopleFieldset,
  type SalespersonRowProps,
} from "./salespeople-fieldset";
import {
  byName,
  salespersonInitials,
  salespersonName,
  type RosterPerson,
} from "@/lib/salespeople";

export default async function EntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string; saved?: string; error?: string }>;
}) {
  const { id: dealershipId } = await params;
  const { date, saved, error } = await searchParams;
  const entryDate = date ?? todayISODate();

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();

  const [
    { data: dealership },
    { data: membership },
    { data: existing },
    { data: savedDates },
  ] = await Promise.all([
    supabase
      .from("dealerships")
      .select("id, name, tracks_sprinters, tracks_salespeople")
      .eq("id", dealershipId)
      .single(),
    supabase
      .from("dealership_members")
      .select("role")
      .eq("dealership_id", dealershipId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("daily_entries")
      .select("*")
      .eq("dealership_id", dealershipId)
      .eq("entry_date", entryDate)
      .maybeSingle(),
    // Every day that already has numbers, so the submit button can warn before
    // overwriting whichever date the picker lands on.
    supabase
      .from("daily_entries")
      .select("entry_date")
      .eq("dealership_id", dealershipId),
  ]);

  const existingDates = (savedDates ?? []).map((r) => r.entry_date);

  if (!dealership) notFound();

  const role = effectiveRole(user, membership?.role);
  if (role !== "editor") {
    redirect(`/dealerships/${dealershipId}/reports`);
  }

  const people = dealership.tracks_salespeople
    ? await loadSalespeopleForDay(dealershipId, entryDate)
    : null;

  return (
    <div
      className={`flex flex-col gap-6 ${people ? "max-w-4xl" : "max-w-xl"}`}
    >
      <div>
        {/* Neutral rather than the accent: this sits on the page background,
            where Chambray reaches only 2.51. The underline carries the "this
            is a link" job that the colour was doing. */}
        <Link
          href="/dashboard"
          className="text-xs font-medium text-zinc-500 underline underline-offset-2 hover:text-zinc-900 dark:hover:text-white"
        >
          ← Back to dashboard
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">
          {dealership.name}
        </h1>
        <p className="text-sm text-zinc-500">
          {existing
            ? entryDate === todayISODate()
              ? "Editing today's entry"
              : `Editing entry for ${entryDate}`
            : "New daily entry"}
        </p>
      </div>

      {saved ? (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          Saved.
        </p>
      ) : null}
      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <form action={saveEntry} className="flex flex-col gap-5">
        <input type="hidden" name="dealership_id" value={dealershipId} />

        {existing ? (
          // Editing an existing day: the date is fixed. Leaving it editable let
          // someone change it to another day that already had numbers and
          // overwrite them on save, silently. To move an entry, delete it and
          // enter the correct day. Submitted as a hidden field so saveEntry
          // still gets it.
          <div className="flex flex-col gap-1 text-sm font-medium">
            <span>Date</span>
            <input type="hidden" name="entry_date" value={entryDate} />
            <span className="w-fit rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-normal text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
              {entryDate}
            </span>
          </div>
        ) : (
          <label className="flex flex-col gap-1 text-sm font-medium">
            Date
            <input
              type="date"
              name="entry_date"
              defaultValue={entryDate}
              required
              max={todayISODate()}
              className="w-fit rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700"
            />
          </label>
        )}

        <VehicleFieldset
          title="New vehicles"
          unitsName="new_units"
          frontName="new_front_end_gross"
          backName="new_back_end_gross"
          unitsValue={existing?.new_units ?? 0}
          frontValue={existing?.new_front_end_gross ?? 0}
          backValue={existing?.new_back_end_gross ?? 0}
        />

        <VehicleFieldset
          title="Used vehicles"
          unitsName="used_units"
          frontName="used_front_end_gross"
          backName="used_back_end_gross"
          unitsValue={existing?.used_units ?? 0}
          frontValue={existing?.used_front_end_gross ?? 0}
          backValue={existing?.used_back_end_gross ?? 0}
        />

        {/* A third category, not a slice of "new": a Sprinter is entered here
            and nowhere else, so it cannot be counted twice. Only shown where
            the store actually sells them. */}
        {dealership.tracks_sprinters ? (
          <VehicleFieldset
            title="Sprinter"
            unitsName="sprinter_units"
            frontName="sprinter_front_end_gross"
            backName="sprinter_back_end_gross"
            unitsValue={existing?.sprinter_units ?? 0}
            frontValue={existing?.sprinter_front_end_gross ?? 0}
            backValue={existing?.sprinter_back_end_gross ?? 0}
          />
        ) : null}

        {/* Only for stores an admin has switched on. Everything else about
            this form is unchanged for every other store. */}
        {people ? (
          <SalespeopleFieldset
            dealershipId={dealershipId}
            people={people}
            sprinters={dealership.tracks_sprinters}
          />
        ) : null}

        <ActivityFieldset
          salesCalls={existing?.sales_calls ?? 0}
          appointments={existing?.appointments ?? 0}
        />

        <label className="flex flex-col gap-1 text-sm font-medium">
          Notes for the day
          <textarea
            name="notes"
            rows={3}
            defaultValue={existing?.notes ?? ""}
            placeholder="Anything worth flagging about today…"
            className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700"
          />
        </label>

        <EntrySanityWarnings />

        <SaveEntryButton
          existingDates={existingDates}
          label={existing ? "Update entry" : "Save entry"}
          className="mt-1 w-fit rounded-md btn-primary px-4 py-2 text-sm font-semibold shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        />
      </form>
    </div>
  );
}

function ActivityFieldset({
  salesCalls,
  appointments,
}: {
  salesCalls: number;
  appointments: number;
}) {
  const inputClass =
    "mt-auto rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700";
  const fields: [string, string, number][] = [
    ["Sales calls", "sales_calls", salesCalls],
    ["Appointments", "appointments", appointments],
  ];
  return (
    <fieldset className="rounded-xl border border-zinc-200 bg-white/60 p-4 dark:border-zinc-800 dark:bg-white/[0.02]">
      <legend className="flex items-center gap-2 px-1 text-sm font-semibold">
        <span className="h-2 w-2 rounded-full bg-blue-500" />
        Activity
      </legend>
      <div className="mt-2 grid grid-cols-2 gap-4">
        {fields.map(([label, name, value]) => (
          <label key={name} className="flex flex-col gap-1 text-sm font-medium">
            {label}
            <input
              type="number"
              name={name}
              min={0}
              step={1}
              defaultValue={value}
              required
              className={inputClass}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function VehicleFieldset({
  title,
  unitsName,
  frontName,
  backName,
  unitsValue,
  frontValue,
  backValue,
}: {
  title: string;
  unitsName: string;
  frontName: string;
  backName: string;
  unitsValue: number;
  frontValue: number;
  backValue: number;
}) {
  const inputClass =
    "mt-auto rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700";

  return (
    <fieldset className="rounded-xl border border-zinc-200 bg-white/60 p-4 dark:border-zinc-800 dark:bg-white/[0.02]">
      <legend className="flex items-center gap-2 px-1 text-sm font-semibold">
        <span className="h-2 w-2 rounded-full bg-blue-500" />
        {title}
      </legend>
      <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Units
          <input
            type="number"
            name={unitsName}
            min={0}
            step={1}
            defaultValue={unitsValue}
            required
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Front end gross ($)
          <input
            type="number"
            name={frontName}
            step="0.01"
            defaultValue={frontValue}
            required
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Back end gross ($)
          <input
            type="number"
            name={backName}
            step="0.01"
            defaultValue={backValue}
            required
            className={inputClass}
          />
        </label>
      </div>
    </fieldset>
  );
}

/**
 * Who appears on the entry form for a day: everyone on the roster, plus anyone
 * since removed who already has numbers on that day — otherwise re-saving a
 * past day would quietly drop their row.
 */
async function loadSalespeopleForDay(
  dealershipId: string,
  entryDate: string,
): Promise<SalespersonRowProps[]> {
  const supabase = await createClient();
  const [{ data: roster }, { data: rows }] = await Promise.all([
    supabase
      .from("salespeople")
      .select("id, first_name, last_name, is_active, removed_at")
      .eq("dealership_id", dealershipId),
    supabase
      .from("salesperson_daily_entries")
      .select(
        "salesperson_id, new_units, used_units, sprinter_units, front_end_gross, back_end_gross",
      )
      .eq("dealership_id", dealershipId)
      .eq("entry_date", entryDate),
  ]);

  const byPerson = new Map((rows ?? []).map((r) => [r.salesperson_id, r]));
  return ((roster ?? []) as RosterPerson[])
    .filter((p) => p.is_active || byPerson.has(p.id))
    .sort(byName)
    .map((p) => {
      const r = byPerson.get(p.id);
      return {
        id: p.id,
        name: salespersonName(p),
        initials: salespersonInitials(p),
        removed: !p.is_active,
        newUnits: Number(r?.new_units ?? 0),
        usedUnits: Number(r?.used_units ?? 0),
        sprinterUnits: Number(r?.sprinter_units ?? 0),
        front: Number(r?.front_end_gross ?? 0),
        back: Number(r?.back_end_gross ?? 0),
      };
    });
}
