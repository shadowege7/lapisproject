import { formatShortDay, weekdayIndex } from "@/lib/format";
import { Card } from "./table-chrome";

/** Just the columns this panel needs — see the query in `page.tsx`. */
export type WeekdayEntry = {
  entry_date: string;
  new_units: number;
  used_units: number;
  sprinter_units: number;
};

/** Sunday first, matching `weekdayIndex`, so the array indexes by its result. */
const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

type DayStat = {
  name: string;
  /** How many times this weekday has occurred in the span — the divisor. */
  occurrences: number;
  totalUnits: number;
  /** null only where the span is too short to contain this weekday at all. */
  average: number | null;
};

/**
 * How many times each weekday falls between two dates, inclusive, indexed the
 * way `weekdayIndex` indexes.
 *
 * Whole weeks contribute one of every day; the remainder adds one to each of
 * the days the span starts on. Counted rather than iterated so a long span
 * costs the same as a short one.
 */
function weekdayOccurrences(startISO: string, endISO: string): number[] {
  const at = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  const totalDays = Math.floor((at(endISO) - at(startISO)) / 86_400_000) + 1;
  if (totalDays <= 0) return new Array(7).fill(0);

  const counts = new Array<number>(7).fill(Math.floor(totalDays / 7));
  const firstDay = weekdayIndex(startISO);
  for (let i = 0; i < totalDays % 7; i += 1) counts[(firstDay + i) % 7] += 1;
  return counts;
}

/**
 * Which days of the week sell the most, averaged over calendar weeks.
 *
 * The denominator is how many times that weekday has *occurred*, not how many
 * entries exist for it — so a Sunday the store never logs reads as a genuine
 * zero-selling day rather than as unknown, and a missing entry lowers the
 * average rather than vanishing from it.
 *
 * The span runs from the store's first entry to today, not from the edge of
 * the query window. Dividing a month of trading by fifty-two weeks would put
 * every average near zero and rank noise.
 *
 * All three vehicle categories are counted. Sprinter units are zero at a store
 * that does not sell them, so no flag is needed to leave them out.
 */
export function WeekdayPanel({
  entries,
  today,
}: {
  entries: WeekdayEntry[];
  /** Today in the app's time zone — the end of the averaging span. */
  today: string;
}) {
  const units = new Array<number>(7).fill(0);
  let firstEntry: string | null = null;

  for (const entry of entries) {
    units[weekdayIndex(entry.entry_date)] +=
      entry.new_units + entry.used_units + entry.sprinter_units;
    if (firstEntry === null || entry.entry_date < firstEntry) {
      firstEntry = entry.entry_date;
    }
  }

  const occurrences = firstEntry
    ? weekdayOccurrences(firstEntry, today)
    : new Array<number>(7).fill(0);

  const stats: DayStat[] = DAY_NAMES.map((name, i) => ({
    name,
    occurrences: occurrences[i],
    totalUnits: units[i],
    average: occurrences[i] > 0 ? units[i] / occurrences[i] : null,
  }));

  // Best first. A weekday the span is too short to contain has no average at
  // all and sorts last rather than tying with a genuine zero.
  const ranked = [...stats].sort((a, b) => {
    if (a.average === null) return b.average === null ? 0 : 1;
    if (b.average === null) return -1;
    return b.average - a.average;
  });

  const best = ranked[0]?.average ?? 0;
  const totalDays = occurrences.reduce((sum, n) => sum + n, 0);
  // Days in the span with nothing entered. They count as zero, which is the
  // point of averaging over calendar weeks — but it is worth saying so, since
  // a store that simply stopped logging looks like one that stopped selling.
  const gaps = totalDays - entries.length;

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold">
        Best days to sell
        <span className="ml-2 font-normal text-zinc-400">
          {totalDays === 0 || !firstEntry
            ? "no history yet"
            : `averaged over calendar weeks since ${formatShortDay(firstEntry)}`}
        </span>
      </h2>

      {totalDays === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 px-4 py-8 text-center dark:border-zinc-700">
          <p className="text-sm font-medium">Nothing to rank yet.</p>
          <p className="mt-1 text-sm text-zinc-500">
            Once a few weeks of daily numbers are in, this shows which days of
            the week sell the most.
          </p>
        </div>
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                <th scope="col" className="py-2.5 pr-4 font-medium">
                  Day
                </th>
                {/* The bar is a visual restatement of the average beside it,
                    so it is not a column a screen reader should announce. */}
                <th aria-hidden="true" className="py-2.5 pr-4" />
                <th scope="col" className="py-2.5 pr-4 text-right font-medium">
                  Avg units
                </th>
                <th scope="col" className="py-2.5 pr-4 text-right font-medium">
                  Total units
                </th>
                <th scope="col" className="py-2.5 text-right font-medium">
                  Days
                </th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((day, index) => (
                <tr
                  key={day.name}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
                >
                  <td className="py-2 pr-4">
                    <span className="mr-2 font-mono tabular-nums text-zinc-400">
                      {day.average === null ? "–" : index + 1}
                    </span>
                    {day.name}
                  </td>
                  <td className="w-1/3 py-2 pr-4">
                    <Bar value={day.average} max={best} />
                  </td>
                  <td className="py-2 pr-4 text-right font-mono tabular-nums font-medium">
                    {day.average === null ? (
                      <>
                        <span aria-hidden="true">—</span>
                        <span className="sr-only">
                          not available, this day has not come round yet
                        </span>
                      </>
                    ) : (
                      day.average.toFixed(1)
                    )}
                  </td>
                  <td className="py-2 pr-4 text-right font-mono tabular-nums text-[var(--figure-muted)]">
                    {day.totalUnits}
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums text-[var(--figure-muted)]">
                    {day.occurrences}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {gaps > 0 ? (
        <p className="mt-2 text-xs text-zinc-500">
          {gaps} of these {totalDays} days {gaps === 1 ? "has" : "have"} no
          entry and {gaps === 1 ? "counts" : "count"} as zero.
        </p>
      ) : null}
    </section>
  );
}

/**
 * The proportional bar beside each average.
 *
 * Outlined rather than solid: the print block in `app/globals.css` forces
 * `background: transparent` on every element, so a filled bar is simply gone
 * on paper, while a border is only recoloured. The number beside it carries
 * the value regardless — the bar is there to make the ranking scannable, and
 * nothing depends on it alone.
 */
function Bar({ value, max }: { value: number | null; max: number }) {
  if (value === null || max <= 0) return null;
  // A weekday that sells but rounds to nothing still gets a visible sliver,
  // so "logged but slow" cannot be mistaken for "never logged".
  const width = Math.max((value / max) * 100, value > 0 ? 2 : 0);
  return (
    <span
      aria-hidden="true"
      className="block h-2 rounded-sm border border-blue-700 bg-blue-100 dark:border-blue-400 dark:bg-blue-900/40"
      style={{ width: `${width}%` }}
    />
  );
}
