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
  "manager calls": "manager_calls",
  "sales calls": "sales_calls",
  appointments: "appointments",
  "confirmed appts": "confirmed_appointments",
  "confirmed appointments": "confirmed_appointments",
  notes: "notes",
};

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

export function ImportForm({ dealershipId }: { dealershipId: string }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

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
          manager_calls: 0,
          sales_calls: 0,
          appointments: 0,
          confirmed_appointments: 0,
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
        if (!/^\d{4}-\d{2}-\d{2}$/.test(rec.entry_date)) {
          skipped++;
          continue;
        }
        rows.push(rec);
      }
      if (rows.length === 0) {
        setMsg("No valid rows — need a Date column formatted YYYY-MM-DD.");
        return;
      }
      const res = await importEntries(dealershipId, rows);
      if (!res.ok) {
        setMsg(res.error ?? "Import failed.");
        return;
      }
      setMsg(
        `Imported ${res.imported} row${res.imported === 1 ? "" : "s"}${
          skipped ? `, skipped ${skipped}` : ""
        }. Reload to see them.`,
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
          Upload or paste a CSV with a header row. Columns match the Export —
          a <strong>Date</strong> column (YYYY-MM-DD) is required; New/Used
          units and front/back gross, the activity counts, and Notes are read;
          the derived gross columns are ignored. Rows with an existing date are
          overwritten.
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) setText(await f.text());
          }}
          className="text-sm"
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="Date,New units,New front,New back,Used units,Used front,Used back,Manager calls,Sales calls,Appointments,Confirmed appts,Notes"
          className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 font-mono text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700"
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={run}
            disabled={busy || !text.trim()}
            className="w-fit rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? "Importing…" : "Import"}
          </button>
          {msg ? <p className="text-sm text-zinc-500">{msg}</p> : null}
        </div>
      </div>
    </details>
  );
}
