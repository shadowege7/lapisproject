// Month-to-date pace helpers. Uses the app's time zone (Pacific) so the pace
// matches how "today" and month boundaries are computed (see lib/format.ts).
import { datePartsInAppTZ } from "@/lib/format";

export function monthProgress(now: Date = new Date()) {
  const { year, month, day } = datePartsInAppTZ(now);
  // month is 1-12, so Date.UTC(year, month, 0) is the last day of that month.
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { dayOfMonth: day, daysInMonth };
}

/**
 * Projects a month-to-date running total to end of month, assuming the current
 * daily pace holds for the rest of the month.
 *
 * The pace is the running total spread over the days that have actually
 * elapsed. `todayLogged` says whether today's numbers are in yet: until they
 * are, today is an in-progress day with no entry, so counting it in the divisor
 * would divide the month-to-date (which stops at yesterday) across one day too
 * many and understate the projection. Once today is entered, it counts.
 */
export function projectMonthEnd(
  monthToDate: number,
  todayLogged: boolean,
  now: Date = new Date(),
): number {
  const { dayOfMonth, daysInMonth } = monthProgress(now);
  const daysElapsed = dayOfMonth - (todayLogged ? 0 : 1);
  if (daysElapsed <= 0) return monthToDate;
  return (monthToDate / daysElapsed) * daysInMonth;
}

const dayNumber = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
};

/**
 * Where a running total is tracking to by `periodEnd`, at its current daily
 * pace. The same rule as projectMonthEnd, generalised to any span: the pace is
 * the total over the days elapsed since `windowFrom` (today counts once its
 * numbers are in), stretched across `windowFrom` → `periodEnd`.
 *
 * `windowFrom` is usually the 1st of the month or year; it is later when
 * salesperson tracking was switched on partway through, so someone isn't
 * projected over days they couldn't have been credited for.
 */
export function projectToPeriodEnd(
  total: number,
  windowFrom: string,
  periodEnd: string,
  today: string,
  todayLogged: boolean,
): number {
  const elapsed = dayNumber(today) - dayNumber(windowFrom) + (todayLogged ? 1 : 0);
  const span = dayNumber(periodEnd) - dayNumber(windowFrom) + 1;
  if (elapsed <= 0 || span <= elapsed) return total;
  return (total / elapsed) * span;
}
