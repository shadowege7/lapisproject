// Month-to-date pace helpers. Uses UTC to match how entry dates are stored
// (see todayISODate in lib/format.ts).

export function monthProgress(now: Date = new Date()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const dayOfMonth = now.getUTCDate();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return { dayOfMonth, daysInMonth };
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
