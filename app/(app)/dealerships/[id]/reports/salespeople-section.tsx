import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  datePartsInAppTZ,
  formatCurrency,
  formatMonth,
  formatShortDay,
  monthEndISODate,
  todayISODate,
} from "@/lib/format";
import { projectToPeriodEnd } from "@/lib/projection";
import {
  byName,
  formatUnits,
  periodRange,
  salespersonInitials,
  salespersonName,
  type RosterPerson,
  type SalespersonPeriod,
  type SalespersonRank,
} from "@/lib/salespeople";
import {
  addSalesperson,
  renameSalesperson,
  setSalespersonActive,
} from "./salespeople-actions";
import { Card } from "./table-chrome";

const PERIODS: [SalespersonPeriod, string][] = [
  ["today", "Today"],
  ["mtd", "Month"],
  ["ytd", "Year"],
];
const RANKS: [SalespersonRank, string][] = [
  ["units", "Units"],
  ["gross", "Gross"],
];

type Figures = { n: number; u: number; s: number; front: number; back: number };
const units = (f: Figures) => f.n + f.u + f.s;
const gross = (f: Figures) => f.front + f.back;

/**
 * Dealership Insights → Salespeople. Rendered only for stores an admin has
 * switched on. Server-rendered throughout: the period, ranking and roster
 * panel are links and forms, so it works before (or without) JavaScript.
 *
 * Store totals for the "Unassigned" line are taken from the store's own
 * daily_entries, but only from the day tracking started (or the earliest
 * backfilled salesperson day, if sooner) — otherwise a store that turned this
 * on mid-year would show months of sales as unassigned, and a backfill would
 * show negative unassigned.
 */
export async function SalespeopleSection({
  dealershipId,
  sprinters,
  trackedSince,
  period,
  rank,
  month,
  canEdit,
  manageOpen,
  editingId,
  error,
  done,
}: {
  dealershipId: string;
  sprinters: boolean;
  trackedSince: string | null;
  period: SalespersonPeriod;
  rank: SalespersonRank;
  /** A past month opened from the Monthly table. Replaces the period picker. */
  month?: { from: string; to: string };
  canEdit: boolean;
  manageOpen: boolean;
  /** Roster row whose name form is open (?edit=<id>). */
  editingId?: string;
  error?: string;
  done?: string;
}) {
  const supabase = await createClient();
  const { from, to } = month ?? periodRange(period);

  const [{ data: roster }, { data: totals }, { data: storeDays }, { data: firstLogged }] = await Promise.all([
    supabase
      .from("salespeople")
      .select("id, first_name, last_name, is_active, removed_at")
      .eq("dealership_id", dealershipId),
    supabase.rpc("salesperson_totals", {
      p_dealership: dealershipId,
      p_from: from,
      p_to: to,
    }),
    // At most a year of rows, inside PostgREST's 1,000-row page.
    supabase
      .from("daily_entries")
      .select(
        "entry_date, new_units, used_units, sprinter_units, new_front_end_gross, new_back_end_gross, used_front_end_gross, used_back_end_gross, sprinter_front_end_gross, sprinter_back_end_gross",
      )
      .eq("dealership_id", dealershipId)
      .gte("entry_date", from)
      .lte("entry_date", to),
    // Earliest salesperson day in the period. Days logged before the switch
    // was turned on (a backfill) still count as tracked.
    supabase
      .from("salesperson_daily_entries")
      .select("entry_date")
      .eq("dealership_id", dealershipId)
      .gte("entry_date", from)
      .lte("entry_date", to)
      .order("entry_date", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  // Store totals count from whichever is first: the day tracking was switched
  // on, or the earliest day anyone logged salesperson numbers for.
  let windowFrom = trackedSince && trackedSince > from ? trackedSince : from;
  if (firstLogged?.entry_date && firstLogged.entry_date < windowFrom) {
    windowFrom = firstLogged.entry_date;
  }

  const people = ((roster ?? []) as RosterPerson[]).slice().sort(byName);
  const byPerson = new Map<string, Figures>(
    (totals ?? []).map((t) => [
      t.salesperson_id,
      {
        n: Number(t.new_units),
        u: Number(t.used_units),
        s: Number(t.sprinter_units),
        front: Number(t.front_end_gross),
        back: Number(t.back_end_gross),
      },
    ]),
  );

  const store: Figures = { n: 0, u: 0, s: 0, front: 0, back: 0 };
  for (const d of storeDays ?? []) {
    if (d.entry_date < windowFrom) continue;
    store.n += d.new_units;
    store.u += d.used_units;
    store.s += d.sprinter_units;
    store.front += Number(d.new_front_end_gross) + Number(d.used_front_end_gross) + Number(d.sprinter_front_end_gross);
    store.back += Number(d.new_back_end_gross) + Number(d.used_back_end_gross) + Number(d.sprinter_back_end_gross);
  }

  const team: Figures = { n: 0, u: 0, s: 0, front: 0, back: 0 };
  for (const f of byPerson.values()) {
    team.n += f.n;
    team.u += f.u;
    team.s += f.s;
    team.front += f.front;
    team.back += f.back;
  }
  const unassigned: Figures = {
    n: store.n - team.n,
    u: store.u - team.u,
    s: store.s - team.s,
    front: store.front - team.front,
    back: store.back - team.back,
  };

  // Unassigned can't really be below zero: it means someone was credited with
  // more units than the store sold, which is a typo somewhere in the period.
  const overCredited = (
    [
      ["new", team.n, store.n],
      ["used", team.u, store.u],
      ["Sprinter", team.s, store.s],
    ] as const
  )
    .filter(([, people, total]) => people > total)
    .map(([label, people, total]) => `${formatUnits(people)} ${label} vs ${formatUnits(total)}`);

  const zero: Figures = { n: 0, u: 0, s: 0, front: 0, back: 0 };
  const rows = people
    .map((p) => ({ p, f: byPerson.get(p.id) ?? zero }))
    // Removed people stay on the board for any period they sold in.
    .filter(({ p, f }) => p.is_active || units(f) !== 0 || gross(f) !== 0)
    .sort((a, b) =>
      rank === "gross"
        ? gross(b.f) - gross(a.f) || units(b.f) - units(a.f)
        : units(b.f) - units(a.f) || gross(b.f) - gross(a.f),
    );
  const max = Math.max(1, ...rows.map(({ f }) => (rank === "gross" ? gross(f) : units(f))));
  const storeUnits = units(store);

  const mix = (f: Figures) =>
    [
      `${formatUnits(f.n)} new`,
      `${formatUnits(f.u)} used`,
      ...(sprinters ? [`${formatUnits(f.s)} Sprinter`] : []),
    ].join(" · ");
  // Tracking: where each line is heading by the end of the month (or year) at
  // its current pace, in whatever the board is ranked by. Nothing to project
  // for a single day or a finished month, so the column only shows for this
  // month and this year.
  const today = todayISODate();
  const periodEnd =
    !month && period === "mtd"
      ? monthEndISODate(from)
      : !month && period === "ytd"
        ? `${from.slice(0, 4)}-12-31`
        : null;
  const todayLogged = (storeDays ?? []).some((d) => d.entry_date === today);
  const project = (value: number) =>
    periodEnd ? projectToPeriodEnd(value, windowFrom, periodEnd, today, todayLogged) : value;
  // New, used and Sprinter are projected and rounded one by one, and the unit
  // total is their sum, so the line always adds up and the store's figures
  // match the "projected" counts on the New and Used cards above.
  const tracked = (f: Figures) => {
    const n = Math.round(project(f.n));
    const u = Math.round(project(f.u));
    const sp = sprinters ? Math.round(project(f.s)) : 0;
    return { n, u, s: sp, units: n + u + sp, gross: Math.round(project(gross(f))) };
  };
  const tracking = (f: Figures) => {
    if (!periodEnd) return "—";
    const t = tracked(f);
    return rank === "gross" ? money(t.gross) : String(t.units);
  };
  const trackingMix = (f: Figures) => {
    const t = tracked(f);
    return [`${t.n} new`, `${t.u} used`, ...(sprinters ? [`${t.s} Sprinter`] : [])].join(" · ");
  };
  const trackingLabel = rank === "gross" ? "gross" : "units";
  const pvr = (f: Figures) => (units(f) ? formatCurrency(gross(f) / units(f)) : "—");
  const money = (n: number) => (n ? formatCurrency(n) : "—");

  const href = (next: {
    sp?: SalespersonPeriod;
    rank?: SalespersonRank;
    manage?: boolean;
    edit?: string;
  }) => {
    const q = new URLSearchParams();
    const p = next.sp ?? period;
    const r = next.rank ?? rank;
    const m = next.manage ?? manageOpen;
    if (p !== "mtd") q.set("sp", p);
    if (r !== "units") q.set("rank", r);
    if (m) q.set("manage", "1");
    if (month) q.set("month", month.from.slice(0, 7));
    if (next.edit) q.set("edit", next.edit);
    const qs = q.toString();
    return `/dealerships/${dealershipId}/reports${qs ? `?${qs}` : ""}#salespeople`;
  };

  const periodLabel = month
    ? formatMonth(month.from)
    : period === "today"
      ? `Today · ${formatShortDay(to)}`
      : period === "mtd"
        ? "Month to date"
        : "Year to date";
  const partialWindow = windowFrom !== from;

  const desktopCols = periodEnd
    ? "grid-cols-[1.5rem_minmax(9rem,1.5fr)_minmax(9rem,1.5fr)_repeat(3,minmax(5rem,0.85fr))_minmax(4rem,0.6fr)_minmax(7.5rem,0.9fr)]"
    : "grid-cols-[1.5rem_minmax(9rem,1.5fr)_minmax(9rem,1.5fr)_repeat(3,minmax(5rem,0.85fr))_minmax(4rem,0.6fr)]";

  return (
    <section id="salespeople" aria-labelledby="salespeople-h" className="scroll-mt-20">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="salespeople-h" className="text-sm font-semibold">
            Salespeople
          </h2>
          <p className="text-xs text-zinc-500">{periodLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {month ? null : (
            <Segmented label="Period">
              {PERIODS.map(([value, text]) => (
                <SegLink key={value} href={href({ sp: value })} active={period === value}>
                  {text}
                </SegLink>
              ))}
            </Segmented>
          )}
          <Segmented label="Rank by">
            <span className="px-1.5 text-xs text-zinc-500">Rank by</span>
            {RANKS.map(([value, text]) => (
              <SegLink key={value} href={href({ rank: value })} active={rank === value}>
                {text}
              </SegLink>
            ))}
          </Segmented>
          {canEdit ? (
            <Link
              href={href({ manage: !manageOpen })}
              aria-expanded={manageOpen}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-zinc-300 px-3 text-sm font-semibold text-zinc-700 transition-colors hover:border-blue-400 hover:text-blue-700 dark:border-zinc-700 dark:text-zinc-200 dark:hover:text-blue-400"
            >
              {manageOpen ? "Done" : "Manage salespeople"}
            </Link>
          ) : null}
        </div>
      </div>

      {error ? (
        <p role="alert" className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : done ? (
        <p role="status" className="mb-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          {done}
        </p>
      ) : null}

      {overCredited.length ? (
        <p role="alert" className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Salespeople add up to more units than the store for this period (
          {overCredited.join("; ")}). A salesperson number was probably mistyped —
          check the Daily table for a day where someone has more units than the store.
        </p>
      ) : null}

      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-[999_1_38rem]">
          {rows.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No salespeople on the roster yet.
              {canEdit ? " Use Manage salespeople to add them." : ""}
            </p>
          ) : (
            <Card flush>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto sm:block">
                <div className="min-w-[48rem] text-sm">
                  <div className={`grid ${desktopCols} gap-3 border-b border-zinc-200 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800`}>
                    <span>#</span>
                    <span>Salesperson</span>
                    <span>Units</span>
                    <span className="text-right">Front</span>
                    <span className="text-right">Back</span>
                    <span className="text-right">Gross</span>
                    <span className="text-right">PVR</span>
                    {periodEnd ? (
                      <span
                        className="text-right text-blue-700 dark:text-blue-400"
                        title={`Projected ${trackingLabel} by ${period === "ytd" ? "year" : "month"} end at the current pace`}
                      >
                        Tracking
                      </span>
                    ) : null}
                  </div>
                  {rows.map(({ p, f }, i) => {
                    const value = rank === "gross" ? gross(f) : units(f);
                    const idle = units(f) === 0 && gross(f) === 0;
                    return (
                      <div
                        key={p.id}
                        className={`grid ${desktopCols} items-center gap-3 border-b border-zinc-100 px-4 py-2.5 dark:border-zinc-900 ${idle ? "opacity-60" : ""}`}
                      >
                        <span className="font-mono text-xs text-zinc-500">{i + 1}</span>
                        <span className="flex min-w-0 items-center gap-2">
                          <Avatar person={p} />
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{salespersonName(p)}</span>
                            {!p.is_active ? <RemovedChip on={p.removed_at} /> : null}
                          </span>
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-2">
                            <span className="w-9 font-mono font-semibold tabular-nums">{formatUnits(units(f))}</span>
                            <Bar pct={(value / max) * 100} />
                          </span>
                          <span className="block truncate text-xs text-zinc-500">{mix(f)}</span>
                        </span>
                        <span className="text-right font-mono tabular-nums">{money(f.front)}</span>
                        <span className="text-right font-mono tabular-nums">{money(f.back)}</span>
                        <span className="text-right font-mono font-semibold tabular-nums">{money(gross(f))}</span>
                        <span className="text-right font-mono tabular-nums text-zinc-500">{pvr(f)}</span>
                        {periodEnd ? (
                          <span className="text-right">
                            <span className="block font-mono font-semibold tabular-nums text-blue-700 dark:text-blue-400">
                              {tracking(f)}
                            </span>
                            <span className="block whitespace-nowrap text-xs text-zinc-500">{trackingMix(f)}</span>
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                  <div className={`grid ${desktopCols} items-center gap-3 border-b border-zinc-200 px-4 py-2.5 text-zinc-500 dark:border-zinc-800`}>
                    <span />
                    <span className="italic">Unassigned</span>
                    <span>
                      <span className="font-mono tabular-nums">{formatUnits(units(unassigned))}</span>
                      <span className="block text-xs">house, fleet, manager deals</span>
                    </span>
                    <span className="text-right font-mono tabular-nums">{money(unassigned.front)}</span>
                    <span className="text-right font-mono tabular-nums">{money(unassigned.back)}</span>
                    <span className="text-right font-mono tabular-nums">{money(gross(unassigned))}</span>
                    <span className="text-right">—</span>
                    {periodEnd ? (
                      <span className="text-right">
                        <span className="block font-mono tabular-nums">{tracking(unassigned)}</span>
                        <span className="block whitespace-nowrap text-xs">{trackingMix(unassigned)}</span>
                      </span>
                    ) : null}
                  </div>
                  <div className={`grid ${desktopCols} items-center gap-3 px-4 py-3 font-semibold`}>
                    <span />
                    <span>Store total</span>
                    <span>
                      <span className="font-mono tabular-nums">{formatUnits(storeUnits)}</span>
                      <span className="block text-xs font-normal text-zinc-500">{mix(store)}</span>
                    </span>
                    <span className="text-right font-mono tabular-nums">{formatCurrency(store.front)}</span>
                    <span className="text-right font-mono tabular-nums">{formatCurrency(store.back)}</span>
                    <span className="text-right font-mono tabular-nums">{formatCurrency(gross(store))}</span>
                    <span className="text-right font-mono tabular-nums">{pvr(store)}</span>
                    {periodEnd ? (
                      <span className="text-right">
                        <span className="block font-mono tabular-nums text-blue-700 dark:text-blue-400">
                          {tracking(store)}
                        </span>
                        <span className="block whitespace-nowrap text-xs font-normal text-zinc-500">
                          {trackingMix(store)}
                        </span>
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Phone list */}
              <ol className="sm:hidden">
                {rows.map(({ p, f }, i) => {
                  const value = rank === "gross" ? gross(f) : units(f);
                  const idle = units(f) === 0 && gross(f) === 0;
                  return (
                    <li
                      key={p.id}
                      className={`flex flex-col gap-2 border-b border-zinc-100 px-3.5 py-3 dark:border-zinc-900 ${idle ? "opacity-60" : ""}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-4 font-mono text-xs text-zinc-500">{i + 1}</span>
                        <Avatar person={p} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{salespersonName(p)}</span>
                          <span className="block text-xs text-zinc-500">{mix(f)}</span>
                          {!p.is_active ? <RemovedChip on={p.removed_at} /> : null}
                        </span>
                        <span className="text-right">
                          <span className="block font-mono text-base font-semibold tabular-nums">
                            {rank === "gross" ? money(gross(f)) : formatUnits(units(f))}
                          </span>
                          <span className="block text-[11px] text-zinc-500">{rank === "gross" ? "gross" : "units"}</span>
                          {periodEnd ? (
                            <span className="mt-2 block border-t border-zinc-200 pt-1.5 dark:border-zinc-700">
                              <span className="block text-[11px] font-semibold text-blue-700 dark:text-blue-400">
                                Tracking {tracking(f)}
                              </span>
                              <span className="block text-[11px] text-zinc-500">{trackingMix(f)}</span>
                            </span>
                          ) : null}
                        </span>
                      </div>
                      <div className="ml-6">
                        <Bar pct={(value / max) * 100} />
                      </div>
                      <dl className="ml-6 grid grid-cols-4 gap-1.5 text-[11px] text-zinc-500">
                        <MiniStat label="Front" value={money(f.front)} />
                        <MiniStat label="Back" value={money(f.back)} />
                        <MiniStat
                          label={rank === "gross" ? "Units" : "Gross"}
                          value={rank === "gross" ? formatUnits(units(f)) : money(gross(f))}
                        />
                        <MiniStat label="PVR" value={pvr(f)} />
                      </dl>
                    </li>
                  );
                })}
                <li className="flex items-center gap-2 border-b border-zinc-200 px-3.5 py-3 text-zinc-500 dark:border-zinc-800">
                  <span className="flex-1">
                    <span className="block text-sm italic">Unassigned</span>
                    <span className="block text-[11px]">house, fleet, manager deals</span>
                  </span>
                  <span className="text-right font-mono text-sm tabular-nums">
                    <span className="block">{formatUnits(units(unassigned))} units</span>
                    <span className="block">{money(gross(unassigned))}</span>
                  </span>
                </li>
                <li className="flex items-center gap-2 px-3.5 py-3 font-semibold">
                  <span className="flex-1">
                    <span className="block text-sm">Store total</span>
                    <span className="block text-xs font-normal text-zinc-500">{mix(store)}</span>
                  </span>
                  <span className="text-right font-mono tabular-nums">
                    <span className="block">{formatUnits(storeUnits)} units</span>
                    <span className="block text-sm">{formatCurrency(gross(store))}</span>
                    {periodEnd ? (
                      <span className="mt-2 block border-t border-zinc-200 pt-1.5 dark:border-zinc-700">
                        <span className="block text-[11px] text-blue-700 dark:text-blue-400">
                          Tracking {tracking(store)}
                          {rank === "gross" ? "" : " units"}
                        </span>
                        <span className="block text-[11px] font-normal">{trackingMix(store)}</span>
                      </span>
                    ) : null}
                  </span>
                </li>
              </ol>
            </Card>
          )}
          {partialWindow && trackedSince ? (
            <p className="mt-2 text-xs text-zinc-500">
              Store total and Unassigned count from {formatShortDay(trackedSince)}, when
              salesperson tracking started here.
            </p>
          ) : null}
        </div>

        {canEdit && manageOpen ? (
          <aside
            aria-labelledby="manage-h"
            className="order-first w-full rounded-xl border border-zinc-200 bg-white p-4 lg:order-none lg:w-auto lg:flex-[1_1_18rem] dark:border-zinc-800 dark:bg-[var(--surface)] print:hidden"
          >
            <h3 id="manage-h" className="text-sm font-semibold">
              Manage salespeople
            </h3>
            <p className="mt-0.5 text-xs text-zinc-500">
              Changes show on the entry form right away.
            </p>

            <form action={addSalesperson} className="mt-4 flex flex-col gap-2">
              <input type="hidden" name="dealership_id" value={dealershipId} />
              <input type="hidden" name="sp" value={period} />
              <input type="hidden" name="rank" value={rank} />
              {month ? <input type="hidden" name="month" value={month.from.slice(0, 7)} /> : null}
              <span className="text-xs font-semibold">Add a salesperson</span>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-xs text-zinc-500">
                  First name
                  <input
                    name="first_name"
                    required
                    maxLength={60}
                    autoComplete="off"
                    className="min-w-0 rounded-md border border-zinc-300 bg-transparent px-2.5 py-2 text-base text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 sm:text-sm dark:border-zinc-700 dark:text-zinc-50"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-zinc-500">
                  Last name
                  <input
                    name="last_name"
                    maxLength={60}
                    autoComplete="off"
                    className="min-w-0 rounded-md border border-zinc-300 bg-transparent px-2.5 py-2 text-base text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 sm:text-sm dark:border-zinc-700 dark:text-zinc-50"
                  />
                </label>
              </div>
              <button
                type="submit"
                className="min-h-10 w-full rounded-md btn-primary px-3 text-sm font-semibold sm:w-fit"
              >
                Add to roster
              </button>
            </form>

            <RosterList
              title="On the roster"
              people={people.filter((p) => p.is_active)}
              dealershipId={dealershipId}
              period={period}
              rank={rank}
              month={month?.from.slice(0, 7)}
              makeActive={false}
              editingId={editingId}
              editHref={(id) => href({ manage: true, edit: id })}
              closeHref={href({ manage: true })}
            />
            <RosterList
              title="Removed"
              people={people.filter((p) => !p.is_active)}
              dealershipId={dealershipId}
              period={period}
              rank={rank}
              month={month?.from.slice(0, 7)}
              makeActive
              editingId={editingId}
              editHref={(id) => href({ manage: true, edit: id })}
              closeHref={href({ manage: true })}
            />

            <p className="mt-4 text-xs text-zinc-500">
              Removing someone keeps every number they&apos;ve logged, so month
              and year totals don&apos;t change. They just stop appearing on
              the entry form.
            </p>
          </aside>
        ) : null}
      </div>
    </section>
  );
}

function RosterList({
  title,
  people,
  dealershipId,
  period,
  rank,
  month,
  makeActive,
  editingId,
  editHref,
  closeHref,
}: {
  title: string;
  people: RosterPerson[];
  dealershipId: string;
  period: SalespersonPeriod;
  rank: SalespersonRank;
  /** YYYY-MM when the page is showing a past month, so actions return there. */
  month?: string;
  makeActive: boolean;
  editingId?: string;
  editHref: (id: string) => string;
  closeHref: string;
}) {
  if (people.length === 0 && makeActive) return null;
  const hidden = (
    <>
      <input type="hidden" name="dealership_id" value={dealershipId} />
      <input type="hidden" name="sp" value={period} />
      <input type="hidden" name="rank" value={rank} />
      {month ? <input type="hidden" name="month" value={month} /> : null}
    </>
  );
  const field =
    "min-w-0 rounded-md border border-zinc-300 bg-transparent px-2.5 py-2 text-base text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 sm:text-sm dark:border-zinc-700 dark:text-zinc-50";
  const smallButton =
    "inline-flex min-h-9 items-center rounded-md border border-zinc-300 px-2.5 text-xs font-semibold text-zinc-700 hover:border-blue-400 hover:text-blue-700 dark:border-zinc-700 dark:text-zinc-200 dark:hover:text-blue-400";
  return (
    <div className="mt-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        {title} · {people.length}
      </p>
      {people.length === 0 ? (
        <p className="mt-1 text-sm text-zinc-500">Nobody yet.</p>
      ) : (
        <ul className="mt-1">
          {people.map((p) =>
            editingId === p.id ? (
              <li
                key={p.id}
                className="border-b border-zinc-100 py-2 last:border-0 dark:border-zinc-900"
              >
                <form action={renameSalesperson} className="flex flex-col gap-2">
                  {hidden}
                  <input type="hidden" name="salesperson_id" value={p.id} />
                  <span className="text-xs font-semibold">
                    Edit {salespersonName(p)}
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1 text-xs text-zinc-500">
                      First name
                      <input
                        name="first_name"
                        required
                        maxLength={60}
                        defaultValue={p.first_name}
                        autoComplete="off"
                        autoFocus
                        className={field}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-zinc-500">
                      Last name
                      <input
                        name="last_name"
                        maxLength={60}
                        defaultValue={p.last_name}
                        autoComplete="off"
                        className={field}
                      />
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      className="min-h-9 rounded-md btn-primary px-3 text-xs font-semibold"
                    >
                      Save name
                    </button>
                    <Link href={closeHref} scroll={false} className={smallButton}>
                      Cancel
                    </Link>
                  </div>
                  <p className="text-xs text-zinc-500">
                    Their numbers stay with them under the new name.
                  </p>
                </form>
              </li>
            ) : (
              <li
                key={p.id}
                className="flex min-h-11 items-center justify-between gap-2 border-b border-zinc-100 py-1 last:border-0 dark:border-zinc-900"
              >
                <span className="flex min-w-0 items-center gap-2">
                  {makeActive ? null : <Avatar person={p} />}
                  <span className={`truncate text-sm ${makeActive ? "text-zinc-500" : ""}`}>
                    {salespersonName(p)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <Link
                    href={editHref(p.id)}
                    scroll={false}
                    aria-label={`Edit ${salespersonName(p)}'s name`}
                    className={smallButton}
                  >
                    Edit
                  </Link>
                  <form action={setSalespersonActive}>
                    {hidden}
                    <input type="hidden" name="salesperson_id" value={p.id} />
                    <input type="hidden" name="active" value={String(makeActive)} />
                    <button
                      type="submit"
                      aria-label={`${makeActive ? "Restore" : "Remove"} ${salespersonName(p)}`}
                      className={smallButton}
                    >
                      {makeActive ? "Restore" : "Remove"}
                    </button>
                  </form>
                </span>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}

function Segmented({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex items-center gap-0.5 rounded-md border border-zinc-300 p-0.5 dark:border-zinc-700"
    >
      {children}
    </div>
  );
}

function SegLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={`inline-flex min-h-8 items-center rounded px-2.5 text-xs font-semibold transition-colors ${
        active
          ? "btn-primary"
          : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}

function Avatar({ person }: { person: { first_name: string; last_name: string } }) {
  return (
    <span
      aria-hidden
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
    >
      {salespersonInitials(person)}
    </span>
  );
}

function RemovedChip({ on }: { on: string | null }) {
  return (
    <span className="mt-0.5 inline-block rounded-full border border-zinc-300 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-700">
      Removed{on ? ` ${removedDay(on)}` : ""}
    </span>
  );
}

function Bar({ pct }: { pct: number }) {
  return (
    <span aria-hidden className="block h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
      <span
        className="block h-full rounded-full bg-blue-400"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </span>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt>{label}</dt>
      <dd className="font-mono text-xs tabular-nums text-zinc-900 dark:text-zinc-50">{value}</dd>
    </div>
  );
}

/** A removal timestamp as the Pacific business day it happened on, "Nov 9". */
function removedDay(timestamp: string) {
  const { year, month, day } = datePartsInAppTZ(new Date(timestamp));
  const pad = (n: number) => String(n).padStart(2, "0");
  return formatShortDay(`${year}-${pad(month)}-${pad(day)}`);
}
