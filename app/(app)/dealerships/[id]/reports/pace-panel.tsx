import Link from "next/link";
import { formatCurrency, formatMonth } from "@/lib/format";
import { projectMonthEnd } from "@/lib/projection";
import {
  budgetUnits,
  cumulativeUnits,
  cutoffDay,
  daysInMonth,
  hasMonth,
  monthTotals,
  shiftMonth,
  signed,
  type InsightDay,
} from "@/lib/insights";
import { PaceChart } from "./pace-chart";

interface Budget {
  new_units: number;
  used_units: number;
  sprinter_units: number;
}

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

/**
 * Dealership Insights → Pace. Where the month stands against its budget and
 * against earlier months at the same point, and the running-units chart.
 *
 * For the month in progress, "same point" means through the last day whose
 * numbers are in (see cutoffDay). A finished month is compared whole.
 * Last year's month only appears once there is data for it.
 */
export function PacePanel({
  dealershipId,
  viewMonth,
  currentMonth,
  today,
  todayLogged,
  sprinters,
  rows,
  budget,
  canSetBudget,
}: {
  dealershipId: string;
  viewMonth: string;
  currentMonth: string;
  today: string;
  todayLogged: boolean;
  sprinters: boolean;
  /** Daily rows covering the viewed month, the month before, and the same month last year. */
  rows: InsightDay[];
  budget: Budget | null;
  canSetBudget: boolean;
}) {
  const isPast = viewMonth < currentMonth;
  const cut = cutoffDay(viewMonth, currentMonth, today, todayLogged);
  const monthDays = daysInMonth(viewMonth);
  const prevMonth = shiftMonth(viewMonth, -1);
  const lastYear = shiftMonth(viewMonth, -12);
  const prevDays = daysInMonth(prevMonth);
  const label = formatMonth(viewMonth).split(" ")[0];
  const prevLabel = formatMonth(prevMonth).split(" ")[0];

  const now = monthTotals(rows, viewMonth, cut, sprinters);
  const budgetTotal = budgetUnits(budget, sprinters);

  // Projected units the same way the New / Used cards round them: each
  // category on its own, then summed, so the two never disagree.
  const projected = isPast
    ? now.units
    : Math.round(projectMonthEnd(now.n, todayLogged)) +
      Math.round(projectMonthEnd(now.u, todayLogged)) +
      (sprinters ? Math.round(projectMonthEnd(now.s, todayLogged)) : 0);

  const daysLeft = isPast ? 0 : monthDays - cut;
  const toGo = budgetTotal - now.units;

  // Same point last month (capped to its length) and last year.
  const comparisons: { label: string; through: number; units: number; gross: number }[] = [];
  for (const m of [prevMonth, lastYear]) {
    if (cut === 0 || !hasMonth(rows, m)) continue;
    const through = Math.min(cut, daysInMonth(m));
    const t = monthTotals(rows, m, through, sprinters);
    comparisons.push({ label: formatMonth(m), through, units: t.units, gross: t.gross });
  }

  const tile =
    "break-inside-avoid rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[var(--surface)]";
  const tileLabel = "text-xs font-medium uppercase tracking-wide text-zinc-500";
  const tileValue = "mt-1 font-mono text-xl font-semibold tabular-nums";

  const versus = (diff: number) =>
    diff === 0 ? "on budget" : `${Math.abs(diff)} ${diff > 0 ? "over" : "under"} budget`;

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold">
        Pace
        <span className="ml-2 font-normal text-zinc-400">
          {isPast
            ? `${formatMonth(viewMonth)}, full month`
            : cut > 0
              ? `through the ${ordinal(cut)}`
              : "nothing logged yet this month"}
        </span>
      </h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className={tile}>
          <p className={tileLabel}>Budget</p>
          {budgetTotal > 0 ? (
            <>
              <p className={tileValue}>{budgetTotal} units</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                {budget!.new_units} new · {budget!.used_units} used
                {sprinters ? ` · ${budget!.sprinter_units} Sprinter` : ""}
              </p>
            </>
          ) : (
            <>
              <p className={`${tileValue} text-zinc-400`}>—</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                No budget set for {label}.{" "}
                {canSetBudget ? (
                  <Link
                    href={`/dealerships/${dealershipId}`}
                    className="font-medium text-blue-700 hover:underline dark:text-blue-400 print:hidden"
                  >
                    Set one
                  </Link>
                ) : null}
              </p>
            </>
          )}
        </div>

        <div className={tile}>
          <p className={tileLabel}>{isPast ? "Sold" : "Tracking"}</p>
          <p className={`${tileValue} ${isPast ? "" : "text-blue-700 dark:text-blue-400"}`}>
            {projected} units
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {budgetTotal > 0
              ? `${versus(projected - budgetTotal)}${
                  isPast ? ` · ${Math.round((projected / budgetTotal) * 100)}% of budget` : ""
                }`
              : isPast
                ? `${now.days} day${now.days === 1 ? "" : "s"} logged`
                : `${now.units} sold so far`}
          </p>
        </div>

        <div className={tile}>
          {isPast ? (
            <>
              <p className={tileLabel}>Gross per unit</p>
              <p className={tileValue}>
                {now.units > 0 ? formatCurrency(now.gross / now.units) : "—"}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">{formatCurrency(now.gross)} total</p>
            </>
          ) : budgetTotal > 0 && toGo > 0 && daysLeft > 0 ? (
            <>
              <p className={tileLabel}>Needed per day</p>
              <p className={tileValue}>{(toGo / daysLeft).toFixed(1)} units</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                {toGo} to go in {daysLeft} day{daysLeft === 1 ? "" : "s"}
                {cut > 0 ? ` · averaging ${(now.units / cut).toFixed(1)} so far` : ""}
              </p>
            </>
          ) : budgetTotal > 0 && toGo <= 0 ? (
            <>
              <p className={tileLabel}>Budget</p>
              <p className={tileValue}>Reached</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                {now.units} sold against {budgetTotal}
              </p>
            </>
          ) : (
            <>
              <p className={tileLabel}>Daily average</p>
              <p className={tileValue}>{cut > 0 ? (now.units / cut).toFixed(1) : "—"} units</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                {daysLeft} day{daysLeft === 1 ? "" : "s"} left in {label}
              </p>
            </>
          )}
        </div>
      </div>

      {comparisons.length ? (
        <ul className="mt-3 flex flex-col gap-2 sm:flex-row">
          {comparisons.map((c) => {
            const du = now.units - c.units;
            const dg = now.gross - c.gross;
            return (
              <li
                key={c.label}
                className="flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm dark:border-zinc-800 dark:bg-[var(--surface)]"
              >
                <p className="text-xs text-zinc-500">
                  vs {c.label}
                  {isPast ? ", full month" : `, same point (1st–${ordinal(c.through)})`}
                </p>
                <p className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <span>
                    <span className="font-mono font-semibold tabular-nums">{signed(du)}</span>{" "}
                    <span className="text-zinc-500">
                      units ({now.units} vs {c.units})
                    </span>
                  </span>
                  <span>
                    <span className="font-mono font-semibold tabular-nums">
                      {dg === 0 ? "$0" : `${dg > 0 ? "+" : "−"}${formatCurrency(Math.abs(dg))}`}
                    </span>{" "}
                    <span className="text-zinc-500">gross</span>
                  </span>
                </p>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[var(--surface)]">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Running units by day
        </p>
        <PaceChart
          monthLabel={label}
          previousLabel={prevLabel}
          daysInMonth={monthDays}
          current={cut > 0 ? cumulativeUnits(rows, viewMonth, cut, sprinters) : []}
          previous={hasMonth(rows, prevMonth) ? cumulativeUnits(rows, prevMonth, prevDays, sprinters) : []}
          budget={budgetTotal}
        />
      </div>
    </section>
  );
}
