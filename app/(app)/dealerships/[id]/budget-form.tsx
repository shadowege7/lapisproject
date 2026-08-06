import { saveBudget } from "./budget-actions";

const inputClass =
  "w-24 rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700";

/**
 * This month's unit goal for one store.
 *
 * Read-only for everyone except super admins and people an admin has given
 * budget access — the same rule the database enforces, so this only decides
 * whether the boxes are editable, never whether the write is allowed.
 */
export function BudgetForm({
  dealershipId,
  month,
  tracksSprinters,
  budget,
  canEdit,
  saved,
}: {
  dealershipId: string;
  month: string;
  tracksSprinters: boolean;
  budget: {
    new_units: number;
    used_units: number;
    sprinter_units: number;
    updated_at: string;
  } | null;
  canEdit: boolean;
  saved: boolean;
}) {
  const fields: [string, string, number][] = [
    ["New", "new_units", budget?.new_units ?? 0],
    ["Used", "used_units", budget?.used_units ?? 0],
    ...(tracksSprinters
      ? ([["Sprinter", "sprinter_units", budget?.sprinter_units ?? 0]] as [
          string,
          string,
          number,
        ][])
      : []),
  ];

  const total = fields.reduce((sum, [, , value]) => sum + value, 0);

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[var(--surface)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-medium">Budget · this month</h2>
        <p className="text-xs text-zinc-500">
          {budget
            ? `${total} units`
            : "Not set — the dashboard shows no pace without it"}
        </p>
      </div>

      <p className="mt-1 text-xs text-zinc-500">
        The unit goal for the month. The dashboard turns each projected figure
        green when it is on pace to reach this, red when it is not. Units only —
        no gross.
      </p>

      {saved ? (
        <p
          role="status"
          className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300"
        >
          Budget saved.
        </p>
      ) : null}

      {canEdit ? (
        <form action={saveBudget} className="mt-3 flex flex-wrap items-end gap-3">
          <input type="hidden" name="dealership_id" value={dealershipId} />
          <input type="hidden" name="month" value={month} />
          {fields.map(([label, name, value]) => (
            <label key={name} className="flex flex-col gap-1 text-sm font-medium">
              {label}
              <input
                type="number"
                name={name}
                min={0}
                step={1}
                defaultValue={value}
                required
                className={inputClass}
              />
            </label>
          ))}
          <button
            type="submit"
            className="rounded-md btn-primary px-3 py-2 text-sm font-semibold shadow-sm transition-colors"
          >
            Save budget
          </button>
        </form>
      ) : (
        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {fields.map(([label, name, value]) => (
            <div key={name} className="flex items-baseline gap-2">
              <dt className="text-zinc-500">{label}</dt>
              <dd className="font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {budget ? (
        <p className="mt-2 text-xs text-zinc-400">
          Last changed{" "}
          {new Date(budget.updated_at).toLocaleString("en-US", {
            timeZone: "America/Los_Angeles",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}{" "}
          PT
        </p>
      ) : null}
    </section>
  );
}
