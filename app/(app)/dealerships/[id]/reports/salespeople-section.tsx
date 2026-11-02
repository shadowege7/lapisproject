import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { datePartsInAppTZ, formatCurrency, formatShortDay } from "@/lib/format";
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
import { addSalesperson, setSalespersonActive } from "./salespeople-actions";
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
 * daily_entries, but only from the day tracking started — otherwise a store
 * that turned this on mid-year would show months of sales as unassigned.
 */
export async function SalespeopleSection({
  dealershipId,
  sprinters,
  trackedSince,
  period,
  rank,
  canEdit,
  manageOpen,
  error,
  done,
}: {
  dealershipId: string;
  sprinters: boolean;
  trackedSince: string | null;
  period: SalespersonPeriod;
  rank: SalespersonRank;
  canEdit: boolean;
  manageOpen: boolean;
  error?: string;
  done?: string;
}) {
  const supabase = await createClient();
  const { from, to } = periodRange(period);
  const windowFrom = trackedSince && trackedSince > from ? trackedSince : from;

  const [{ data: roster }, { data: totals }, { data: storeDays }] = await Promise.all([
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
        "new_units, used_units, sprinter_units, new_front_end_gross, new_back_end_gross, used_front_end_gross, used_back_end_gross, sprinter_front_end_gross, sprinter_back_end_gross",
      )
      .eq("dealership_id", dealershipId)
      .gte("entry_date", windowFrom)
      .lte("entry_date", to),
  ]);

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
  const share = (f: Figures) =>
    storeUnits ? `${Math.round((units(f) / storeUnits) * 1000) / 10}%` : "—";
  const pvr = (f: Figures) => (units(f) ? formatCurrency(gross(f) / units(f)) : "—");
  const money = (n: number) => (n ? formatCurrency(n) : "—");

  const href = (next: { sp?: SalespersonPeriod; rank?: SalespersonRank; manage?: boolean }) => {
    const q = new URLSearchParams();
    const p = next.sp ?? period;
    const r = next.rank ?? rank;
    const m = next.manage ?? manageOpen;
    if (p !== "mtd") q.set("sp", p);
    if (r !== "units") q.set("rank", r);
    if (m) q.set("manage", "1");
    const qs = q.toString();
    return `/dealerships/${dealershipId}/reports${qs ? `?${qs}` : ""}#salespeople`;
  };

  const periodLabel =
    period === "today"
      ? `Today · ${formatShortDay(to)}`
      : period === "mtd"
        ? "Month to date"
        : "Year to date";
  const partialWindow = windowFrom !== from;

  const desktopCols =
    "grid-cols-[1.5rem_minmax(9rem,1.5fr)_minmax(9rem,1.5fr)_repeat(3,minmax(5rem,0.85fr))_minmax(4rem,0.6fr)_minmax(3.5rem,0.45fr)]";

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
          <Segmented label="Period">
            {PERIODS.map(([value, text]) => (
              <SegLink key={value} href={href({ sp: value })} active={period === value}>
                {text}
              </SegLink>
            ))}
          </Segmented>
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
                <div className="min-w-[44rem] text-sm">
                  <div className={`grid ${desktopCols} gap-3 border-b border-zinc-200 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800`}>
                    <span>#</span>
                    <span>Salesperson</span>
                    <span>Units</span>
                    <span className="text-right">Front</span>
                    <span className="text-right">Back</span>
                    <span className="text-right">Gross</span>
                    <span className="text-right">PVR</span>
                    <span className="text-right">Share</span>
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
                        <span className="text-right font-mono tabular-nums text-zinc-500">{share(f)}</span>
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
                    <span className="text-right font-mono tabular-nums">{share(unassigned)}</span>
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
                    <span className="text-right font-mono tabular-nums">{storeUnits ? "100%" : "—"}</span>
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
              makeActive={false}
            />
            <RosterList
              title="Removed"
              people={people.filter((p) => !p.is_active)}
              dealershipId={dealershipId}
              period={period}
              rank={rank}
              makeActive
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
  makeActive,
}: {
  title: string;
  people: RosterPerson[];
  dealershipId: string;
  period: SalespersonPeriod;
  rank: SalespersonRank;
  makeActive: boolean;
}) {
  if (people.length === 0 && makeActive) return null;
  return (
    <div className="mt-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        {title} · {people.length}
      </p>
      {people.length === 0 ? (
        <p className="mt-1 text-sm text-zinc-500">Nobody yet.</p>
      ) : (
        <ul className="mt-1">
          {people.map((p) => (
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
              <form action={setSalespersonActive}>
                <input type="hidden" name="dealership_id" value={dealershipId} />
                <input type="hidden" name="salesperson_id" value={p.id} />
                <input type="hidden" name="active" value={String(makeActive)} />
                <input type="hidden" name="sp" value={period} />
                <input type="hidden" name="rank" value={rank} />
                <button
                  type="submit"
                  aria-label={`${makeActive ? "Restore" : "Remove"} ${salespersonName(p)}`}
                  className="min-h-9 rounded-md border border-zinc-300 px-2.5 text-xs font-semibold text-zinc-700 hover:border-blue-400 hover:text-blue-700 dark:border-zinc-700 dark:text-zinc-200 dark:hover:text-blue-400"
                >
                  {makeActive ? "Restore" : "Remove"}
                </button>
              </form>
            </li>
          ))}
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
