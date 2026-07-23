import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, effectiveRole } from "@/lib/auth";
import { formatCurrency, monthStartISODate, todayISODate } from "@/lib/format";
import { projectMonthEnd } from "@/lib/projection";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();

  const [
    { data: dealerships },
    { data: memberships },
    { data: monthly },
    { data: todayEntries },
  ] = await Promise.all([
    supabase.from("dealerships").select("id, name").order("name"),
    supabase
      .from("dealership_members")
      .select("dealership_id, role")
      .eq("user_id", user.id),
    supabase
      .from("monthly_summary")
      .select("*")
      .eq("month", monthStartISODate()),
    supabase
      .from("daily_entries")
      .select("*")
      .eq("entry_date", todayISODate()),
  ]);

  const roleByDealership = new Map(
    memberships?.map((m) => [m.dealership_id, m.role]),
  );
  const monthlyByDealership = new Map(
    monthly?.map((m) => [m.dealership_id, m]),
  );
  const todayByDealership = new Map(
    todayEntries?.map((e) => [e.dealership_id, e]),
  );

  if (!dealerships || dealerships.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-white/50 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-white/[0.02]">
        {user.isSuperAdmin ? (
          <>
            No dealerships yet.{" "}
            <Link
              href="/admin"
              className="font-medium text-blue-600 underline hover:text-blue-700 dark:text-blue-400"
            >
              Create one from the Admin page
            </Link>
            .
          </>
        ) : (
          "You don't have access to any dealerships yet. Contact an admin to be added."
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400">
          Month to date
        </p>
        <h1 className="text-xl font-semibold tracking-tight">Dealerships</h1>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {dealerships.map((dealership) => {
          const role = effectiveRole(
            user,
            roleByDealership.get(dealership.id),
          );
          const summary = monthlyByDealership.get(dealership.id);

          if (!role) return null;

          const newGross =
            (summary?.total_new_front_end_gross ?? 0) +
            (summary?.total_new_back_end_gross ?? 0);
          const usedGross =
            (summary?.total_used_front_end_gross ?? 0) +
            (summary?.total_used_back_end_gross ?? 0);

          const todayEntry = todayByDealership.get(dealership.id);
          const todayGross = todayEntry
            ? todayEntry.new_front_end_gross +
              todayEntry.new_back_end_gross +
              todayEntry.used_front_end_gross +
              todayEntry.used_back_end_gross
            : 0;
          const mtdGross = summary?.total_gross ?? 0;

          return (
            <div
              key={dealership.id}
              className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-shadow hover:border-blue-200 hover:shadow-md dark:border-zinc-800 dark:bg-[#0e1626] dark:hover:border-blue-900"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-semibold tracking-tight">
                  {dealership.name}
                </h2>
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                  {role}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-zinc-100 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800">
                <VehicleStat
                  label="New"
                  units={summary?.total_new_units ?? 0}
                  projectedUnits={Math.round(
                    projectMonthEnd(summary?.total_new_units ?? 0),
                  )}
                  front={summary?.total_new_front_end_gross ?? 0}
                  back={summary?.total_new_back_end_gross ?? 0}
                  gross={newGross}
                />
                <VehicleStat
                  label="Used"
                  units={summary?.total_used_units ?? 0}
                  projectedUnits={Math.round(
                    projectMonthEnd(summary?.total_used_units ?? 0),
                  )}
                  front={summary?.total_used_front_end_gross ?? 0}
                  back={summary?.total_used_back_end_gross ?? 0}
                  gross={usedGross}
                />
              </div>

              <div className="grid grid-cols-3 gap-2 border-t border-zinc-100 pt-3 text-center dark:border-zinc-800">
                <GrossStat label="Today" value={todayGross} />
                <GrossStat label="This month" value={mtdGross} />
                <GrossStat
                  label="Projected"
                  value={projectMonthEnd(mtdGross)}
                  accent
                />
              </div>

              <div className="flex gap-4 text-sm">
                {role === "editor" ? (
                  <Link
                    href={`/dealerships/${dealership.id}/entry`}
                    className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Enter today&apos;s numbers
                  </Link>
                ) : null}
                <Link
                  href={`/dealerships/${dealership.id}/reports`}
                  className="font-medium text-zinc-500 hover:text-blue-700 hover:underline dark:text-zinc-400 dark:hover:text-blue-400"
                >
                  View reports
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GrossStat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-zinc-500">{label}</div>
      <div
        className={`text-sm font-semibold ${
          accent ? "text-blue-700 dark:text-blue-400" : ""
        }`}
      >
        {formatCurrency(value)}
      </div>
    </div>
  );
}

function VehicleStat({
  label,
  units,
  projectedUnits,
  front,
  back,
  gross,
}: {
  label: string;
  units: number;
  projectedUnits: number;
  front: number;
  back: number;
  gross: number;
}) {
  return (
    <div className="bg-white p-3 dark:bg-[#0e1626]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {label}
        </span>
        <span className="text-sm font-semibold">{units} units</span>
      </div>
      <div className="mt-0.5 flex items-center justify-between text-xs">
        <span className="text-zinc-400">Projected</span>
        <span className="font-medium text-blue-700 dark:text-blue-400">
          {projectedUnits} units
        </span>
      </div>
      <dl className="mt-2 space-y-1 text-xs">
        <div className="flex justify-between">
          <dt className="text-zinc-400">Front</dt>
          <dd>{formatCurrency(front)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-zinc-400">Back</dt>
          <dd>{formatCurrency(back)}</dd>
        </div>
        <div className="flex justify-between border-t border-zinc-100 pt-1 font-medium dark:border-zinc-800">
          <dt className="text-zinc-500">Gross</dt>
          <dd>{formatCurrency(gross)}</dd>
        </div>
      </dl>
    </div>
  );
}
