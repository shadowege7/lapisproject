"use client";

import { useState } from "react";

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
 * Two stat tiles over the Monthly table — units per month and gross per unit —
 * each with a small trend line. Built to the stat-tile rule: the line in the
 * de-emphasis ink, the current month as a dot in the accent, a tooltip on
 * every point (hover or focus). The Monthly table below is the table view.
 */
export function MonthlyTrends({
  units,
  perUnit,
}: {
  /** Oldest first. The current month's units are its projected month-end. */
  units: TrendPoint[];
  perUnit: TrendPoint[];
}) {
  if (units.filter((p) => p.value !== null).length < 2) return null;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 print:hidden">
      <TrendTile
        title="Units by month"
        points={units}
        format={(v) => Math.round(v).toLocaleString("en-US")}
        currentNote="projected"
      />
      <TrendTile
        title="Gross per unit"
        points={perUnit}
        format={(v) =>
          v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
        }
        currentNote="so far"
      />
    </div>
  );
}

const W = 240;
const H = 56;
const PAD = 6;

function TrendTile({
  title,
  points: all,
  format,
  currentNote,
}: {
  title: string;
  points: TrendPoint[];
  format: (v: number) => string;
  currentNote: string;
}) {
  // A month with nothing to plot (no units, so no gross per unit) is left out
  // rather than drawn as a gap, so the line always spans the tile.
  const points = all.filter((p) => p.value !== null);
  const [active, setActive] = useState<number | null>(null);
  const values = points.map((p) => p.value).filter((v): v is number => v !== null);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || Math.abs(hi) || 1;
  const step = points.length > 1 ? (W - PAD * 2) / (points.length - 1) : 0;
  const px = (i: number) => PAD + i * step;
  const py = (v: number) => PAD + (H - PAD * 2) * (1 - (v - lo) / span);

  const line = points
    .map((p, i) => (p.value === null ? null : `${px(i)},${py(p.value)}`))
    .filter(Boolean)
    .join(" L");

  const latest = [...points].reverse().find((p) => p.value !== null)!;
  const latestIndex = points.lastIndexOf(latest);
  const prior = points.slice(0, latestIndex).reverse().find((p) => p.value !== null);
  const shown = active !== null && points[active]?.value !== null ? points[active] : latest;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[var(--surface)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{title}</p>
          <p className="mt-1 text-xl font-semibold">{format(shown.value!)}</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {shown.full}
            {shown.current ? ` · ${currentNote}` : ""}
            {shown === latest && prior?.value != null
              ? ` · ${prior.label} ${format(prior.value)}`
              : ""}
          </p>
        </div>
      </div>
      {/* The line stretches to the tile's width; dots and hover targets are
          HTML laid over it by percentage so they stay round and focusable. */}
      <div className="relative mt-2 h-14" onPointerLeave={() => setActive(null)}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="absolute inset-0 h-full w-full overflow-visible"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            d={`M${line}`}
            fill="none"
            stroke="var(--figure-muted)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {points.map((p, i) =>
          p.value === null ? null : (
            <button
              key={p.full}
              type="button"
              aria-label={`${p.full}: ${format(p.value)}${p.current ? ` (${currentNote})` : ""}`}
              onPointerEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className="group absolute top-0 h-full -translate-x-1/2 outline-none"
              style={{ left: `${(px(i) / W) * 100}%`, width: `max(1.5rem, ${(step / W) * 100}%)` }}
            >
              <span
                className={`absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[var(--surface)] group-focus-visible:ring-blue-500 ${
                  p.current || active === i ? "" : "opacity-0"
                }`}
                style={{
                  top: `${(py(p.value) / H) * 100}%`,
                  background: p.current ? "var(--series-1)" : "var(--figure-muted)",
                }}
              />
            </button>
          ),
        )}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-zinc-500">
        <span>{points.find((p) => p.value !== null)?.label}</span>
        <span>{latest.label}</span>
      </div>
    </div>
  );
}
