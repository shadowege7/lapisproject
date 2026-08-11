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
