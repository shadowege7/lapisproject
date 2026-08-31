import Link from "next/link";
import { formatCurrency, formatMonth, monthStartISODate } from "@/lib/format";
import { projectMonthEnd } from "@/lib/projection";
import type { Database } from "@/lib/database.types";

type MonthSummary = Database["public"]["Views"]["monthly_summary"]["Row"];

interface Category {
  label: string;
  units: number;
  front: number;
  back: number;
}

/**
 * "This month", as a headline strip over one card per vehicle category.
 *
 * It used to be a single flat table of nine rows (thirteen with Sprinters),
 * every row carrying the same weight, so finding where New stopped and Used
 * started meant counting. The categories are cards now, and the figure
 * everybody actually reads — total gross, month to date and projected — is
 * lifted out above them.
 *
 * The store detail page shows the same two headline figures. Duplicating them
 * is deliberate: this page gets printed on its own and has to stand up without
 * the rest of the app around it.
 *
 * There is no colour to group by. The brand has four colours; blue is already
 * spoken for by "projected", and red/green/amber mean alerts and pace. So the
 * grouping is structural — separate cards, a label above each count, and a
 * hairline over the Gross row — all of which survive the print reset.
 */
export function MonthPanel({
  month,
  todayLogged,
  sprinters,
  dealershipId,
  canEdit,
}: {
  month: MonthSummary | undefined;
  todayLogged: boolean;
  sprinters: boolean;
  dealershipId: string;
  canEdit: boolean;
}) {
  const monthLabel = formatMonth(monthStartISODate());
  const projected = (value: number) => projectMonthEnd(value, todayLogged);

  const categories: Category[] = [
    {
      label: "New",
      units: month?.total_new_units ?? 0,
      front: month?.total_new_front_end_gross ?? 0,
      back: month?.total_new_back_end_gross ?? 0,
    },
    {
      label: "Used",
      units: month?.total_used_units ?? 0,
      front: month?.total_used_front_end_gross ?? 0,
      back: month?.total_used_back_end_gross ?? 0,
    },
    ...(sprinters
      ? [
          {
            label: "Sprinter",
            units: month?.total_sprinter_units ?? 0,
            front: month?.total_sprinter_front_end_gross ?? 0,
            back: month?.total_sprinter_back_end_gross ?? 0,
          },
        ]
      : []),
  ];

  // The overall average is total gross over total units, not the mean of the
  // three category averages: that would weigh a two-Sprinter month the same as
  // a sixty-car new month.
  const totalUnits = categories.reduce((sum, c) => sum + c.units, 0);

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold">
        This month
        <span className="ml-2 font-normal text-zinc-400">{monthLabel}</span>
      </h2>

      {month ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <HeadlineStat
              label="Total gross"
              value={formatCurrency(month.total_gross)}
              sub={`Month to date · ${plural(month.days_logged, "day")} logged`}
            />
            <HeadlineStat
              label="Projected month-end"
              value={formatCurrency(projected(month.total_gross))}
              sub="At the current daily pace"
              accent
            />
            <HeadlineStat
              label="Average gross per unit"
              value={formatAverage(perUnit(month.total_gross, totalUnits))}
              sub={
                totalUnits > 0
                  ? `Month to date, across ${plural(totalUnits, "unit")} sold`
                  : "No units sold yet this month"
              }
            />
          </div>

          {/* Two categories or three, driven by tracks_sprinters. One column on
              a phone whichever it is; no fixed widths, so the cards divide
              whatever space they are given. */}
          <div
            className={`mt-3 grid grid-cols-1 gap-3 ${
              sprinters ? "sm:grid-cols-3" : "sm:grid-cols-2"
            }`}
          >
            {categories.map((category) => (
              <CategoryCard
                key={category.label}
                category={category}
                projected={projected}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-zinc-300 px-4 py-8 text-center dark:border-zinc-700">
          <p className="text-sm font-medium">
            Nothing logged for {monthLabel} yet.
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Month-to-date, projected and per-unit figures appear here as soon as
            the first day is entered.
          </p>
          {canEdit ? (
            <Link
              href={`/dealerships/${dealershipId}/entry`}
              className="mt-4 inline-block rounded-md btn-primary px-4 py-2 text-sm font-semibold shadow-sm transition-colors print:hidden"
            >
              Enter today&apos;s numbers
            </Link>
          ) : null}
        </div>
      )}
    </section>
  );
}

/**
 * The Front / Back / Gross grid, shared by the column heads and the list below
 * them so the two line up. Fractions rather than fixed widths: both elements
 * are block children of the same card, so identical fractions put the columns
 * in identical places whatever the card is worth, down to 360px and up through
 * the fluid root font size. The middle column is the widest because it carries
 * two lines — the amount and its per-unit average.
 */
const FIGURE_GRID =
  "grid grid-cols-[minmax(0,0.7fr)_minmax(0,1.2fr)_minmax(0,1fr)] items-baseline gap-x-2";

function CategoryCard({
  category,
  projected,
}: {
  category: Category;
  projected: (value: number) => number;
}) {
  const { label, units, front, back } = category;
  const gross = front + back;
  const hairline = "border-t border-zinc-200 pt-1 dark:border-zinc-800";

  return (
    <div className="break-inside-avoid rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[var(--surface)]">
      {/* Label above the count rather than beside it, for the reason the
          dashboard's VehicleStat gives: side by side, "SPRINTER" wraps where
          "NEW" and "USED" do not, and that card's rows then sit lower than its
          neighbours'. Stacking gives every card the same two-line head. */}
      <span className="block truncate text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      <p className="mt-0.5 text-xl font-semibold">
        <span className="font-mono tabular-nums">{formatCount(units)}</span>
        <span className="ml-1 text-sm font-medium text-zinc-500">units</span>
      </p>
      <p className="text-xs text-blue-700 dark:text-blue-400">
        <span className="font-mono tabular-nums">
          {formatCount(projected(units))}
        </span>{" "}
        projected
      </p>

      {/* Column heads for the two figure columns. Aria-hidden because each
          value below carries its own screen-reader label; a screen reader
          reading a bare "MTD" between the count and the list would be noise. */}
      <div
        aria-hidden="true"
        className={`mt-3 ${FIGURE_GRID} text-[11px] uppercase tracking-wide text-zinc-500`}
      >
        <span />
        <span className="text-right">MTD</span>
        <span className="text-right text-blue-700 dark:text-blue-400">
          Projected
        </span>
      </div>

      <dl className={`mt-1 ${FIGURE_GRID} gap-y-3 text-xs`}>
        <FigureRow
          label="Front"
          mtd={front}
          projected={projected(front)}
          average={perUnit(front, units)}
        />
        <FigureRow
          label="Back"
          mtd={back}
          projected={projected(back)}
          average={perUnit(back, units)}
        />
        <FigureRow
          label="Gross"
          mtd={gross}
          projected={projected(gross)}
          average={perUnit(gross, units)}
          emphasis={hairline}
        />
      </dl>
    </div>
  );
}

/**
 * One `dt` and two `dd`s — the term and its two values — as direct children of
 * the grid, so every card's columns align. The hidden prefixes are what make
 * two unlabelled money columns unambiguous to a screen reader; the visible
 * heads above do the same job for everyone else, including on paper, where the
 * blue on "projected" is flattened to black.
 *
 * The average hangs under the month-to-date amount rather than taking a column
 * of its own. MTD and Projected are two points in time; an average is not, and
 * a third column beside them would read as one.
 *
 * That makes each row two lines deep in one column and one in the others, so
 * the grid's row gap has to separate *rows*, not just lines: at a tight gap the
 * average sat as close to the next row's amount as to its own, and the column
 * read as six loose numbers instead of three labelled pairs.
 */
function FigureRow({
  label,
  mtd,
  projected,
  average,
  emphasis = "",
}: {
  label: string;
  mtd: number;
  projected: number;
  /** null where no units sold — see perUnit. */
  average: number | null;
  emphasis?: string;
}) {
  const strong = emphasis ? "font-medium" : "";
  return (
    <>
      <dt className={`${emphasis} ${strong} text-zinc-500`}>{label}</dt>
      <dd className={`${emphasis} ${strong} text-right`}>
        <span className="sr-only">{label} month to date </span>
        <span className="font-mono tabular-nums">{formatCurrency(mtd)}</span>
        <span className="mt-1 block text-[11px] font-normal leading-none text-zinc-400">
          {average === null ? (
            <>
              avg <span aria-hidden="true">—</span>
              <span className="sr-only">not available, no units sold</span>
            </>
          ) : (
            <>
              avg{" "}
              <span className="font-mono tabular-nums">
                {formatCurrency(average)}
              </span>
              /unit
            </>
          )}
        </span>
      </dd>
      <dd
        className={`${emphasis} ${strong} text-right font-mono tabular-nums text-blue-700 dark:text-blue-400`}
      >
        <span className="sr-only">{label} projected month-end </span>
        {formatCurrency(projected)}
      </dd>
    </>
  );
}

function HeadlineStat({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div className="break-inside-avoid rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[var(--surface)]">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p
        className={`mt-1 font-mono text-xl font-semibold tabular-nums ${
          accent ? "text-blue-700 dark:text-blue-400" : ""
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-xs text-zinc-400">{sub}</p>
    </div>
  );
}

/**
 * An amount spread over the units that produced it, or null where there are
 * none. Early in a month — and all month for Sprinters at a store that sells
 * few — units sits at zero, and both `x / 0` and `0 / 0` go through
 * `formatCurrency` as "$∞" and "$NaN". Null instead, rendered as the dash the
 * app already uses for an absent value: an average of no sales is not $0, it
 * does not exist.
 */
function perUnit(amount: number, units: number): number | null {
  if (units <= 0) return null;
  const value = amount / units;
  return Number.isFinite(value) ? value : null;
}

function formatAverage(value: number | null): string {
  return value === null ? "—" : formatCurrency(value);
}

function formatCount(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

function plural(count: number, noun: string): string {
  return `${formatCount(count)} ${noun}${count === 1 ? "" : "s"}`;
}
