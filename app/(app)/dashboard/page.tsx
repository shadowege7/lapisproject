import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
    { data: profile },
    { data: leaderboardSetting },
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
    supabase
      .from("profiles")
      .select("main_dealership_id, position_id")
      .eq("id", user.id)
      .single(),
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", "show_leaderboard")
      .maybeSingle(),
  ]);

  const mainDealershipId = profile?.main_dealership_id ?? null;
  const showLeaderboard = leaderboardSetting?.value !== false;

  // Group-wide rollup: visible to super admins, or to users whose position an
  // admin has granted rollup access.
  let canViewRollup = user.isSuperAdmin;
  if (!canViewRollup && profile?.position_id) {
    const { data: pos } = await supabase
      .from("positions")
      .select("can_view_rollup")
      .eq("id", profile.position_id)
      .maybeSingle();
    canViewRollup = pos?.can_view_rollup ?? false;
  }

  let rollup: {
    todayGross: number;
    mtdGross: number;
    todayNew: number;
    todayUsed: number;
    mtdNew: number;
    mtdUsed: number;
  } | null = null;
  let leaderboard: {
    name: string;
    gross: number;
    newUnits: number;
    usedUnits: number;
  }[] = [];
  if (canViewRollup) {
    // Sum across ALL stores via the service-role client (bypasses RLS) — safe
    // because access is gated by canViewRollup above.
    const admin = createAdminClient();
    const [{ data: allMonthly }, { data: allToday }, { data: allStores }] =
      await Promise.all([
        admin
          .from("monthly_summary")
          .select(
            "dealership_id, total_gross, total_new_units, total_used_units",
          )
          .eq("month", monthStartISODate()),
        admin
          .from("daily_entries")
          .select(
            "new_front_end_gross, new_back_end_gross, used_front_end_gross, used_back_end_gross, new_units, used_units",
          )
          .eq("entry_date", todayISODate()),
        admin.from("dealerships").select("id, name").order("name"),
      ]);

    rollup = {
      mtdGross: (allMonthly ?? []).reduce((s, r) => s + r.total_gross, 0),
      mtdNew: (allMonthly ?? []).reduce((s, r) => s + r.total_new_units, 0),
      mtdUsed: (allMonthly ?? []).reduce((s, r) => s + r.total_used_units, 0),
      todayGross: (allToday ?? []).reduce(
        (s, e) =>
          s +
          e.new_front_end_gross +
          e.new_back_end_gross +
          e.used_front_end_gross +
          e.used_back_end_gross,
        0,
      ),
      todayNew: (allToday ?? []).reduce((s, e) => s + e.new_units, 0),
      todayUsed: (allToday ?? []).reduce((s, e) => s + e.used_units, 0),
    };

    const mtdByStore = new Map(
      (allMonthly ?? []).map((r) => [r.dealership_id, r]),
    );
    leaderboard = (allStores ?? [])
      .map((d) => {
        const m = mtdByStore.get(d.id);
        return {
          name: d.name,
          gross: m?.total_gross ?? 0,
          newUnits: m?.total_new_units ?? 0,
          usedUnits: m?.total_used_units ?? 0,
        };
      })
      .sort((a, b) => b.gross - a.gross);
  }

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

  const grossLeader = leaderboard.length ? leaderboard[0] : null;
  const unitLeader = leaderboard.length
    ? leaderboard.reduce((best, s) =>
        s.newUnits + s.usedUnits > best.newUnits + best.usedUnits ? s : best,
      )
    : null;

  const orderedDealerships = mainDealershipId
    ? [
        ...dealerships.filter((d) => d.id === mainDealershipId),
        ...dealerships.filter((d) => d.id !== mainDealershipId),
      ]
    : dealerships;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400">
            Daily snapshot
          </p>
          <h1 className="text-xl font-semibold tracking-tight">Dealerships</h1>
        </div>
        {/* Obsidian emblem in light mode, gold in dark (LAPIS) mode. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/Lapis-Obsidian-Emblem.png"
          alt=""
          aria-hidden
          className="pointer-events-none block h-12 w-auto shrink-0 select-none opacity-40 sm:h-14 dark:hidden"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/Lapis-Gold-Emblem.png"
          alt=""
          aria-hidden
          className="pointer-events-none hidden h-12 w-auto shrink-0 select-none opacity-40 sm:h-14 dark:block"
        />
      </div>
      {rollup ? (
        <div className="rounded-xl border border-blue-200 bg-white p-4 shadow-sm dark:border-blue-900/50 dark:bg-[var(--surface)]">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400">
            All stores
          </p>
          <div className="grid grid-cols-3 divide-x divide-zinc-200 text-center dark:divide-zinc-800">
            <GrossStat
              label="Today"
              value={rollup.todayGross}
              sub={`${rollup.todayNew} new · ${rollup.todayUsed} used`}
            />
            <GrossStat
              label="This month"
              value={rollup.mtdGross}
              sub={`${rollup.mtdNew} new · ${rollup.mtdUsed} used`}
            />
            <GrossStat
              label="Projected"
              value={projectMonthEnd(rollup.mtdGross)}
              accent
              sub={`${Math.round(projectMonthEnd(rollup.mtdNew))} new · ${Math.round(projectMonthEnd(rollup.mtdUsed))} used`}
            />
          </div>
        </div>
      ) : null}
      {showLeaderboard && leaderboard.length > 1 && grossLeader && unitLeader ? (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Leaders · this month
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-blue-200 bg-white p-4 shadow-sm dark:border-blue-900/50 dark:bg-[var(--surface)]">
              <p className="text-xs font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400">
                Gross leader
              </p>
              <p className="mt-1 truncate text-lg font-semibold tracking-tight">
                {grossLeader.name}
              </p>
              <p className="mt-0.5 text-sm text-zinc-500">
                {formatCurrency(grossLeader.gross)} gross
              </p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-white p-4 shadow-sm dark:border-blue-900/50 dark:bg-[var(--surface)]">
              <p className="text-xs font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400">
                Unit leader
              </p>
              <p className="mt-1 truncate text-lg font-semibold tracking-tight">
                {unitLeader.name}
              </p>
              <p className="mt-0.5 text-sm text-zinc-500">
                {unitLeader.newUnits + unitLeader.usedUnits} units (
                {unitLeader.newUnits} new · {unitLeader.usedUnits} used)
              </p>
            </div>
          </div>
        </div>
      ) : null}
      <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,19rem),1fr))]">
        {orderedDealerships.map((dealership) => {
          const role = effectiveRole(
            user,
            roleByDealership.get(dealership.id),
          );
          const summary = monthlyByDealership.get(dealership.id);

          if (!role) return null;

          const todayEntry = todayByDealership.get(dealership.id);
          const todayNewGross =
            (todayEntry?.new_front_end_gross ?? 0) +
            (todayEntry?.new_back_end_gross ?? 0);
          const todayUsedGross =
            (todayEntry?.used_front_end_gross ?? 0) +
            (todayEntry?.used_back_end_gross ?? 0);
          const todayGross = todayNewGross + todayUsedGross;

          const mtdGross = summary?.total_gross ?? 0;
          const projNewUnits = Math.round(
            projectMonthEnd(summary?.total_new_units ?? 0),
          );
          const projUsedUnits = Math.round(
            projectMonthEnd(summary?.total_used_units ?? 0),
          );

          return (
            <div
              key={dealership.id}
              className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-shadow hover:border-blue-200 hover:shadow-md dark:border-zinc-800 dark:bg-[var(--surface)] dark:hover:border-blue-900"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 font-semibold tracking-tight">
                  <Link
                    href={`/dealerships/${dealership.id}`}
                    className="hover:text-blue-700 hover:underline dark:hover:text-blue-400"
                  >
                    {dealership.name}
                  </Link>
                  {dealership.id === mainDealershipId ? (
                    <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      Main
                    </span>
                  ) : null}
                </h2>
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                  {role}
                </span>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Today
                </p>
                <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-zinc-100 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800">
                  <VehicleStat
                    label="New"
                    units={todayEntry?.new_units ?? 0}
                    front={todayEntry?.new_front_end_gross ?? 0}
                    back={todayEntry?.new_back_end_gross ?? 0}
                    gross={todayNewGross}
                  />
                  <VehicleStat
                    label="Used"
                    units={todayEntry?.used_units ?? 0}
                    front={todayEntry?.used_front_end_gross ?? 0}
                    back={todayEntry?.used_back_end_gross ?? 0}
                    gross={todayUsedGross}
                  />
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <ActivityStat
                    label="Manager calls"
                    value={todayEntry?.manager_calls ?? 0}
                  />
                  <ActivityStat
                    label="Sales calls"
                    value={todayEntry?.sales_calls ?? 0}
                  />
                  <ActivityStat
                    label="Appointments"
                    value={todayEntry?.appointments ?? 0}
                  />
                  <ActivityStat
                    label="Confirmed appts"
                    value={todayEntry?.confirmed_appointments ?? 0}
                  />
                </div>
              </div>

              {todayEntry?.notes ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/50 dark:bg-amber-950/30">
                  <span className="mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
                    Notes
                  </span>
                  <p className="whitespace-pre-wrap break-words text-sm text-amber-900 dark:text-amber-100">
                    {todayEntry.notes}
                  </p>
                </div>
              ) : null}

              <div className="grid grid-cols-3 divide-x divide-zinc-200 border-t border-zinc-100 pt-3 text-center dark:divide-zinc-800 dark:border-zinc-800">
                <GrossStat
                  label="Today"
                  value={todayGross}
                  sub={`${todayEntry?.new_units ?? 0} new · ${todayEntry?.used_units ?? 0} used`}
                />
                <GrossStat
                  label="This month"
                  value={mtdGross}
                  sub={`${summary?.total_new_units ?? 0} new · ${summary?.total_used_units ?? 0} used`}
                />
                <GrossStat
                  label="Projected"
                  value={projectMonthEnd(mtdGross)}
                  accent
                  sub={`${projNewUnits} new · ${projUsedUnits} used`}
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
  sub,
}: {
  label: string;
  value: number;
  accent?: boolean;
  sub?: string;
}) {
  return (
    <div className="px-2">
      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div
        className={`mt-1 font-semibold text-zinc-900 dark:text-zinc-50 ${
          accent ? "text-base" : "text-sm"
        }`}
      >
        {formatCurrency(value)}
      </div>
      {sub ? (
        <div className="mt-1 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
          {sub}
        </div>
      ) : null}
    </div>
  );
}

function ActivityStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50/60 px-3 py-2 dark:border-zinc-800 dark:bg-white/[0.02]">
      <div className="text-lg font-semibold">{value}</div>
      <div className="break-words text-xs text-zinc-500">{label}</div>
    </div>
  );
}

function VehicleStat({
  label,
  units,
  front,
  back,
  gross,
}: {
  label: string;
  units: number;
  front: number;
  back: number;
  gross: number;
}) {
  return (
    <div className="bg-white p-3 dark:bg-[var(--surface)]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {label}
        </span>
        <span className="text-sm font-semibold">{units} units</span>
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
