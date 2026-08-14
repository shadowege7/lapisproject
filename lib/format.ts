const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatCurrency(value: number | null | undefined): string {
  return currencyFormatter.format(value ?? 0);
}

export function formatMonth(dateString: string): string {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function formatYear(dateString: string): string {
  return new Date(`${dateString}T00:00:00`).getFullYear().toString();
}

/**
 * A date-only ISO string ("2026-08-13") as a short day label ("Aug 13").
 *
 * `entry_date` is already the store's PT business day, so this is a pure
 * formatting of the parts — never a timezone conversion. It builds the Date
 * from the numeric parts at UTC midnight and formats it back in UTC, so the
 * label can never drift a day the way `new Date("2026-08-13")` would when the
 * server sits west of UTC.
 */
export function formatShortDay(dateString: string): string {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

// The dealership group operates on Pacific time; deriving "today" and month/
// year boundaries in this zone (rather than the server's UTC) keeps the
// business day aligned with the stores. America/Los_Angeles auto-handles
// PST/PDT.
export const APP_TIME_ZONE = "America/Los_Angeles";

/** Year, 1-12 month, and day-of-month of `date` in the app's time zone. */
export function datePartsInAppTZ(date: Date = new Date()): {
  year: number;
  month: number;
  day: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

export function todayISODate(): string {
  const { year, month, day } = datePartsInAppTZ();
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function monthStartISODate(): string {
  const { year, month } = datePartsInAppTZ();
  return `${year}-${pad2(month)}-01`;
}

export function yearStartISODate(): string {
  const { year } = datePartsInAppTZ();
  return `${year}-01-01`;
}
