/**
 * Arithmetic behind the Dealership Insights pace panel, activity panel and
 * monthly trend lines. Pure functions over daily rows, so the page fetches
 * once and every section agrees.
 *
 * "Same point" comparisons: a month in progress is compared with earlier
 * months through the same day of the month. The cut-off is the last day whose
 * numbers are in — today once it's logged, otherwise yesterday — which is the
 * same rule the month-end projection uses.
 */

export interface InsightDay {
  entry_date: string;
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
}

export interface PeriodTotals {
  n: number;
  u: number;
  s: number;
  units: number;
  gross: number;
  calls: number;
  appts: number;
  days: number;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

export function daysInMonth(monthStart: string): number {
  const [y, m] = monthStart.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** The first of the month `delta` months from `monthStart`. */
export function shiftMonth(monthStart: string, delta: number): string {
  const [y, m] = monthStart.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-01`;
}

export const dayOfMonth = (iso: string) => Number(iso.slice(8, 10));

/** Gross for a day, Sprinter included only where the store tracks it. */
export function dayGross(d: InsightDay, sprinters: boolean): number {
  return (
    Number(d.new_front_end_gross) +
    Number(d.new_back_end_gross) +
    Number(d.used_front_end_gross) +
    Number(d.used_back_end_gross) +
    (sprinters ? Number(d.sprinter_front_end_gross) + Number(d.sprinter_back_end_gross) : 0)
  );
}

export function dayUnits(d: InsightDay, sprinters: boolean): number {
  return d.new_units + d.used_units + (sprinters ? d.sprinter_units : 0);
}

/**
 * Totals for one month's rows from day 1 through `throughDay` (inclusive).
 * Rows outside the month are ignored, so callers can pass a wider fetch.
 */
export function monthTotals(
  rows: InsightDay[],
  monthStart: string,
  throughDay: number,
  sprinters: boolean,
): PeriodTotals {
  const prefix = monthStart.slice(0, 7);
  const t: PeriodTotals = { n: 0, u: 0, s: 0, units: 0, gross: 0, calls: 0, appts: 0, days: 0 };
  for (const d of rows) {
    if (!d.entry_date.startsWith(prefix) || dayOfMonth(d.entry_date) > throughDay) continue;
    t.n += d.new_units;
    t.u += d.used_units;
    t.s += sprinters ? d.sprinter_units : 0;
    t.gross += dayGross(d, sprinters);
    t.calls += d.sales_calls ?? 0;
    t.appts += d.appointments ?? 0;
    t.days += 1;
  }
  t.units = t.n + t.u + t.s;
  return t;
}

/** Whether any row falls in the given month — "do we have data for it". */
export function hasMonth(rows: InsightDay[], monthStart: string): boolean {
  const prefix = monthStart.slice(0, 7);
  return rows.some((d) => d.entry_date.startsWith(prefix));
}

/**
 * Running unit total for each day of a month, from day 1 to `throughDay`.
 * Index 0 is day 1. Days with no entry carry the previous total.
 */
export function cumulativeUnits(
  rows: InsightDay[],
  monthStart: string,
  throughDay: number,
  sprinters: boolean,
): number[] {
  const prefix = monthStart.slice(0, 7);
  const perDay = new Array<number>(throughDay).fill(0);
  for (const d of rows) {
    if (!d.entry_date.startsWith(prefix)) continue;
    const day = dayOfMonth(d.entry_date);
    if (day >= 1 && day <= throughDay) perDay[day - 1] += dayUnits(d, sprinters);
  }
  let run = 0;
  return perDay.map((v) => (run += v));
}

/**
 * The last day of the viewed month whose numbers are in: the whole month for a
 * finished month; for the current one, today once logged, else yesterday.
 * 0 means nothing has elapsed yet (the 1st, before it's logged).
 */
export function cutoffDay(
  viewMonth: string,
  currentMonth: string,
  today: string,
  todayLogged: boolean,
): number {
  if (viewMonth < currentMonth) return daysInMonth(viewMonth);
  return dayOfMonth(today) - (todayLogged ? 0 : 1);
}

/** The store's budget as a unit count, Sprinters only where tracked. */
export function budgetUnits(
  b: { new_units: number; used_units: number; sprinter_units: number } | null | undefined,
  sprinters: boolean,
): number {
  if (!b) return 0;
  return b.new_units + b.used_units + (sprinters ? b.sprinter_units : 0);
}

/** "+6", "−3", "0" — a signed whole-number change with a true minus sign. */
export function signed(n: number, digits = 0): string {
  const v = Number(n.toFixed(digits));
  if (v === 0) return "0";
  return `${v > 0 ? "+" : "−"}${Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

/** A share as a whole percent, or null where the base is zero. */
export function rate(part: number, whole: number): number | null {
  return whole > 0 ? (part / whole) * 100 : null;
}
