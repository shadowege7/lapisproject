"use client";

import { useState } from "react";
import { importEntries, type ImportRow } from "./actions";

const HEADER_MAP: Record<string, keyof ImportRow> = {
  date: "entry_date",
  "new units": "new_units",
  "new front": "new_front_end_gross",
  "new back": "new_back_end_gross",
  "used units": "used_units",
  "used front": "used_front_end_gross",
  "used back": "used_back_end_gross",
  // Only exported by stores that sell them. An absent column is simply not
  // mapped, and the row keeps its zeroes.
  "sprinter units": "sprinter_units",
  "sprinter front": "sprinter_front_end_gross",
  "sprinter back": "sprinter_back_end_gross",
  "sales calls": "sales_calls",
  appointments: "appointments",
  notes: "notes",
};

/** True only for a real calendar date — rejects things like 02-30. */
function isRealDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/**
 * Normalise a date cell to ISO (YYYY-MM-DD) for the database. The template
 * uses MM-DD-YYYY, so that's the format people type; an exported CSV carries
 * ISO, so that's accepted too and re-imports cleanly. Slashes are tolerated.
 * Returns null for anything that isn't a real date.
 */
function toISODate(raw: string): string | null {
  const val = raw.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(val); // ISO, e.g. from an export
  if (m) {
    const [, y, mo, d] = m;
    return isRealDate(+y, +mo, +d) ? `${y}-${mo}-${d}` : null;
  }
  m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(val); // MM-DD-YYYY (or slashes)
  if (m) {
    const mo = m[1].padStart(2, "0");
    const d = m[2].padStart(2, "0");
    const y = m[3];
    return isRealDate(+y, +mo, +d) ? `${y}-${mo}-${d}` : null;
  }
  return null;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** CSV-quote a field only when it needs it (comma, quote, or newline). */
function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function ImportForm({
  dealershipId,
  tracksSprinters = false,
}: {
  dealershipId: string;
  tracksSprinters?: boolean;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Columns for the template and the placeholder — Sprinter columns appear
  // only for the stores that keep that line.
  const templateColumns = [
    "Date",
    "New units",
    "New front",
    "New back",
    "Used units",
    "Used front",
    "Used back",
    ...(tracksSprinters
      ? ["Sprinter units", "Sprinter front", "Sprinter back"]
      : []),
    "Sales calls",
    "Appointments",
    "Notes",
  ];

  function downloadTemplate() {
    // One filled example row. Sales calls / Appointments are left blank on
    // purpose to show they're optional.
    const example = [
      "08-01-2026",
      "3",
      "4500",
      "1800",
      "2",
      "3000",
      "1200",
      ...(tracksSprinters ? ["1", "2500", "900"] : []),
      "",
      "",
      "Example row — delete before importing",
    ];
    const csv =
      templateColumns.join(",") +
      "\n" +
      example.map(csvCell).join(",") +
      "\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "daily-import-template.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const grid = parseCsv(text.trim());
      if (grid.length < 2) {
        setMsg("No rows found — paste a CSV with a header row.");
        return;
      }
      const headers = grid[0].map((h) => h.trim().toLowerCase());
      const rows: ImportRow[] = [];
      let skipped = 0;
      for (let i = 1; i < grid.length; i++) {
        const cells = grid[i];
        if (cells.every((c) => c.trim() === "")) continue;
        const rec: ImportRow = {
          entry_date: "",
          new_units: 0,
          used_units: 0,
          sprinter_units: 0,
          new_front_end_gross: 0,
          new_back_end_gross: 0,
          used_front_end_gross: 0,
          used_back_end_gross: 0,
          sprinter_front_end_gross: 0,
          sprinter_back_end_gross: 0,
          sales_calls: 0,
          appointments: 0,
          notes: null,
        };
        headers.forEach((h, idx) => {
          const key = HEADER_MAP[h];
          if (!key) return;
          const val = (cells[idx] ?? "").trim();
          if (key === "entry_date") rec.entry_date = val;
          else if (key === "notes") rec.notes = val || null;
          else rec[key] = Number(val.replace(/[$,]/g, "")) || 0;
        });
        const iso = toISODate(rec.entry_date);
        if (!iso) {
          skipped++;
          continue;
        }
        rec.entry_date = iso;
        rows.push(rec);
      }
      if (rows.length === 0) {
        setMsg("No valid rows — need a Date column formatted MM-DD-YYYY.");
        return;
      }
      const res = await importEntries(dealershipId, rows);
      if (!res.ok) {
        setMsg(res.error ?? "Import failed.");
        return;
      }
      setMsg(
        `Imported ${res.imported} row${res.imported === 1 ? "" : "s"}${
          res.collapsed
            ? `, merged ${res.collapsed} duplicate date${res.collapsed === 1 ? "" : "s"}`
            : ""
        }${skipped ? `, skipped ${skipped}` : ""}. Reload to see them.`,
      );
      setText("");
    } catch {
      setMsg("Couldn't parse that CSV.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[var(--surface)] print:hidden">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        Import / backfill from CSV
      </summary>
      <div className="flex flex-col gap-3 border-t border-zinc-100 p-4 dark:border-zinc-800">
        <p className="text-xs text-zinc-500">
          Upload or paste a CSV with a header row. A <strong>Date</strong>{" "}
          column (MM-DD-YYYY) is required; New/Used units and front/back gross
          are read, and Notes. <strong>Sales calls</strong> and{" "}
          <strong>Appointments</strong> are optional — leave them blank and
          they&apos;re recorded as zero. The derived gross columns are ignored,
          and rows with an existing date are overwritten. Start from the
          template so the columns line up.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setText(await f.text());
            }}
            className="text-sm"
          />
          <button
            type="button"
            onClick={downloadTemplate}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Download template
          </button>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder={templateColumns.join(",")}
          className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 font-mono text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700"
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={run}
            disabled={busy || !text.trim()}
            className="w-fit rounded-md btn-primary px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {busy ? "Importing…" : "Import"}
          </button>
          {msg ? <p className="text-sm text-zinc-500">{msg}</p> : null}
        </div>
      </div>
    </details>
  );
}
