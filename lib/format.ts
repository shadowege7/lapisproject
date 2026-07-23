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

export function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function monthStartISODate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function yearStartISODate(): string {
  const d = new Date();
  return `${d.getFullYear()}-01-01`;
}
