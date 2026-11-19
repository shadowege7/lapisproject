"use client";

import { useEffect, useRef, useState } from "react";

export interface TrendPoint {
  /** "Nov", "Oct"… */
  label: string;
  /** Full month name with year, for the tooltip. */
  full: string;
  value: number | null;
  /** The month in progress: its value is a projection (units) or to-date (gross per unit). */
  current: boolean;
}

/**
 * Two tiles over the Monthly table — units per month and gross per unit —
 * each with a small line chart. Every month is labelled along the bottom and
 * carries its value above its dot, so the line can be read without hovering.
 * The line is in the de-emphasis ink and the current month's dot in the
 * accent; hovering or focusing a month also puts it in the tile's headline.
 * The Monthly table below is the table view.
 */
export function MonthlyTrends({
  units,
  perUnit,
  yearAgo,
}: {
  /** Oldest first. The current month's units are its projected month-end. */
  units: TrendPoint[];
  perUnit: TrendPoint[];
  /**
   * The same month last year, once a store has that much history, shown next
   * to last month under each headline. Final figures (it's a finished month).
   */
  yearAgo?: { label: string; units: number; perUnit: number | null } | null;
}) {
  if (units.filter((p) => p.value !== null).length < 2) return null;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 print:hidden">
      <TrendTile
        title="Units by month"
        points={units}
        format={(v) => Math.round(v).toLocaleString("en-US")}
        labelFormat={(v) => Math.round(v).toLocaleString("en-US")}
        currentNote="projected"
        yearAgo={yearAgo ? { label: yearAgo.label, value: yearAgo.units } : null}
      />
      <TrendTile
        title="Gross per unit"
        points={perUnit}
        format={(v) =>
          v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
        }
        // On the chart, $9.5K rather than $9,533: twelve full amounts don't fit
        // side by side. The headline above keeps the full figure.
        labelFormat={(v) =>
          `${v < 0 ? "−" : ""}$${
            Math.abs(v) >= 1000 ? `${(Math.abs(v) / 1000).toFixed(1)}K` : Math.round(Math.abs(v))
          }`
        }
        currentNote="so far"
        yearAgo={yearAgo && yearAgo.perUnit !== null ? { label: yearAgo.label, value: yearAgo.perUnit } : null}
      />
    </div>
  );
}

/** Plot box: fixed pixel height, with room above the highest dot for its label. */
const PLOT_H = 96;
const TOP = 24;
const BOTTOM = 8;
/** Points are inset from the tile's sides so the first and last labels fit. */
const INSET = 6;

function TrendTile({
  title,
  points: all,
  format,
  labelFormat,
  currentNote,
  yearAgo,
}: {
  title: string;
  points: TrendPoint[];
  format: (v: number) => string;
  labelFormat: (v: number) => string;
  currentNote: string;
  yearAgo: { label: string; value: number } | null;
}) {
  // A month with nothing to plot (no units, so no gross per unit) is left out
  // rather than drawn as a gap, so the line always spans the tile.
  const points = all.filter((p): p is TrendPoint & { value: number } => p.value !== null);
  const [active, setActive] = useState<number | null>(null);
  const values = points.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || Math.abs(hi) || 1;
  const n = points.length;
  /** Horizontal position as a percentage of the tile. */
  const xPct = (i: number) => (n > 1 ? INSET + (i * (100 - INSET * 2)) / (n - 1) : 50);
  /** Vertical position in pixels within the plot box. */
  const yPx = (v: number) => TOP + (PLOT_H - TOP - BOTTOM) * (1 - (v - lo) / span);

  const latest = points[n - 1];
  const prior = points[n - 2];
  const shown = active !== null ? points[active] : latest;
  // Labels only where they fit: the plot measures its own width, and when
  // months sit closer than a label is wide, every second (or third…) label
  // is shown, counted back from the latest so the current month always has
  // one. The month being pointed at always shows its own.
  const plot = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = plot.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const gap = n > 1 && width > 0 ? (width * (100 - INSET * 2)) / 100 / (n - 1) : Infinity;
  const valueEvery = Math.max(1, Math.ceil(46 / gap));
  const monthEvery = Math.max(1, Math.ceil(30 / gap));
  const thin = (i: number, every: number) =>
    active === i || (n - 1 - i) % every === 0 ? "" : "invisible";

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[var(--surface)]">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{title}</p>
      <p className="mt-1 text-xl font-semibold">{format(shown.value)}</p>
      <p className="mt-0.5 text-xs text-zinc-500">
        {shown.full}
        {shown.current ? ` · ${currentNote}` : ""}
        {shown === latest && prior ? ` · ${prior.label} ${format(prior.value)}` : ""}
        {shown === latest && yearAgo ? ` · ${yearAgo.label} ${format(yearAgo.value)}` : ""}
      </p>

      <div
        ref={plot}
        className="relative mt-2"
        style={{ height: PLOT_H }}
        onPointerLeave={() => setActive(null)}
      >
        <svg
          viewBox={`0 0 100 ${PLOT_H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full overflow-visible"
          aria-hidden
        >
          <polyline
            points={points.map((p, i) => `${xPct(i)},${yPx(p.value)}`).join(" ")}
            fill="none"
            stroke="var(--figure-muted)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {points.map((p, i) => {
          const on = active === i;
          return (
            <button
              key={p.full}
              type="button"
              aria-label={`${p.full}: ${format(p.value)}${p.current ? ` (${currentNote})` : ""}`}
              onPointerEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className="group absolute top-0 h-full -translate-x-1/2 outline-none"
              style={{ left: `${xPct(i)}%`, width: `max(1.75rem, ${100 / Math.max(n, 1)}%)` }}
            >
              {/* Value above the dot. */}
              <span
                className={`absolute left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap pb-1.5 font-mono text-[11px] tabular-nums ${
                  p.current || on
                    ? "font-semibold text-zinc-900 dark:text-zinc-50"
                    : "text-zinc-500"
                } ${thin(i, valueEvery)}`}
                // A halo in the card colour keeps a label legible where it
                // crosses the line.
                style={{
                  top: yPx(p.value),
                  textShadow: "0 0 3px var(--surface), 0 0 3px var(--surface), 0 0 2px var(--surface)",
                }}
              >
                {labelFormat(p.value)}
              </span>
              {/* The dot, with a 2px surface ring. */}
              <span
                className={`absolute left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[var(--surface)] group-focus-visible:ring-blue-500 ${
                  p.current ? "h-2.5 w-2.5" : on ? "h-2.5 w-2.5" : "h-2 w-2"
                }`}
                style={{
                  top: yPx(p.value),
                  background: p.current ? "var(--series-1)" : "var(--figure-muted)",
                }}
              />
            </button>
          );
        })}
      </div>

      {/* Month along the bottom, under each dot. */}
      <div className="relative mt-1 h-4 text-[11px] text-zinc-500" aria-hidden>
        {points.map((p, i) => (
          <span
            key={p.full}
            className={`absolute -translate-x-1/2 whitespace-nowrap ${
              p.current || active === i ? "font-semibold text-zinc-700 dark:text-zinc-200" : ""
            } ${thin(i, monthEvery)}`}
            style={{ left: `${xPct(i)}%` }}
          >
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}
