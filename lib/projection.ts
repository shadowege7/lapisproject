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
 */
export function projectMonthEnd(
  monthToDate: number,
  now: Date = new Date(),
): number {
  const { dayOfMonth, daysInMonth } = monthProgress(now);
  if (dayOfMonth <= 0) return monthToDate;
  return (monthToDate / dayOfMonth) * daysInMonth;
}
