import { formatMonth } from "@/lib/format";
import {
  cutoffDay,
  daysInMonth,
  hasMonth,
  monthTotals,
  rate,
  shiftMonth,
  signed,
  type InsightDay,
} from "@/lib/insights";

/**
 * Dealership Insights → Calls & appointments. The two activity numbers stores
 * log every night, turned into the funnel they describe: calls → appointments
 * → units sold, with the two rates between the steps and the same point last
 * month. Whether a slow month is a traffic problem or a closing problem shows
 * up here first.
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

  const apptRate = rate(now.appts, now.calls);
  const closeRate = rate(now.units, now.appts);
  const prevApptRate = prev ? rate(prev.appts, prev.calls) : null;
  const prevCloseRate = prev ? rate(prev.units, prev.appts) : null;

  const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v)}%`);
  const nothing = now.calls === 0 && now.appts === 0;

  const steps: {
    label: string;
    value: number;
    prev: number | null;
  }[] = [
    { label: "Sales calls", value: now.calls, prev: prev?.calls ?? null },
    { label: "Appointments", value: now.appts, prev: prev?.appts ?? null },
    { label: "Units sold", value: now.units, prev: prev?.units ?? null },
  ];
  const rates = [
    { label: "calls → appointments", value: apptRate, prev: prevApptRate },
    { label: "appointments → sold", value: closeRate, prev: prevCloseRate },
  ];

  const vsText = (v: number, p: number | null) =>
    p === null ? null : `${signed(v - p)} vs ${formatMonth(prevMonth).split(" ")[0]}`;

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
          {/* The funnel reads left to right on a wide screen and top to
              bottom on a phone; the rate sits between the two steps it
              connects. */}
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
                </div>
                {i < rates.length ? (
                  <div className="flex items-center gap-2 text-zinc-400 sm:flex-col sm:gap-0.5 sm:px-2 sm:text-center">
                    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 rotate-90 sm:rotate-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                    <span className="font-mono text-sm font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">
                      {pct(rates[i].value)}
                    </span>
                    <span className="text-[11px]">
                      {rates[i].prev !== null ? `${pct(rates[i].prev)} in ${formatMonth(prevMonth).split(" ")[0]}` : rates[i].label}
                    </span>
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-zinc-500">
            Rates: appointments ÷ calls, then units sold ÷ appointments — that one can top
            100%, since walk-in sales count as sold without an appointment.
            {prev ? ` Compared with ${formatMonth(prevMonth)} through the same day.` : ""}
          </p>
        </div>
      )}
    </section>
  );
}
