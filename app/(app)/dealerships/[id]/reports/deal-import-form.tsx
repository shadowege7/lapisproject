"use client";

import { useMemo, useState } from "react";
import { formatCurrency, formatShortDay } from "@/lib/format";
import { formatUnits, salespersonName } from "@/lib/salespeople";
import { readFirstSheet, type Cell } from "@/lib/xlsx-lite";
import {
  autoMatch,
  collectNames,
  dateSpan,
  eachDay,
  parseDealGrid,
  rollupDeals,
  type Assignment,
  type DayTotals,
  type ParsedDeals,
} from "@/lib/deal-import";
import { parseCsv } from "@/lib/csv";
import {
  applyDealImport,
  previewDealImport,
  type ExistingDay,
  type PreviewResult,
} from "./deal-import-actions";

interface Loaded {
  fileName: string;
  parsed: ParsedDeals;
  preview: PreviewResult;
}

const sel =
  "min-w-0 rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700 dark:bg-[var(--surface)]";

/** Encodes an Assignment as a <select> value and back. */
const enc = (a: Assignment) => (a.kind === "person" ? `p:${a.id}` : a.kind);
const dec = (v: string): Assignment =>
  v.startsWith("p:") ? { kind: "person", id: v.slice(2) } : v === "house" ? { kind: "house" } : { kind: "add" };

const dayGross = (d: {
  new_front_end_gross: number;
  new_back_end_gross: number;
  used_front_end_gross: number;
  used_back_end_gross: number;
  sprinter_front_end_gross: number;
  sprinter_back_end_gross: number;
}) =>
  d.new_front_end_gross +
  d.new_back_end_gross +
  d.used_front_end_gross +
  d.used_back_end_gross +
  d.sprinter_front_end_gross +
  d.sprinter_back_end_gross;

const front = (d: DayTotals | ExistingDay) =>
  d.new_front_end_gross + d.used_front_end_gross + d.sprinter_front_end_gross;
const back = (d: DayTotals | ExistingDay) =>
  d.new_back_end_gross + d.used_back_end_gross + d.sprinter_back_end_gross;

function sameNumbers(a: DayTotals | undefined, b: ExistingDay | undefined) {
  const x = a ?? null;
  if (!x && !b) return true;
  const z = (v: number | undefined) => Math.round((v ?? 0) * 100);
  const keys = [
    "new_units",
    "used_units",
    "sprinter_units",
    "new_front_end_gross",
    "new_back_end_gross",
    "used_front_end_gross",
    "used_back_end_gross",
    "sprinter_front_end_gross",
    "sprinter_back_end_gross",
  ] as const;
  return keys.every((k) => z(x?.[k]) === z(b?.[k]));
}

/**
 * Dealership Insights → "Upload ReverseRisk Export". Reads a ReverseRisk deal export
 * (.xlsx, or the same report saved as .csv), shows what each day will become
 * next to what is saved, lets the manager settle who each salesperson name is,
 * and then replaces those days. Sales calls, appointments and notes are left
 * as they are.
 */
export function DealImportForm({
  dealershipId,
  tracksSprinters,
}: {
  dealershipId: string;
  tracksSprinters: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [assign, setAssign] = useState<Record<string, Assignment>>({});
  const [zeroMissing, setZeroMissing] = useState(true);
  const [inputKey, setInputKey] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  async function onFile(chosen: File) {
    setBusy(true);
    setMsg(null);
    setLoaded(null);
    try {
      let grid: Cell[][];
      if (/\.csv$/i.test(chosen.name)) grid = parseCsv(await chosen.text());
      else if (/\.xlsx$/i.test(chosen.name)) grid = await readFirstSheet(await chosen.arrayBuffer());
      else {
        setMsg({ tone: "error", text: "Choose an .xlsx (or .csv) deal export." });
        return;
      }
      const parsed = parseDealGrid(grid, tracksSprinters);
      const span = dateSpan(parsed.deals);
      if (!span) {
        setMsg({ tone: "error", text: "No deals found in that file." });
        return;
      }
      const preview = await previewDealImport(dealershipId, span.from, span.to);
      if (!preview.ok) {
        setMsg({ tone: "error", text: preview.error ?? "Couldn't preview that file." });
        return;
      }
      const roster = preview.roster ?? [];
      const initial: Record<string, Assignment> = {};
      for (const key of collectNames(parsed.deals).keys()) {
        const id = autoMatch(key, roster);
        initial[key] = id ? { kind: "person", id } : { kind: "add" };
      }
      setAssign(initial);
      setZeroMissing(true);
      setLoaded({ fileName: chosen.name, parsed, preview });
    } catch (e) {
      setMsg({
        tone: "error",
        text: e instanceof Error ? e.message : "Couldn't read that file.",
      });
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setLoaded(null);
    setAssign({});
    setFile(null);
    setInputKey((k) => k + 1);
  }

  function pick(f: File | undefined) {
    if (!f) return;
    setFile(f);
    setLoaded(null);
    setMsg(null);
  }

  const view = useMemo(() => {
    if (!loaded) return null;
    const { parsed, preview } = loaded;
    const span = dateSpan(parsed.deals)!;
    const { days } = rollupDeals(parsed.deals);
    const existing = preview.existing ?? {};
    const missing = Object.keys(existing)
      .filter((d) => !days.has(d))
      .sort();
    const rows = eachDay(span.from, span.to)
      .filter((d) => days.has(d) || existing[d])
      .map((date) => {
        const next = days.get(date);
        const saved = existing[date];
        const zeroed = !next && !!saved;
        const status = zeroed
          ? "zero"
          : !saved
            ? "new"
            : sameNumbers(next, saved)
              ? "same"
              : "change";
        return { date, next, saved, status } as const;
      })
      .reverse();
    const names = [...collectNames(parsed.deals).entries()].sort((a, b) =>
      a[1].label.localeCompare(b[1].label),
    );
    const totals = [...days.values()].reduce(
      (acc, d) => ({
        units: acc.units + d.new_units + d.used_units + d.sprinter_units,
        gross: acc.gross + dayGross(d),
      }),
      { units: 0, gross: 0 },
    );
    const houseDeals = parsed.deals.filter((d) => d.sls1.trim().toUpperCase() === "D").length;
    return { span, days, existing, missing, rows, names, totals, houseDeals };
  }, [loaded]);

  async function apply() {
    if (!loaded) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await applyDealImport(
        dealershipId,
        loaded.parsed.deals,
        loaded.preview.tracksSalespeople ? assign : {},
        zeroMissing,
      );
      const addedText = res.added?.length
        ? ` Added ${res.added.join(", ")} to the roster.`
        : "";
      if (!res.ok) {
        setMsg({ tone: "error", text: (res.error ?? "Import failed.") + addedText });
        if (res.daysWritten) reset();
        return;
      }
      setMsg({
        tone: "ok",
        text: `Updated ${res.daysWritten} day${res.daysWritten === 1 ? "" : "s"}${
          res.daysZeroed ? ` (${res.daysZeroed} set to zero)` : ""
        }.${addedText}`,
      });
      reset();
    } catch {
      setMsg({ tone: "error", text: "Import failed. Nothing was changed if this persists — try again." });
    } finally {
      setBusy(false);
    }
  }

  const tracking = loaded?.preview.tracksSalespeople ?? false;
  const roster = loaded?.preview.roster ?? [];
  // Unchanged days are still written: their store numbers match, but for a
  // store tracking salespeople the per-person split may not.
  const writeCount = view
    ? view.rows.filter((r) => r.status !== "zero" || zeroMissing).length
    : 0;

  return (
    <details className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[var(--surface)] print:hidden">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        Upload ReverseRisk Export
      </summary>
      <div className="flex flex-col gap-4 border-t border-zinc-100 p-4 dark:border-zinc-800">
        <p className="text-xs text-zinc-500">
          Upload the ReverseRisk BY MONTH/DATE RANGE exported .xlsx sheet.
        </p>

        {/* The native file input is hidden behind a drop zone with a real
            button, so picking a file looks like something you can click. */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!busy) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (!busy) pick(e.dataTransfer.files?.[0]);
          }}
          className={`flex flex-col gap-3 rounded-lg border-2 border-dashed p-4 sm:flex-row sm:items-center ${
            dragging
              ? "border-blue-500 bg-blue-50/60 dark:bg-blue-950/30"
              : "border-zinc-300 dark:border-zinc-700"
          }`}
        >
          <label
            className={`inline-flex min-h-10 w-fit shrink-0 cursor-pointer items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800 hover:border-blue-400 hover:text-blue-700 focus-within:ring-2 focus-within:ring-blue-500/40 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:text-blue-300 ${
              busy ? "pointer-events-none opacity-60" : ""
            }`}
          >
            <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M10 3a1 1 0 0 1 .7.3l3.5 3.5a1 1 0 1 1-1.4 1.4L11 6.4V13a1 1 0 1 1-2 0V6.4L7.2 8.2a1 1 0 0 1-1.4-1.4l3.5-3.5A1 1 0 0 1 10 3ZM4 14a1 1 0 0 1 1 1v1h10v-1a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1Z" />
            </svg>
            {file ? "Choose a different file" : "Choose file"}
            <input
              key={inputKey}
              type="file"
              accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              disabled={busy}
              onChange={(e) => pick(e.target.files?.[0])}
              className="sr-only"
            />
          </label>
          <span className="min-w-0 flex-1 truncate text-sm">
            {file ? (
              <span className="font-medium">{file.name}</span>
            ) : (
              <span className="text-zinc-500">or drag the .xlsx here</span>
            )}
          </span>
          {loaded ? null : (
            <button
              type="button"
              onClick={() => file && void onFile(file)}
              disabled={!file || busy}
              className="min-h-10 w-fit shrink-0 rounded-md btn-primary px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Reading…" : "Import"}
            </button>
          )}
        </div>

        {msg ? (
          <p
            role={msg.tone === "error" ? "alert" : "status"}
            className={`rounded-md px-3 py-2 text-sm ${
              msg.tone === "error"
                ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                : "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
            }`}
          >
            {msg.text}
          </p>
        ) : null}

        {loaded && view ? (
          <div className="flex flex-col gap-4">
            <div className="text-sm">
              <p className="font-medium">
                {loaded.parsed.deals.length} deal{loaded.parsed.deals.length === 1 ? "" : "s"} ·{" "}
                {formatShortDay(view.span.from)} – {formatShortDay(view.span.to)} ·{" "}
                {view.totals.units} units · {formatCurrency(view.totals.gross)} gross
              </p>
              <p className="text-xs text-zinc-500">{loaded.fileName}</p>
              {loaded.parsed.skipped.length ? (
                <details className="mt-2 text-xs text-amber-800 dark:text-amber-200">
                  <summary className="cursor-pointer">
                    {loaded.parsed.skipped.length} row
                    {loaded.parsed.skipped.length === 1 ? "" : "s"} skipped
                  </summary>
                  <ul className="mt-1 list-disc pl-5">
                    {loaded.parsed.skipped.slice(0, 50).map((s) => (
                      <li key={s.row}>
                        Row {s.row}: {s.reason}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>

            {tracking && view.names.length ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Salespeople in the file
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  A name in Sls 2 splits the deal half-and-half.{" "}
                  {view.houseDeals
                    ? `${view.houseDeals} house deal${view.houseDeals === 1 ? "" : "s"} (Sls 1 “D”) count for the store only.`
                    : "Sls 1 “D” is a house deal and counts for the store only."}
                </p>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {view.names.map(([key, { label, deals }]) => {
                    const a = assign[key] ?? { kind: "add" };
                    return (
                      <li
                        key={key}
                        className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-zinc-100 pb-1.5 text-sm last:border-0 dark:border-zinc-900"
                      >
                        <span className="w-32 truncate font-medium">{label}</span>
                        <span className="w-20 text-xs text-zinc-500">
                          {formatUnits(deals)} deal{deals === 1 ? "" : "s"}
                        </span>
                        <select
                          aria-label={`Credit ${label} to`}
                          value={enc(a)}
                          onChange={(e) =>
                            setAssign((cur) => ({ ...cur, [key]: dec(e.target.value) }))
                          }
                          className={sel}
                        >
                          <option value="add">Add “{label}” to the roster</option>
                          <option value="house">Count as a house deal</option>
                          <optgroup label="On the roster">
                            {roster
                              .slice()
                              .sort((x, y) => salespersonName(x).localeCompare(salespersonName(y)))
                              .map((p) => (
                                <option key={p.id} value={`p:${p.id}`}>
                                  {salespersonName(p)}
                                </option>
                              ))}
                          </optgroup>
                        </select>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : !tracking && loaded.parsed.hasSalespeople ? (
              <p className="text-xs text-zinc-500">
                This store doesn&apos;t track salespeople, so Sls 1 and Sls 2 are ignored.
              </p>
            ) : null}

            {view.missing.length ? (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={zeroMissing}
                  onChange={(e) => setZeroMissing(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  Set {view.missing.length} saved day{view.missing.length === 1 ? "" : "s"} with
                  no deals in the file to zero
                  <span className="block text-xs text-zinc-500">
                    {view.missing.map(formatShortDay).join(", ")} — inside the file&apos;s date
                    range but no deals in it. Untick if the export was filtered.
                  </span>
                </span>
              </label>
            ) : null}

            <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-[11px] uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">New</th>
                    <th className="px-3 py-2 font-medium">Used</th>
                    {tracksSprinters ? <th className="px-3 py-2 font-medium">Sprinter</th> : null}
                    <th className="px-3 py-2 text-right font-medium">Front</th>
                    <th className="px-3 py-2 text-right font-medium">Back</th>
                    <th className="px-3 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {view.rows.map(({ date, next, saved, status }) => {
                    const skip = status === "zero" && !zeroMissing;
                    const show = skip ? saved : next;
                    const was = status === "change" || (status === "zero" && !skip) ? saved : undefined;
                    const n = (v: number | undefined) => v ?? 0;
                    const cell = (now: number, before: number | undefined, money = false) => {
                      const f = (v: number) => (money ? formatCurrency(v) : String(v));
                      const differs = before !== undefined && Math.round(before * 100) !== Math.round(now * 100);
                      return (
                        <>
                          <span className="font-mono tabular-nums">{f(now)}</span>
                          {differs ? (
                            <span className="ml-1.5 font-mono text-xs tabular-nums text-zinc-400 line-through">
                              {f(before)}
                            </span>
                          ) : null}
                        </>
                      );
                    };
                    return (
                      <tr
                        key={date}
                        className={`border-b border-zinc-100 last:border-0 dark:border-zinc-900 ${
                          status === "same" || skip ? "text-zinc-400" : ""
                        }`}
                      >
                        <td className="whitespace-nowrap px-3 py-1.5">{formatShortDay(date)}</td>
                        <td className="px-3 py-1.5">{cell(n(show?.new_units), was?.new_units)}</td>
                        <td className="px-3 py-1.5">{cell(n(show?.used_units), was?.used_units)}</td>
                        {tracksSprinters ? (
                          <td className="px-3 py-1.5">
                            {cell(n(show?.sprinter_units), was?.sprinter_units)}
                          </td>
                        ) : null}
                        <td className="whitespace-nowrap px-3 py-1.5 text-right">
                          {cell(show ? front(show) : 0, was ? front(was) : undefined, true)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-right">
                          {cell(show ? back(show) : 0, was ? back(was) : undefined, true)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-xs">
                          {status === "new"
                            ? "New day"
                            : status === "change"
                              ? "Replaces saved"
                              : status === "zero"
                                ? skip
                                  ? "Kept as is"
                                  : "No deals → zero"
                                : "No change"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={apply}
                disabled={busy || writeCount === 0}
                className="w-fit rounded-md btn-primary px-4 py-2 text-sm font-semibold disabled:opacity-60"
              >
                {busy
                  ? "Saving…"
                  : `Confirm import · ${writeCount} day${writeCount === 1 ? "" : "s"}`}
              </button>
              <button
                type="button"
                onClick={reset}
                disabled={busy}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              {tracking ? (
                <p className="text-xs text-zinc-500">
                  Salesperson numbers for these days are replaced too.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </details>
  );
}
