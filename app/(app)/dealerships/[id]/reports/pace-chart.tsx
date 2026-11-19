"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Running units through the month: this month (series 1), last month
 * (series 2), the same month last year once there's data for it (series 3),
 * and a straight budget-pace reference line. Built to the dataviz
 * rules — 2px lines, ringed end dots, solid hairline grid, a legend plus
 * sparing end labels, a crosshair tooltip on hover and on the arrow keys, and
 * a table view so nothing depends on hovering or on colour.
 */

const HEIGHT = 220;
const M = { top: 14, right: 88, bottom: 26, left: 34 };

function niceMax(v: number): number {
  if (v <= 5) return 5;
  const pow = 10 ** Math.floor(Math.log10(v));
  for (const step of [1, 2, 2.5, 5, 10]) {
    const top = Math.ceil(v / (step * pow)) * step * pow;
    if (top / (step * pow) <= 6) return top;
  }
  return Math.ceil(v / pow) * pow;
}

function ticks(max: number): number[] {
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * pow).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = 0; v <= max + 1e-9; v += step) out.push(Math.round(v * 10) / 10);
  return out;
}

export function PaceChart({
  monthLabel,
  previousLabel,
  daysInMonth,
  current,
  previous,
  lastYearLabel,
  lastYear,
  budget,
}: {
  monthLabel: string;
  previousLabel: string;
  daysInMonth: number;
  /** Running units, index 0 = day 1, through the last logged day. */
  current: number[];
  /** Last month's running units for every day of it, or empty if no data. */
  previous: number[];
  /** e.g. "November 2025". */
  lastYearLabel: string;
  /** The same month last year, every day, or empty until there's data. */
  lastYear: number[];
  /** Budgeted units for the month, or 0 when none is set. */
  budget: number;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const xMax = Math.max(daysInMonth, previous.length, lastYear.length, 1);
  const yMax = useMemo(
    () =>
      niceMax(Math.max(budget, current.at(-1) ?? 0, previous.at(-1) ?? 0, lastYear.at(-1) ?? 0, 1)),
    [budget, current, previous, lastYear],
  );
  const lastYearShort = `${lastYearLabel.slice(0, 3)} '${lastYearLabel.slice(-2)}`;

  const innerW = Math.max(width - M.left - M.right, 10);
  const innerH = HEIGHT - M.top - M.bottom;
  // Day d sits at the right edge of its day: day 0 is the origin.
  const x = (day: number) => M.left + (day / xMax) * innerW;
  const y = (v: number) => M.top + innerH - (v / yMax) * innerH;

  const path = (series: number[]) =>
    series.length === 0
      ? ""
      : `M${x(0)},${y(0)} ` + series.map((v, i) => `L${x(i + 1)},${y(v)}`).join(" ");
  const budgetAt = (day: number) => (budget * day) / daysInMonth;

  // End labels, most important first; a label too close to one already placed
  // is dropped — the legend and tooltip still carry it.
  const ends: { key: string; day: number; value: number; text: string }[] = [];
  if (current.length) {
    ends.push({ key: "cur", day: current.length, value: current.at(-1)!, text: String(current.at(-1)) });
  }
  if (budget > 0) ends.push({ key: "bud", day: daysInMonth, value: budget, text: `Budget ${budget}` });
  if (previous.length) {
    ends.push({ key: "prev", day: previous.length, value: previous.at(-1)!, text: `${previousLabel.slice(0, 3)} ${previous.at(-1)}` });
  }
  if (lastYear.length) {
    ends.push({ key: "ly", day: lastYear.length, value: lastYear.at(-1)!, text: `${lastYearShort} ${lastYear.at(-1)}` });
  }
  const placed: typeof ends = [];
  for (const e of ends) {
    if (placed.every((p) => Math.abs(y(p.value) - y(e.value)) >= 14 || Math.abs(x(p.day) - x(e.day)) > 70)) {
      placed.push(e);
    }
  }

  const xTicks = [1, 8, 15, 22, 29].filter((d) => d <= xMax);
  const h = hover;
  const tooltipRows =
    h === null
      ? []
      : [
          ...(h <= current.length
            ? [{ key: "cur", name: monthLabel, value: current[h - 1], day: current[h - 1] - (current[h - 2] ?? 0) }]
            : []),
          ...(h <= previous.length
            ? [{ key: "prev", name: previousLabel, value: previous[h - 1], day: previous[h - 1] - (previous[h - 2] ?? 0) }]
            : []),
          ...(h <= lastYear.length
            ? [{ key: "ly", name: lastYearLabel, value: lastYear[h - 1], day: lastYear[h - 1] - (lastYear[h - 2] ?? 0) }]
            : []),
          ...(budget > 0 && h <= daysInMonth
            ? [{ key: "bud", name: "Budget pace", value: Math.round(budgetAt(h) * 10) / 10, day: null as number | null }]
            : []),
        ];

  const setFromPointer = (clientX: number) => {
    const el = wrap.current;
    if (!el) return;
    const px = clientX - el.getBoundingClientRect().left;
    const day = Math.round(((px - M.left) / innerW) * xMax);
    setHover(Math.min(Math.max(day, 1), xMax));
  };

  const lineKey = (key: string) =>
    key === "cur" ? (
      <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: "var(--series-1)" }} />
    ) : key === "prev" ? (
      <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: "var(--series-2)" }} />
    ) : key === "ly" ? (
      <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: "var(--series-3)" }} />
    ) : (
      <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: "var(--figure-muted)" }} />
    );

  return (
    <div>
      <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500" aria-label="Legend">
        <li className="flex items-center gap-1.5">{lineKey("cur")}{monthLabel}</li>
        {previous.length ? <li className="flex items-center gap-1.5">{lineKey("prev")}{previousLabel}</li> : null}
        {lastYear.length ? <li className="flex items-center gap-1.5">{lineKey("ly")}{lastYearLabel}</li> : null}
        {budget > 0 ? <li className="flex items-center gap-1.5">{lineKey("bud")}Budget pace</li> : null}
      </ul>

      <div ref={wrap} className="relative w-full" style={{ height: HEIGHT }}>
        {width > 0 ? (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={`Running units by day: ${monthLabel} ${current.at(-1) ?? 0}${
              previous.length ? `, ${previousLabel} ${previous.at(-1)}` : ""
            }${lastYear.length ? `, ${lastYearLabel} ${lastYear.at(-1)}` : ""}${
              budget > 0 ? `, budget ${budget}` : ""
            }. Use the arrow keys to step through days.`}
            tabIndex={0}
            className="overflow-visible outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
            onPointerMove={(e) => setFromPointer(e.clientX)}
            onPointerLeave={() => setHover(null)}
            onFocus={() => setHover((v) => v ?? current.length ?? 1)}
            onBlur={() => setHover(null)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") setHover((v) => Math.min((v ?? 0) + 1, xMax));
              else if (e.key === "ArrowLeft") setHover((v) => Math.max((v ?? 2) - 1, 1));
              else return;
              e.preventDefault();
            }}
          >
            {/* Grid: solid hairlines, one step off the surface. */}
            {ticks(yMax).map((t) => (
              <g key={t}>
                <line
                  x1={M.left}
                  x2={M.left + innerW}
                  y1={y(t)}
                  y2={y(t)}
                  className="stroke-zinc-200 dark:stroke-zinc-700"
                  strokeWidth={1}
                />
                <text x={M.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-zinc-500 font-mono text-[10px] tabular-nums">
                  {t}
                </text>
              </g>
            ))}
            {xTicks.map((d) => (
              <text key={d} x={x(d)} y={HEIGHT - 8} textAnchor="middle" className="fill-zinc-500 font-mono text-[10px] tabular-nums">
                {d}
              </text>
            ))}

            {budget > 0 ? (
              <line
                x1={x(0)}
                y1={y(0)}
                x2={x(daysInMonth)}
                y2={y(budget)}
                stroke="var(--figure-muted)"
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
            ) : null}
            {lastYear.length ? (
              <path d={path(lastYear)} fill="none" stroke="var(--series-3)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            ) : null}
            {previous.length ? (
              <path d={path(previous)} fill="none" stroke="var(--series-2)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            ) : null}
            {current.length ? (
              <path d={path(current)} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            ) : null}

            {/* End dots with a 2px surface ring. */}
            {lastYear.length ? (
              <circle cx={x(lastYear.length)} cy={y(lastYear.at(-1)!)} r={4} fill="var(--series-3)" stroke="var(--surface)" strokeWidth={2} />
            ) : null}
            {previous.length ? (
              <circle cx={x(previous.length)} cy={y(previous.at(-1)!)} r={4} fill="var(--series-2)" stroke="var(--surface)" strokeWidth={2} />
            ) : null}
            {current.length ? (
              <circle cx={x(current.length)} cy={y(current.at(-1)!)} r={4.5} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} />
            ) : null}

            {placed.map((e) => (
              <text
                key={e.key}
                x={x(e.day) + 8}
                y={y(e.value)}
                dy="0.32em"
                className={`font-mono text-[11px] tabular-nums ${
                  e.key === "cur" ? "fill-zinc-900 font-semibold dark:fill-zinc-50" : "fill-zinc-500"
                }`}
              >
                {e.text}
              </text>
            ))}

            {h !== null ? (
              <line x1={x(h)} x2={x(h)} y1={M.top} y2={M.top + innerH} className="stroke-zinc-300 dark:stroke-zinc-600" strokeWidth={1} />
            ) : null}
          </svg>
        ) : null}

        {h !== null && tooltipRows.length ? (
          <div
            className="pointer-events-none absolute top-1 z-10 min-w-40 rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-zinc-700 dark:bg-[var(--surface)]"
            style={
              x(h) > width / 2
                ? { right: width - x(h) + 10 }
                : { left: x(h) + 10 }
            }
          >
            <p className="mb-1 font-medium text-zinc-500">Day {h}</p>
            {tooltipRows.map((r) => (
              <p key={r.key} className="flex items-center gap-2">
                {lineKey(r.key)}
                <span className="font-mono font-semibold tabular-nums">{r.value}</span>
                <span className="text-zinc-500">
                  {r.name}
                  {r.day !== null && r.day !== 0 ? ` (+${r.day} that day)` : ""}
                </span>
              </p>
            ))}
          </div>
        ) : null}
      </div>

      <details className="mt-2 text-xs print:hidden">
        <summary className="cursor-pointer text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          Show as table
        </summary>
        <div className="mt-2 max-h-64 overflow-auto rounded-md border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-right">
            <thead className="sticky top-0 bg-white dark:bg-[var(--surface)]">
              <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
                <th className="px-3 py-1.5 text-left font-medium">Day</th>
                <th className="px-3 py-1.5 font-medium">{monthLabel}</th>
                {previous.length ? <th className="px-3 py-1.5 font-medium">{previousLabel}</th> : null}
                {lastYear.length ? <th className="px-3 py-1.5 font-medium">{lastYearLabel}</th> : null}
                {budget > 0 ? <th className="px-3 py-1.5 font-medium">Budget pace</th> : null}
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              {Array.from({ length: xMax }, (_, i) => i + 1).map((d) => (
                <tr key={d} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                  <td className="px-3 py-1 text-left">{d}</td>
                  <td className="px-3 py-1">{d <= current.length ? current[d - 1] : "—"}</td>
                  {previous.length ? <td className="px-3 py-1">{d <= previous.length ? previous[d - 1] : "—"}</td> : null}
                  {lastYear.length ? <td className="px-3 py-1">{d <= lastYear.length ? lastYear[d - 1] : "—"}</td> : null}
                  {budget > 0 ? (
                    <td className="px-3 py-1">{d <= daysInMonth ? Math.round(budgetAt(d) * 10) / 10 : "—"}</td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
