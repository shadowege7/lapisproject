import { monthProgress } from "@/lib/projection";

/**
 * How many days this month have gone by without an entry, shown beside the
 * store name.
 *
 * The elapsed count matches `projectMonthEnd`: today is only counted once its
 * numbers are in, because until then it is a day in progress rather than a day
 * someone missed. That keeps this figure and the projection describing the
 * same stretch of the month — a discrepancy between the two would be read as
 * one of them being wrong.
 *
 * `daysLogged` comes from `monthly_summary`, which counts rows in
 * `daily_entries`. A future date cannot be saved, so it can never exceed the
 * days elapsed; the clamp is there because a figure like "-1 missed" would
 * survive a bad month boundary silently, and zero does not.
 */
export function MissedEntries({
  daysLogged,
  todayLogged,
}: {
  daysLogged: number;
  todayLogged: boolean;
}) {
  const { dayOfMonth } = monthProgress();
  const elapsed = dayOfMonth - (todayLogged ? 0 : 1);
  const missed = Math.max(elapsed - daysLogged, 0);

  if (elapsed <= 0) return null;

  // Amber is this app's "needs attention" colour — the entry form's sanity
  // warnings and the dashboard's "Awaiting today" both use it. The count is
  // spelled out either way, so nothing here rests on the colour alone, which
  // also means it still reads on paper where the fill is stripped.
  const tone =
    missed > 0
      ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
      : "border-zinc-200 text-zinc-500 dark:border-zinc-800";

  return (
    <span
      className={`rounded-md border px-2 py-0.5 text-xs font-medium ${tone}`}
    >
      {missed === 0
        ? `All ${elapsed} days entered`
        : `${missed} of ${elapsed} days missing`}
    </span>
  );
}
