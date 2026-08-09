/**
 * Whether a save actually changes a stored day's numbers.
 *
 * The daily report email and the push both fire from saveEntry. Without this,
 * every resubmit — a double-click, a stuck client, a re-save with no edits —
 * sends the whole recipient list another copy. Comparing against what was
 * already stored lets those no-op saves stay silent: the first save of a day
 * (no previous row) and any real edit still notify; an identical re-save does
 * not.
 */
export interface EntryValues {
  new_units: number;
  used_units: number;
  new_front_end_gross: number;
  new_back_end_gross: number;
  used_front_end_gross: number;
  used_back_end_gross: number;
  sprinter_units: number;
  sprinter_front_end_gross: number;
  sprinter_back_end_gross: number;
  sales_calls: number;
  appointments: number;
  notes: string | null;
}

const NUMERIC_KEYS = [
  "new_units",
  "used_units",
  "new_front_end_gross",
  "new_back_end_gross",
  "used_front_end_gross",
  "used_back_end_gross",
  "sprinter_units",
  "sprinter_front_end_gross",
  "sprinter_back_end_gross",
  "sales_calls",
  "appointments",
] as const;

export function entryChanged(
  prev: EntryValues | null | undefined,
  next: EntryValues,
): boolean {
  if (!prev) return true;
  for (const key of NUMERIC_KEYS) {
    // Coerced through Number so a numeric string from the row (Postgres numeric
    // can arrive as a string) compares equal to the form's number.
    if (Number(prev[key]) !== Number(next[key])) return true;
  }
  return (prev.notes ?? null) !== (next.notes ?? null);
}
