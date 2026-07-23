import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, effectiveRole } from "@/lib/auth";
import { todayISODate } from "@/lib/format";
import { saveEntry } from "./actions";

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

  const [{ data: dealership }, { data: membership }, { data: existing }] =
    await Promise.all([
      supabase
        .from("dealerships")
        .select("id, name")
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
    ]);

  if (!dealership) notFound();

  const role = effectiveRole(user, membership?.role);
  if (role !== "editor") {
    redirect(`/dealerships/${dealershipId}/reports`);
  }

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400">
          Daily entry
        </p>
        <h1 className="text-xl font-semibold tracking-tight">
          {dealership.name}
        </h1>
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

        <button
          type="submit"
          className="mt-1 w-fit rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        >
          {existing ? "Update entry" : "Save entry"}
        </button>
      </form>
    </div>
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
    "rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700";

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
