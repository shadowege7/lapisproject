import { monthStartISODate, todayISODate, yearStartISODate } from "@/lib/format";

/**
 * Shared helpers for per-salesperson tracking. The rules that matter are
 * enforced in the database (0040_salesperson_tracking.sql in the Launchpad
 * repo); these only shape what the pages show and send.
 */

export interface RosterPerson {
  id: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  removed_at: string | null;
}

export function salespersonName(p: { first_name: string; last_name: string }) {
  return [p.first_name.trim(), p.last_name.trim()].filter(Boolean).join(" ");
}

export function salespersonInitials(p: { first_name: string; last_name: string }) {
  const first = p.first_name.trim()[0] ?? "";
  const last = p.last_name.trim()[0] ?? "";
  return (first + last).toUpperCase() || "?";
}

/** Roster order: first name, then last, case-insensitive. */
export function byName(a: RosterPerson, b: RosterPerson) {
  return salespersonName(a).localeCompare(salespersonName(b), undefined, {
    sensitivity: "base",
  });
}

/**
 * A salesperson's units: whole or half (a split deal is half a car to each
 * person). Mirrors the database's half-step check so the form can say what is
 * wrong instead of surfacing a constraint name.
 */
export function isHalfStep(value: number) {
  return Number.isFinite(value) && value >= 0 && Number.isInteger(value * 2);
}

/** "1.5", "2", "0.5" — no trailing ".0" on whole numbers. */
export function formatUnits(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export type SalespersonPeriod = "today" | "mtd" | "ytd";
export type SalespersonRank = "units" | "gross";

export function parsePeriod(value: string | undefined): SalespersonPeriod {
  return value === "today" || value === "ytd" ? value : "mtd";
}

export function parseRank(value: string | undefined): SalespersonRank {
  return value === "gross" ? "gross" : "units";
}

/** Inclusive date range for a period, in the app's (Pacific) business days. */
export function periodRange(period: SalespersonPeriod): { from: string; to: string } {
  const to = todayISODate();
  if (period === "today") return { from: to, to };
  if (period === "ytd") return { from: yearStartISODate(), to };
  return { from: monthStartISODate(), to };
}

/**
 * Form field name for one salesperson's value on the entry form,
 * `sp:<id>:<field>`. Parsed back by parseSalespersonFields().
 */
export function salespersonField(id: string, key: string) {
  return `sp:${id}:${key}`;
}

const FIELDS = [
  "new_units",
  "used_units",
  "sprinter_units",
  "front_end_gross",
  "back_end_gross",
] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Reads every `sp:<id>:<field>` value out of a submitted entry form.
 * Returns the rows, or an error message a manager can act on.
 *
 * Which ids are allowed is not checked here: the database's composite foreign
 * key refuses a salesperson from another store, and RLS refuses a store the
 * caller cannot edit.
 */
export function parseSalespersonFields(
  formData: FormData,
  sprinters: boolean,
):
  | { ok: true; rows: import("@/lib/database.types").SalespersonDayInput[] }
  | { ok: false; error: string } {
  const byId = new Map<string, Record<string, number>>();
  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith("sp:")) continue;
    const [, id, field] = key.split(":");
    if (!id || !UUID.test(id) || !(FIELDS as readonly string[]).includes(field)) continue;
    const text = String(raw).trim();
    const value = text === "" ? 0 : Number(text);
    if (!Number.isFinite(value)) {
      return { ok: false, error: "A salesperson number isn't a valid number." };
    }
    const entry = byId.get(id) ?? {};
    entry[field] = value;
    byId.set(id, entry);
  }

  const rows = [...byId.entries()].map(([id, v]) => ({
    salesperson_id: id,
    new_units: v.new_units ?? 0,
    used_units: v.used_units ?? 0,
    sprinter_units: sprinters ? (v.sprinter_units ?? 0) : 0,
    front_end_gross: v.front_end_gross ?? 0,
    back_end_gross: v.back_end_gross ?? 0,
  }));

  for (const r of rows) {
    if (![r.new_units, r.used_units, r.sprinter_units].every(isHalfStep)) {
      return {
        ok: false,
        error:
          "Salesperson units must be whole or half numbers (0.5 for a split deal).",
      };
    }
  }
  return { ok: true, rows };
}
