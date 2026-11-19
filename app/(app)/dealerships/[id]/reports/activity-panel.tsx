import { formatMonth } from "@/lib/format";
import {
  cutoffDay,
  daysInMonth,
  hasMonth,
  monthTotals,
  shiftMonth,
  signed,
  type InsightDay,
} from "@/lib/insights";

/**
 * Dealership Insights → Calls & appointments. The two activity numbers stores
 * log every night, side by side with units sold — calls → appointments →
 * units sold — each against the same point last month and, once there's
 * that much history, the same month last year
 * month.
 */
export function ActivityPanel({
  viewMonth,
  currentMonth,
  today,
  todayLogged,
  sprinters,
  rows,
}: {
  viewMonth: string;
  currentMonth: string;
  today: string;
  todayLogged: boolean;
  sprinters: boolean;
  rows: InsightDay[];
}) {
  const isPast = viewMonth < currentMonth;
  const cut = cutoffDay(viewMonth, currentMonth, today, todayLogged);
  const prevMonth = shiftMonth(viewMonth, -1);
  const now = monthTotals(rows, viewMonth, cut, sprinters);
  const prev =
    cut > 0 && hasMonth(rows, prevMonth)
      ? monthTotals(rows, prevMonth, Math.min(cut, daysInMonth(prevMonth)), sprinters)
      : null;
  // The same month last year, once a store has that much history.
  const yearAgoMonth = shiftMonth(viewMonth, -12);
  const yearAgo =
    cut > 0 && hasMonth(rows, yearAgoMonth)
      ? monthTotals(rows, yearAgoMonth, Math.min(cut, daysInMonth(yearAgoMonth)), sprinters)
      : null;

  const nothing = now.calls === 0 && now.appts === 0;

  const steps: {
    label: string;
    value: number;
    prev: number | null;
    yearAgo: number | null;
  }[] = [
    { label: "Sales calls", value: now.calls, prev: prev?.calls ?? null, yearAgo: yearAgo?.calls ?? null },
    { label: "Appointments", value: now.appts, prev: prev?.appts ?? null, yearAgo: yearAgo?.appts ?? null },
    { label: "Units sold", value: now.units, prev: prev?.units ?? null, yearAgo: yearAgo?.units ?? null },
  ];

  const vsText = (v: number, p: number | null) =>
    p === null ? null : `${signed(v - p)} vs ${formatMonth(prevMonth).split(" ")[0]}`;
  const yearAgoText = (v: number, p: number | null) =>
    p === null ? null : `${signed(v - p)} vs ${formatMonth(yearAgoMonth)}`;

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold">
        Calls &amp; appointments
        <span className="ml-2 font-normal text-zinc-400">
          {isPast ? formatMonth(viewMonth) : cut > 0 ? "month to date" : "nothing logged yet this month"}
        </span>
      </h2>

      {nothing ? (
        <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No sales calls or appointments logged for {formatMonth(viewMonth)}
          {isPast ? "." : " yet."} They&apos;re entered with each night&apos;s numbers.
        </p>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[var(--surface)]">
          {/* Reads left to right on a wide screen and top to bottom on a
              phone. */}
          <ol className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            {steps.map((st, i) => (
              <li key={st.label} className="contents">
                <div className="flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{st.label}</p>
                  <p className="mt-1 font-mono text-xl font-semibold tabular-nums">
                    {st.value.toLocaleString("en-US")}
                  </p>
                  {vsText(st.value, st.prev) ? (
                    <p className="mt-0.5 text-xs text-zinc-500">{vsText(st.value, st.prev)}</p>
                  ) : null}
                  {yearAgoText(st.value, st.yearAgo) ? (
                    <p className="text-xs text-zinc-500">{yearAgoText(st.value, st.yearAgo)}</p>
                  ) : null}
                </div>
                {i < steps.length - 1 ? (
                  <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 shrink-0 rotate-90 self-start text-zinc-400 sm:rotate-0 sm:self-center" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
