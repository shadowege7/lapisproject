import { formatCurrency } from "@/lib/format";
import { ExportCsvButton } from "./export-button";
import { Card, GROUP_RULE, GROUP_PAD } from "./table-chrome";

export interface SummaryRow {
  label: string;
  total_new_units: number;
  total_used_units: number;
  total_sprinter_units: number;
  total_new_front_end_gross: number;
  total_new_back_end_gross: number;
  total_used_front_end_gross: number;
  total_used_back_end_gross: number;
  total_sprinter_front_end_gross: number;
  total_sprinter_back_end_gross: number;
  total_gross: number;
  days_logged: number;
}

/**
 * Annual and Monthly are the same table; `compact` is what tells them apart.
 *
 * The full table bands its four-column blocks under spanning group headers, so
 * the leaf headers can drop to Units / Front / Back / Gross. The compact table
 * shows one column per category, where a group header spanning a single column
 * would be a row of chrome saying nothing the leaf header does not already
 * say — so it keeps the long labels and the single header row, and takes its
 * grouping from the same vertical rules.
 */
export function SummarySection({
  title,
  rows,
  compact = false,
  filename,
  sprinters,
}: {
  title: string;
  rows: SummaryRow[];
  compact?: boolean;
  filename: string;
  sprinters: boolean;
}) {
  // The CSV always carries the full breakdown, even in the compact table:
  // exporting is where someone goes to do their own sums.
  const csvHeaders = [
    "Period",
    "New units",
    "New front",
    "New back",
    "New gross",
    "Used units",
    "Used front",
    "Used back",
    "Used gross",
    ...(sprinters
      ? ["Sprinter units", "Sprinter front", "Sprinter back", "Sprinter gross"]
      : []),
    "Total gross",
    "Days",
  ];
  const csvRows: (string | number)[][] = rows.map((r) => [
    r.label,
    r.total_new_units,
    r.total_new_front_end_gross,
    r.total_new_back_end_gross,
    r.total_new_front_end_gross + r.total_new_back_end_gross,
    r.total_used_units,
    r.total_used_front_end_gross,
    r.total_used_back_end_gross,
    r.total_used_front_end_gross + r.total_used_back_end_gross,
    ...(sprinters
      ? [
          r.total_sprinter_units,
          r.total_sprinter_front_end_gross,
          r.total_sprinter_back_end_gross,
          r.total_sprinter_front_end_gross + r.total_sprinter_back_end_gross,
        ]
      : []),
    r.total_gross,
    r.days_logged,
  ]);

  const group = `${GROUP_RULE} ${GROUP_PAD}`;
  const figure = "py-2.5 pr-4 font-mono tabular-nums";

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {rows.length > 0 ? (
          <ExportCsvButton
            filename={filename}
            headers={csvHeaders}
            rows={csvRows}
          />
        ) : null}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No {title.toLowerCase()} totals yet — they appear once daily entries
          are logged.
        </p>
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead>
              {compact ? null : (
                <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500">
                  <th className="pb-1 pr-4 pt-2.5" />
                  <th
                    scope="colgroup"
                    colSpan={4}
                    className={`${group} pb-1 pr-4 pt-2.5 font-semibold`}
                  >
                    New
                  </th>
                  <th
                    scope="colgroup"
                    colSpan={4}
                    className={`${group} pb-1 pr-4 pt-2.5 font-semibold`}
                  >
                    Used
                  </th>
                  {sprinters ? (
                    <th
                      scope="colgroup"
                      colSpan={4}
                      className={`${group} pb-1 pr-4 pt-2.5 font-semibold`}
                    >
                      Sprinter
                    </th>
                  ) : null}
                  <th
                    scope="colgroup"
                    className={`${group} pb-1 pr-4 pt-2.5 font-semibold text-blue-700 dark:text-blue-400`}
                  >
                    Total
                  </th>
                  <th className="pb-1 pr-4 pt-2.5" />
                </tr>
              )}
              <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                <th scope="col" className="py-2.5 pr-4 font-medium">
                  Period
                </th>
                <th
                  scope="col"
                  className={`${group} py-2.5 pr-4 font-medium`}
                >
                  {compact ? "New units" : "Units"}
                </th>
                {compact ? null : (
                  <>
                    <th scope="col" className="py-2.5 pr-4 font-medium">
                      Front
                    </th>
                    <th scope="col" className="py-2.5 pr-4 font-medium">
                      Back
                    </th>
                    <th scope="col" className="py-2.5 pr-4 font-medium">
                      Gross
                    </th>
                  </>
                )}
                <th
                  scope="col"
                  className={`${group} py-2.5 pr-4 font-medium`}
                >
                  {compact ? "Used units" : "Units"}
                </th>
                {compact ? null : (
                  <>
                    <th scope="col" className="py-2.5 pr-4 font-medium">
                      Front
                    </th>
                    <th scope="col" className="py-2.5 pr-4 font-medium">
                      Back
                    </th>
                    <th scope="col" className="py-2.5 pr-4 font-medium">
                      Gross
                    </th>
                  </>
                )}
                {sprinters ? (
                  <>
                    <th
                      scope="col"
                      className={`${group} py-2.5 pr-4 font-medium`}
                    >
                      {compact ? "Sprinter units" : "Units"}
                    </th>
                    {compact ? null : (
                      <>
                        <th scope="col" className="py-2.5 pr-4 font-medium">
                          Front
                        </th>
                        <th scope="col" className="py-2.5 pr-4 font-medium">
                          Back
                        </th>
                        <th scope="col" className="py-2.5 pr-4 font-medium">
                          Gross
                        </th>
                      </>
                    )}
                  </>
                ) : null}
                <th
                  scope="col"
                  className={`${group} py-2.5 pr-4 font-medium text-blue-700 dark:text-blue-400`}
                >
                  {compact ? "Total gross" : "Gross"}
                </th>
                <th scope="col" className="py-2.5 pr-4 font-medium">
                  Days
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.label}
                  className="border-b border-zinc-100 last:border-0 hover:bg-blue-50/40 dark:border-zinc-900 dark:hover:bg-blue-950/20"
                >
                  <td className="py-2.5 pr-4 font-medium">{r.label}</td>
                  <td className={`${group} ${figure}`}>{r.total_new_units}</td>
                  {compact ? null : (
                    <>
                      <td className={figure}>
                        {formatCurrency(r.total_new_front_end_gross)}
                      </td>
                      <td className={figure}>
                        {formatCurrency(r.total_new_back_end_gross)}
                      </td>
                      <td className={`${figure} font-medium`}>
                        {formatCurrency(
                          r.total_new_front_end_gross +
                            r.total_new_back_end_gross,
                        )}
                      </td>
                    </>
                  )}
                  <td className={`${group} ${figure}`}>{r.total_used_units}</td>
                  {compact ? null : (
                    <>
                      <td className={figure}>
                        {formatCurrency(r.total_used_front_end_gross)}
                      </td>
                      <td className={figure}>
                        {formatCurrency(r.total_used_back_end_gross)}
                      </td>
                      <td className={`${figure} font-medium`}>
                        {formatCurrency(
                          r.total_used_front_end_gross +
                            r.total_used_back_end_gross,
                        )}
                      </td>
                    </>
                  )}
                  {sprinters ? (
                    <>
                      <td className={`${group} ${figure}`}>
                        {r.total_sprinter_units}
                      </td>
                      {compact ? null : (
                        <>
                          <td className={figure}>
                            {formatCurrency(r.total_sprinter_front_end_gross)}
                          </td>
                          <td className={figure}>
                            {formatCurrency(r.total_sprinter_back_end_gross)}
                          </td>
                          <td className={`${figure} font-medium`}>
                            {formatCurrency(
                              r.total_sprinter_front_end_gross +
                                r.total_sprinter_back_end_gross,
                            )}
                          </td>
                        </>
                      )}
                    </>
                  ) : null}
                  <td
                    className={`${group} ${figure} font-semibold text-blue-700 dark:text-blue-400`}
                  >
                    {formatCurrency(r.total_gross)}
                  </td>
                  <td className={figure}>{r.days_logged}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </section>
  );
}
