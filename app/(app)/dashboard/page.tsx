import { Fragment } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, effectiveRole } from "@/lib/auth";
import { formatCurrency, monthStartISODate, todayISODate } from "@/lib/format";
import { projectMonthEnd } from "@/lib/projection";
import { APP_NAME } from "@/app/brand";

/**
 * "12 new · 9 used · 3 Sprinter".
 *
 * `showSprinter` is the store's own tracks_sprinters flag, not "did any sell":
 * a Sprinter store wants to see its Sprinter line sitting at 0, the same way it
 * sees 0 used. Only stores that never sell them omit it.
 *
 * The all-stores rollup passes true whenever any store tracks them, so the
 * company figure does not silently drop the category on a slow day.
 *
 * Each count and its label sit in one unbreakable span, so a narrow tile wraps
 * between the categories and never between a number and the word it belongs
 * to: "0 new ·" / "0" / "used" over three lines reads as nothing at all.
 */
function unitSummary(
  newUnits: number,
  used: number,
  sprinter: number,
  showSprinter: boolean,
) {
  const parts = [
    [newUnits, "new"],
    [used, "used"],
    ...(showSprinter ? [[sprinter, "Sprinter"] as const] : []),
  ] as const;

  return (
    <>
      {parts.map(([count, name], i) => (
        <Fragment key={name}>
          {/* A separator only where the figures share a line. From `sm` up the
              columns are narrow and each figure takes its own line, where a
              dot would just dangle at the end of the one above. It sits
              outside the nowrap span so it stays a legal place to break. */}
          {i > 0 ? <span className="sm:hidden">{" · "}</span> : null}
          <span className="whitespace-nowrap sm:block">
            {count} {name}
          </span>
        </Fragment>
      ))}
    </>
  );
}

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
    { data: settings },
    { data: budgets },
  ] = await Promise.all([
    // Hand-set order, falling back to alphabetical for any store nobody has
    // placed — see dealerships.sort_order.
    supabase
      .from("dealerships")
      .select("id, name, tracks_sprinters, sort_order")
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name"),
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
      .select("key, value")
      .in("key", ["show_leaderboard", "admin_rollup"]),
    supabase
      .from("store_budgets")
      .select("dealership_id, new_units, used_units, sprinter_units")
      .eq("month", monthStartISODate()),
  ]);

  const budgetByDealership = new Map(
    (budgets ?? []).map((b) => [b.dealership_id, b]),
  );

  const setting = (key: string) =>
    (settings ?? []).find((s) => s.key === key)?.value;

  const mainDealershipId = profile?.main_dealership_id ?? null;
  // Defaults to on, so a missing row behaves the way it did before the setting
  // existed. (The admin_rollup switch is now checked inside the rollup RPC.)
  const showLeaderboard = setting("show_leaderboard") !== false;

  type RollupTotals = {
    todayGross: number;
    mtdGross: number;
    todayNew: number;
    todayUsed: number;
    todaySprinter: number;
    mtdNew: number;
    mtdUsed: number;
    mtdSprinter: number;
  };

  // The whole "who may see group totals, and the totals themselves" now lives
  // in one SECURITY DEFINER function (0023), called with the caller's own
  // client. It returns null to anyone not entitled — so the boundary is in the
  // database, not a TypeScript `if`, and the service-role client is gone from
  // this render.
  const { data: rollupData } = await supabase.rpc("get_dashboard_rollup", {
    p_month: monthStartISODate(),
    p_today: todayISODate(),
  });

  const rollup: RollupTotals | null =
    (rollupData as { rollup?: RollupTotals } | null)?.rollup ?? null;
  const canViewRollup = rollup !== null;
  // For the run-rate divisor: today counts once any store has entered today's
  // numbers. Until then today is in-progress and would drag the projection down.
  const rollupTodayLogged = rollup
    ? rollup.todayNew > 0 ||
      rollup.todayUsed > 0 ||
      rollup.todaySprinter > 0 ||
      rollup.todayGross !== 0
    : false;
  const leaderboard: {
    name: string;
    gross: number;
    newUnits: number;
    usedUnits: number;
  }[] = ((rollupData as { leaderboard?: unknown } | null)?.leaderboard ??
    []) as {
    name: string;
    gross: number;
    newUnits: number;
    usedUnits: number;
  }[];
  leaderboard.sort((a, b) => b.gross - a.gross);

  // The rollup covers every store, so it shows the Sprinter line whenever any
  // store sells them — not only on days one was sold.
  const anyStoreTracksSprinters = (dealerships ?? []).some(
    (d) => d.tracks_sprinters,
  );

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
      {/* Woven lattice behind the whole dashboard — fixed so it stays put as
          the grid scrolls, and -z-10 so it sits over the page ground but under
          every card. Scoped to this route: it unmounts on other pages. */}
      <div
        aria-hidden
        className="dash-lattice pointer-events-none fixed inset-0 -z-10"
      />
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          {/* Greeted by preferred name where they have one — see
              greetingName(). Falls back to the bare welcome rather than an
              awkward "Welcome, null" for a profile with no name yet. */}
          <h1 className="text-xl font-semibold tracking-tight">
            {user.greetingName
              ? `Welcome to the ${APP_NAME} ${user.greetingName}`
              : `Welcome to the ${APP_NAME}`}
          </h1>
        </div>
        {/* Obsidian emblem in light mode, platinum in dark. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/Lapis-Obsidian-Emblem.png"
          alt=""
          aria-hidden
          className="pointer-events-none block h-12 w-auto shrink-0 select-none opacity-40 sm:h-14 dark:hidden"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/Lapis-Platinum-Emblem.png"
          alt=""
          aria-hidden
          className="pointer-events-none hidden h-12 w-auto shrink-0 select-none opacity-40 sm:h-14 dark:block"
        />
      </div>
      {rollup ? (
        <div className="rounded-xl border border-blue-200 bg-white p-4 tile-float dark:border-blue-900/50 dark:bg-[var(--surface)]">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
            All stores
          </p>
          <div className="grid grid-cols-3 divide-x divide-zinc-200 text-center dark:divide-zinc-800">
            <GrossStat
              label="Today"
              value={rollup.todayGross}
              sub={unitSummary(
                rollup.todayNew,
                rollup.todayUsed,
                rollup.todaySprinter,
                anyStoreTracksSprinters,
              )}
            />
            <GrossStat
              label="This month"
              value={rollup.mtdGross}
              sub={unitSummary(
                rollup.mtdNew,
                rollup.mtdUsed,
                rollup.mtdSprinter,
                anyStoreTracksSprinters,
              )}
            />
            <GrossStat
              label="Projected"
              value={projectMonthEnd(rollup.mtdGross, rollupTodayLogged)}
              accent
              sub={unitSummary(
                Math.round(projectMonthEnd(rollup.mtdNew, rollupTodayLogged)),
                Math.round(projectMonthEnd(rollup.mtdUsed, rollupTodayLogged)),
                Math.round(
                  projectMonthEnd(rollup.mtdSprinter, rollupTodayLogged),
                ),
                anyStoreTracksSprinters,
              )}
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
            <div className="rounded-xl border border-blue-200 bg-white p-4 tile-float dark:border-blue-900/50 dark:bg-[var(--surface)]">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Gross leader
              </p>
              <p className="mt-1 truncate text-lg font-semibold tracking-tight">
                {grossLeader.name}
              </p>
              <p className="mt-0.5 text-sm text-zinc-500">
                {formatCurrency(grossLeader.gross)} gross
              </p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-white p-4 tile-float dark:border-blue-900/50 dark:bg-[var(--surface)]">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
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
          const todaySprinterGross =
            (todayEntry?.sprinter_front_end_gross ?? 0) +
            (todayEntry?.sprinter_back_end_gross ?? 0);
          const todayGross =
            todayNewGross + todayUsedGross + todaySprinterGross;

          const mtdGross = summary?.total_gross ?? 0;
          const projNewUnits = Math.round(
            projectMonthEnd(summary?.total_new_units ?? 0, !!todayEntry),
          );
          const projUsedUnits = Math.round(
            projectMonthEnd(summary?.total_used_units ?? 0, !!todayEntry),
          );
          const projSprinterUnits = Math.round(
            projectMonthEnd(summary?.total_sprinter_units ?? 0, !!todayEntry),
          );
          const budget = budgetByDealership.get(dealership.id);

          return (
            <div
              key={dealership.id}
              className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 tile-float transition hover:border-blue-200 dark:border-zinc-800 dark:bg-[var(--surface)] dark:hover:border-blue-900"
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
                    <span className="rounded-full btn-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
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
                {/* A store with no entry yet says so, rather than showing a
                    wall of $0 that reads identically to "sold nothing". That
                    distinction is the difference between chasing the manager
                    and it being a slow morning. */}
                {!todayEntry ? (
                  <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/60 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-white/[0.02]">
                    No numbers entered for today yet.
                  </div>
                ) : (
                <div
                  className={`grid gap-px overflow-hidden rounded-lg border border-zinc-100 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800 ${
                    dealership.tracks_sprinters ? "grid-cols-3" : "grid-cols-2"
                  }`}
                >
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
                  {dealership.tracks_sprinters ? (
                    <VehicleStat
                      label="Sprinter"
                      units={todayEntry?.sprinter_units ?? 0}
                      front={todayEntry?.sprinter_front_end_gross ?? 0}
                      back={todayEntry?.sprinter_back_end_gross ?? 0}
                      gross={todaySprinterGross}
                    />
                  ) : null}
                </div>
                )}

                {todayEntry ? (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <ActivityStat
                      label="Sales calls"
                      value={todayEntry.sales_calls ?? 0}
                    />
                    <ActivityStat
                      label="Appointments"
                      value={todayEntry.appointments ?? 0}
                    />
                  </div>
                ) : null}
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

              {/* Two across on a phone, four in a row from `sm` up — four
                  columns of this at phone width leaves each about 80px and
                  the labels wrap. The dividers only make sense in the single
                  row, so they start at `sm` too. */}
              <div className="grid grid-cols-2 gap-y-4 divide-zinc-200 border-t border-zinc-100 pt-3 text-center dark:divide-zinc-800 dark:border-zinc-800 sm:grid-cols-4 sm:gap-y-0 sm:divide-x">
                <GrossStat
                  label="Today"
                  value={todayGross}
                  sub={unitSummary(
                    todayEntry?.new_units ?? 0,
                    todayEntry?.used_units ?? 0,
                    todayEntry?.sprinter_units ?? 0,
                    dealership.tracks_sprinters,
                  )}
                />
                <GrossStat
                  label="This month"
                  value={mtdGross}
                  sub={unitSummary(
                    summary?.total_new_units ?? 0,
                    summary?.total_used_units ?? 0,
                    summary?.total_sprinter_units ?? 0,
                    dealership.tracks_sprinters,
                  )}
                />
                {/* Units only — a budget is a count of cars, not money. */}
                <GrossStat
                  label="Budget"
                  units
                  value={
                    budget
                      ? budget.new_units +
                        budget.used_units +
                        (dealership.tracks_sprinters ? budget.sprinter_units : 0)
                      : null
                  }
                  sub={
                    budget
                      ? unitSummary(
                          budget.new_units,
                          budget.used_units,
                          budget.sprinter_units,
                          dealership.tracks_sprinters,
                        )
                      : "Not set"
                  }
                />
                {/* Total units, to sit alongside Budget as like-for-like — a
                    projected car count against a budgeted one. No accent, so
                    its number matches Budget's size and the new/used rows
                    below line up across all four columns. The gross figure
                    still leads the Today and This-month columns. */}
                <GrossStat
                  label="Projected"
                  units
                  value={
                    projNewUnits +
                    projUsedUnits +
                    (dealership.tracks_sprinters ? projSprinterUnits : 0)
                  }
                  sub={
                    <>
                      <PaceUnits
                        projected={projNewUnits}
                        budget={budget?.new_units ?? 0}
                        label="new"
                      />
                      <PaceSeparator />
                      <PaceUnits
                        projected={projUsedUnits}
                        budget={budget?.used_units ?? 0}
                        label="used"
                      />
                      {dealership.tracks_sprinters ? (
                        <>
                          <PaceSeparator />
                          <PaceUnits
                            projected={projSprinterUnits}
                            budget={budget?.sprinter_units ?? 0}
                            label="Sprinter"
                          />
                        </>
                      ) : null}
                    </>
                  }
                />
              </div>

              <div className="flex gap-4 text-sm">
                {/* The card's main action, so it takes the strongest tone
                    available. In this palette the accent is *quieter* than the
                    body colour, and leaving it on the accent made the primary
                    action read as the lesser of the two links. */}
                {role === "editor" ? (
                  <Link
                    href={`/dealerships/${dealership.id}/entry`}
                    className="font-semibold text-zinc-900 underline underline-offset-4 dark:text-zinc-50"
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
  units = false,
  sub,
}: {
  label: string;
  /** null renders a dash — "no budget set" is not the same as zero. */
  value: number | null;
  accent?: boolean;
  /** Show a plain count instead of a currency amount. */
  units?: boolean;
  sub?: React.ReactNode;
}) {
  return (
    <div className="px-2">
      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div
        className={`mt-1 font-mono font-semibold tabular-nums text-zinc-900 dark:text-zinc-50 ${
          accent ? "text-base" : "text-sm"
        }`}
      >
        {value === null
          ? "—"
          : units
            ? Math.round(value).toLocaleString("en-US")
            : formatCurrency(value)}
      </div>
      {sub ? (
        <div className="mt-1 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
          {sub}
        </div>
      ) : null}
    </div>
  );
}

/**
 * A projected unit count, coloured against its budget.
 *
 * Green when the month-end projection reaches the goal, red when it does not.
 * With no budget set there is nothing to be on pace for, so the number is left
 * in the surrounding colour rather than being marked red — an unset goal is
 * not a missed one.
 */
function PaceUnits({
  projected,
  budget,
  label,
}: {
  projected: number;
  budget: number;
  label: string;
}) {
  const tone =
    budget <= 0
      ? ""
      : projected >= budget
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-red-600 dark:text-red-400";

  return (
    <span
      className={`whitespace-nowrap sm:block ${tone}`}
      title={
        budget > 0
          ? `${projected} projected against a budget of ${budget} ${label}`
          : undefined
      }
    >
      {projected} {label}
    </span>
  );
}

/**
 * Between two projected figures — and only while they share a line. From `sm`
 * up the column is narrow enough that each takes its own, and the dot would be
 * left dangling at the end of the one above.
 */
function PaceSeparator() {
  return <span className="sm:hidden">{" · "}</span>;
}

function ActivityStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50/60 px-3 py-2 dark:border-zinc-800 dark:bg-white/[0.02]">
      <div className="font-mono text-lg font-semibold tabular-nums">{value}</div>
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
      {/* Label above the count rather than beside it. Side by side, a long
          label like SPRINTER pushed "0 units" onto a second line while NEW and
          USED stayed on one, so that tile's Front/Back/Gross rows sat lower
          than its neighbours'. Stacking gives every tile the same two-line
          head whatever the label says, so the rows always line up. */}
      <div>
        <span className="block truncate text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {label}
        </span>
        <span className="mt-0.5 block text-sm font-semibold">
          {units} units
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
