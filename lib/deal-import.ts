import type { Cell } from "@/lib/xlsx-lite";

/**
 * Turning a DMS deal export (one row per car deal) into the store's daily
 * numbers. Shared by the browser (to preview) and the server action (to save),
 * so what the preview shows is exactly what gets written.
 *
 * Only six columns matter: Date, Type, FE, Ttl BE, Sls 1 and Sls 2. Everything
 * else in the export is ignored, with one exception: the export has no
 * Sprinter type, so for a store that tracks Sprinters a deal whose Type is New
 * and whose Model contains "Sprinter" counts as a Sprinter instead of a New
 * unit. A Used deal is never a Sprinter.
 *
 * A deal with "D" in Sls 1 is left out of every number — store and
 * salespeople alike — whether or not the store tracks salespeople.
 *
 * Salesperson rules (only for stores with salesperson tracking on):
 *   - A name in Sls 2 splits the deal: half a unit and half the gross each.
 *     A dash (or blank) in Sls 2 means no split.
 *   - A blank Sls 1 is a deal nobody is credited with; it still counts for
 *     the store.
 */

export type DealType = "new" | "used" | "sprinter";

export interface Deal {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  type: DealType;
  front: number;
  back: number;
  /** Raw salesperson text, whitespace-collapsed. Blank when absent. */
  sls1: string;
  sls2: string;
}

export interface SkippedRow {
  row: number;
  reason: string;
}

export interface ParsedDeals {
  deals: Deal[];
  skipped: SkippedRow[];
  /** Spreadsheet row numbers of deals left out because Sls 1 is "D". */
  excluded: number[];
  /** True when the file had Sls 1 / Sls 2 columns at all. */
  hasSalespeople: boolean;
}

/** How one name from the file is credited. */
export type Assignment =
  | { kind: "person"; id: string }
  | { kind: "house" }
  | { kind: "add" };

export interface DayTotals {
  date: string;
  deals: number;
  new_units: number;
  used_units: number;
  sprinter_units: number;
  new_front_end_gross: number;
  new_back_end_gross: number;
  used_front_end_gross: number;
  used_back_end_gross: number;
  sprinter_front_end_gross: number;
  sprinter_back_end_gross: number;
}

export interface PersonDay {
  new_units: number;
  used_units: number;
  sprinter_units: number;
  front_end_gross: number;
  back_end_gross: number;
}

export interface RosterName {
  id: string;
  first_name: string;
  last_name: string;
}

export const MAX_DEALS = 5000;
export const MAX_SPAN_DAYS = 400;

// ---------------------------------------------------------------------------
// Cells
// ---------------------------------------------------------------------------

const cellText = (c: Cell | undefined) =>
  c === null || c === undefined ? "" : String(c).replace(/\s+/g, " ").trim();

function isRealDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Excel's 1900 date system: serial 1 is 1900-01-01, via the 1899-12-30 epoch. */
export function excelSerialToISO(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 20000 || serial > 80000) return null;
  const dt = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000);
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

/** MM/DD/YYYY (the export's format), M/D/YY, MM-DD-YYYY, ISO, or an Excel serial. */
export function toISODate(c: Cell | undefined): string | null {
  if (typeof c === "number") return excelSerialToISO(c);
  const val = cellText(c);
  if (!val) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(val);
  if (m) {
    const [y, mo, d] = [+m[1], +m[2], +m[3]];
    return isRealDate(y, mo, d) ? `${y}-${pad2(mo)}-${pad2(d)}` : null;
  }
  m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{2}|\d{4})$/.exec(val);
  if (m) {
    const mo = +m[1];
    const d = +m[2];
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return isRealDate(y, mo, d) ? `${y}-${pad2(mo)}-${pad2(d)}` : null;
  }
  return null;
}

/** 1234.5, "$1,234.50", "(1,234.50)" → number; blank or "-" → 0; else null. */
export function toMoney(c: Cell | undefined): number | null {
  if (typeof c === "number") return Number.isFinite(c) ? c : null;
  let val = cellText(c);
  if (val === "" || val === "-") return 0;
  let negative = false;
  if (/^\(.*\)$/.test(val)) {
    negative = true;
    val = val.slice(1, -1);
  }
  val = val.replace(/[$,\s]/g, "");
  if (!/^-?\d*\.?\d+$/.test(val)) return null;
  const n = Number(val);
  return negative ? -n : n;
}

export function classifyType(
  type: string,
  model: string,
  sprinters: boolean,
): DealType | null {
  const t = type.toLowerCase();
  if (t.startsWith("new")) {
    // The export has no Sprinter type: a new Sprinter is a New deal whose
    // Model says so. Used Sprinters stay Used.
    return sprinters && model.toLowerCase().includes("sprinter") ? "sprinter" : "new";
  }
  if (/^(used|cpo|certified|pre-?owned)/.test(t)) return "used";
  return null;
}

// ---------------------------------------------------------------------------
// Parsing the sheet
// ---------------------------------------------------------------------------

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Finds the header row (the one carrying Date, Type, FE and Ttl BE — the
 * export puts a title cell and an "Overall Total" row around it) and reads
 * every deal below it. Rows without a date are passed over silently; that is
 * how totals and blank rows look. Rows with a date that cannot be read are
 * reported back so nothing disappears unexplained.
 */
export function parseDealGrid(grid: Cell[][], sprinters: boolean): ParsedDeals {
  let headerRow = -1;
  let col: Record<string, number> = {};
  for (let r = 0; r < Math.min(grid.length, 30); r++) {
    const map: Record<string, number> = {};
    (grid[r] ?? []).forEach((c, i) => {
      const key = norm(cellText(c));
      if (key && map[key] === undefined) map[key] = i;
    });
    if (
      map.date !== undefined &&
      map.type !== undefined &&
      map.fe !== undefined &&
      map.ttlbe !== undefined
    ) {
      headerRow = r;
      col = map;
      break;
    }
  }
  if (headerRow < 0) {
    throw new Error(
      "Couldn't find the header row. The sheet needs Date, Type, FE and Ttl BE columns.",
    );
  }

  const sls1 = col.sls1;
  const sls2 = col.sls2;
  const model = col.model;
  const deals: Deal[] = [];
  const skipped: SkippedRow[] = [];
  const excluded: number[] = [];

  for (let r = headerRow + 1; r < grid.length; r++) {
    const row = grid[r] ?? [];
    const rowNum = r + 1;
    const rawDate = row[col.date];
    if (cellText(rawDate) === "") continue;
    if (sls1 !== undefined && isHouse(cellText(row[sls1]))) {
      excluded.push(rowNum);
      continue;
    }
    const date = toISODate(rawDate);
    if (!date) {
      skipped.push({ row: rowNum, reason: `"${cellText(rawDate)}" isn't a date` });
      continue;
    }
    const typeText = cellText(row[col.type]);
    const type = classifyType(
      typeText,
      model !== undefined ? cellText(row[model]) : "",
      sprinters,
    );
    if (!type) {
      skipped.push({
        row: rowNum,
        reason: typeText ? `Type "${typeText}" isn't New or Used` : "Type is blank",
      });
      continue;
    }
    const front = toMoney(row[col.fe]);
    const back = toMoney(row[col.ttlbe]);
    if (front === null || back === null) {
      skipped.push({ row: rowNum, reason: "FE or Ttl BE isn't a number" });
      continue;
    }
    deals.push({
      date,
      type,
      front,
      back,
      sls1: sls1 !== undefined ? cellText(row[sls1]) : "",
      sls2: sls2 !== undefined ? cellText(row[sls2]) : "",
    });
  }

  return { deals, skipped, excluded, hasSalespeople: sls1 !== undefined };
}

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

/** Lower-cased, single-spaced, trailing dots dropped: "Lauren E." → "lauren e". */
export function nameKey(raw: string): string {
  return raw.replace(/\./g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

/** A blank or a dash: nobody. */
export function isNobody(raw: string): boolean {
  const k = raw.trim();
  return k === "" || /^[-–—]+$/.test(k);
}

/** "D" alone is the house. In Sls 1 it keeps the deal out of every number. */
export function isHouse(raw: string): boolean {
  return nameKey(raw) === "d";
}

/** Who a deal is credited to: name keys (null = house) with their share. */
export function dealCredits(deal: Deal): { key: string | null; share: number }[] {
  const who = (raw: string) => (isNobody(raw) || isHouse(raw) ? null : nameKey(raw));
  const a = who(deal.sls1);
  if (isNobody(deal.sls2)) return [{ key: a, share: 1 }];
  const b = who(deal.sls2);
  if (a !== null && a === b) return [{ key: a, share: 1 }];
  return [
    { key: a, share: 0.5 },
    { key: b, share: 0.5 },
  ];
}

/**
 * Every salesperson name in the deals, keyed by nameKey, with how it was
 * written the first time it appeared and how many deals (halves count as half)
 * it is on.
 */
export function collectNames(deals: Deal[]): Map<string, { label: string; deals: number }> {
  const out = new Map<string, { label: string; deals: number }>();
  for (const d of deals) {
    const labels = [d.sls1, d.sls2];
    for (const c of dealCredits(d)) {
      if (!c.key) continue;
      const label =
        labels.find((l) => !isNobody(l) && nameKey(l) === c.key) ?? c.key;
      const cur = out.get(c.key) ?? { label, deals: 0 };
      cur.deals += c.share;
      out.set(c.key, cur);
    }
  }
  return out;
}

/** "Lauren E" → { first: "Lauren", last: "E" }. */
export function splitName(label: string): { first: string; last: string } {
  const parts = label.replace(/\s+/g, " ").trim().split(" ");
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

/**
 * Best roster match for a name from the export, or null when there is none
 * or more than one. The export writes "First L" (last initial); the roster
 * holds full names. Tried in order: exact full name, first name plus last
 * initial, then a bare first name that only one person has.
 */
export function autoMatch(key: string, roster: RosterName[]): string | null {
  const full = (p: RosterName) => nameKey(`${p.first_name} ${p.last_name}`);
  const first = (p: RosterName) => nameKey(p.first_name);
  const initial = (p: RosterName) => nameKey(p.last_name).charAt(0);

  const one = (hits: RosterName[]) => (hits.length === 1 ? hits[0].id : null);

  const exact = roster.filter((p) => full(p) === key);
  if (exact.length) return one(exact);

  const tokens = key.split(" ");
  if (tokens.length >= 2) {
    const f = tokens.slice(0, -1).join(" ");
    const l = tokens[tokens.length - 1];
    if (l.length === 1) {
      return one(roster.filter((p) => first(p) === f && initial(p) === l));
    }
    return null;
  }
  return one(roster.filter((p) => first(p) === key));
}

// ---------------------------------------------------------------------------
// Rolling up
// ---------------------------------------------------------------------------

const cents = (n: number) => Math.round(n * 100) / 100;

function emptyDay(date: string): DayTotals {
  return {
    date,
    deals: 0,
    new_units: 0,
    used_units: 0,
    sprinter_units: 0,
    new_front_end_gross: 0,
    new_back_end_gross: 0,
    used_front_end_gross: 0,
    used_back_end_gross: 0,
    sprinter_front_end_gross: 0,
    sprinter_back_end_gross: 0,
  };
}

/**
 * Store totals per day and, when `resolve` is given, each salesperson's share
 * per day. `resolve` maps a name key to a salesperson id, or null for the
 * house. Every deal is one whole unit for the store; only salespeople get
 * halves.
 */
export function rollupDeals(
  deals: Deal[],
  resolve?: (key: string) => string | null,
): {
  days: Map<string, DayTotals>;
  people: Map<string, Map<string, PersonDay>>;
} {
  const days = new Map<string, DayTotals>();
  const people = new Map<string, Map<string, PersonDay>>();

  for (const d of deals) {
    const day = days.get(d.date) ?? emptyDay(d.date);
    day.deals += 1;
    if (d.type === "new") {
      day.new_units += 1;
      day.new_front_end_gross += d.front;
      day.new_back_end_gross += d.back;
    } else if (d.type === "used") {
      day.used_units += 1;
      day.used_front_end_gross += d.front;
      day.used_back_end_gross += d.back;
    } else {
      day.sprinter_units += 1;
      day.sprinter_front_end_gross += d.front;
      day.sprinter_back_end_gross += d.back;
    }
    days.set(d.date, day);

    if (!resolve) continue;
    for (const c of dealCredits(d)) {
      const id = c.key ? resolve(c.key) : null;
      if (!id) continue;
      const byPerson = people.get(d.date) ?? new Map<string, PersonDay>();
      const p = byPerson.get(id) ?? {
        new_units: 0,
        used_units: 0,
        sprinter_units: 0,
        front_end_gross: 0,
        back_end_gross: 0,
      };
      if (d.type === "new") p.new_units += c.share;
      else if (d.type === "used") p.used_units += c.share;
      else p.sprinter_units += c.share;
      p.front_end_gross += d.front * c.share;
      p.back_end_gross += d.back * c.share;
      byPerson.set(id, p);
      people.set(d.date, byPerson);
    }
  }

  for (const day of days.values()) {
    day.new_front_end_gross = cents(day.new_front_end_gross);
    day.new_back_end_gross = cents(day.new_back_end_gross);
    day.used_front_end_gross = cents(day.used_front_end_gross);
    day.used_back_end_gross = cents(day.used_back_end_gross);
    day.sprinter_front_end_gross = cents(day.sprinter_front_end_gross);
    day.sprinter_back_end_gross = cents(day.sprinter_back_end_gross);
  }
  for (const byPerson of people.values()) {
    for (const p of byPerson.values()) {
      p.front_end_gross = cents(p.front_end_gross);
      p.back_end_gross = cents(p.back_end_gross);
    }
  }
  return { days, people };
}

/** Every ISO date from `from` to `to`, inclusive. */
export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  const [y, m, d] = from.split("-").map(Number);
  const cur = new Date(Date.UTC(y, m - 1, d));
  for (let i = 0; i <= MAX_SPAN_DAYS + 1; i++) {
    const iso = `${cur.getUTCFullYear()}-${pad2(cur.getUTCMonth() + 1)}-${pad2(cur.getUTCDate())}`;
    if (iso > to) break;
    out.push(iso);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

export function dateSpan(deals: Deal[]): { from: string; to: string } | null {
  if (!deals.length) return null;
  let from = deals[0].date;
  let to = deals[0].date;
  for (const d of deals) {
    if (d.date < from) from = d.date;
    if (d.date > to) to = d.date;
  }
  return { from, to };
}

export interface DateRange {
  /** ISO dates, inclusive: the range picked when exporting from ReverseRisk. */
  from: string;
  to: string;
}

const shortDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}/${y}`;
};

/**
 * Why a range can't be imported, or null when it can. The range is what the
 * import replaces: every day in it ends up matching the file, including days
 * the file has no deals for (they become zero). So it has to be a real,
 * finished span, and every deal has to sit inside it — a deal outside means
 * the dates typed in don't match the export.
 */
export function rangeError(range: DateRange, deals: Deal[], today: string): string | null {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!iso.test(range.from) || !iso.test(range.to) || !toISODate(range.from) || !toISODate(range.to)) {
    return "Enter the From and To dates of the export.";
  }
  if (range.from > range.to) return "The From date is after the To date.";
  if (range.to > today) {
    return "The To date is in the future. Numbers can't be saved for a day that hasn't happened.";
  }
  if (eachDay(range.from, range.to).length > MAX_SPAN_DAYS) {
    return `That range is more than ${MAX_SPAN_DAYS} days. Split it into smaller exports.`;
  }
  const outside = deals.filter((d) => d.date < range.from || d.date > range.to);
  if (outside.length) {
    const dates = [...new Set(outside.map((d) => d.date))].sort();
    const list = dates.slice(0, 3).map(shortDate).join(", ") + (dates.length > 3 ? "…" : "");
    return `${outside.length} deal${outside.length === 1 ? " is" : "s are"} dated outside ${shortDate(range.from)} – ${shortDate(range.to)} (${list}). Check the dates match the export.`;
  }
  return null;
}

/** Server-side shape check on deals that came from the browser. */
export function validDeal(d: unknown): d is Deal {
  if (!d || typeof d !== "object") return false;
  const x = d as Record<string, unknown>;
  return (
    typeof x.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(x.date) &&
    toISODate(x.date) === x.date &&
    (x.type === "new" || x.type === "used" || x.type === "sprinter") &&
    typeof x.front === "number" &&
    Number.isFinite(x.front) &&
    Math.abs(x.front) < 1e8 &&
    typeof x.back === "number" &&
    Number.isFinite(x.back) &&
    Math.abs(x.back) < 1e8 &&
    typeof x.sls1 === "string" &&
    x.sls1.length <= 120 &&
    typeof x.sls2 === "string" &&
    x.sls2.length <= 120
  );
}
