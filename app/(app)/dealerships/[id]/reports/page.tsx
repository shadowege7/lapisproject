import { Fragment } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, effectiveRole } from "@/lib/auth";
import {
  formatCurrency,
  formatMonth,
  formatYear,
  monthStartISODate,
  todayISODate,
} from "@/lib/format";
import { projectMonthEnd } from "@/lib/projection";
import { ConfirmButton } from "@/app/(app)/admin/confirm-button";
import { deleteEntry } from "./actions";
import { ExportCsvButton } from "./export-button";
import { PrintButton } from "./print-button";
import { ImportForm } from "./import-form";

interface SummaryRow {
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

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: dealershipId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();

  const [
    { data: dealership },
    { data: membership },
    { data: dailyEntries },
    { data: monthly },
    { data: annual },
  ] = await Promise.all([
    supabase
      .from("dealerships")
      .select("id, name, tracks_sprinters")
      .eq("id", dealershipId)
      .single(),
    supabase
      .from("dealership_members")
      .select("role")
      .eq("dealership_id", dealershipId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("daily_entries")
      .select("*")
      .eq("dealership_id", dealershipId)
      .order("entry_date", { ascending: false })
      .limit(31),
    supabase
      .from("monthly_summary")
      .select("*")
      .eq("dealership_id", dealershipId)
      .order("month", { ascending: false })
      .limit(12),
    supabase
      .from("annual_summary")
      .select("*")
      .eq("dealership_id", dealershipId)
      .order("year", { ascending: false }),
  ]);

  if (!dealership) notFound();

  const role = effectiveRole(user, membership?.role);
  if (!role) redirect("/dashboard");

  const sprinters = dealership.tracks_sprinters;

  const annualRows: SummaryRow[] = (annual ?? []).map((r) => ({
    label: formatYear(r.year),
    total_new_units: r.total_new_units,
    total_used_units: r.total_used_units,
    total_sprinter_units: r.total_sprinter_units,
    total_new_front_end_gross: r.total_new_front_end_gross,
    total_new_back_end_gross: r.total_new_back_end_gross,
    total_used_front_end_gross: r.total_used_front_end_gross,
    total_used_back_end_gross: r.total_used_back_end_gross,
    total_sprinter_front_end_gross: r.total_sprinter_front_end_gross,
    total_sprinter_back_end_gross: r.total_sprinter_back_end_gross,
    total_gross: r.total_gross,
    days_logged: r.days_logged,
  }));

  const monthlyRows: SummaryRow[] = (monthly ?? []).map((r) => ({
    label: formatMonth(r.month),
    total_new_units: r.total_new_units,
    total_used_units: r.total_used_units,
    total_sprinter_units: r.total_sprinter_units,
    total_new_front_end_gross: r.total_new_front_end_gross,
    total_new_back_end_gross: r.total_new_back_end_gross,
    total_used_front_end_gross: r.total_used_front_end_gross,
    total_used_back_end_gross: r.total_used_back_end_gross,
    total_sprinter_front_end_gross: r.total_sprinter_front_end_gross,
    total_sprinter_back_end_gross: r.total_sprinter_back_end_gross,
    total_gross: r.total_gross,
    days_logged: r.days_logged,
  }));

  const today = todayISODate();
  const todayEntry = (dailyEntries ?? []).find((e) => e.entry_date === today);
  const thisMonth = (monthly ?? []).find(
    (m) => m.month === monthStartISODate(),
  );

  // metric = [label, today value, month-to-date value, isCurrency, emphasize]
  const tE = todayEntry;
  const tm = thisMonth;
  const metrics: [string, number, number, boolean, boolean][] = [
    ["New units", tE?.new_units ?? 0, tm?.total_new_units ?? 0, false, false],
    [
      "New front",
      tE?.new_front_end_gross ?? 0,
      tm?.total_new_front_end_gross ?? 0,
      true,
      false,
    ],
    [
      "New back",
      tE?.new_back_end_gross ?? 0,
      tm?.total_new_back_end_gross ?? 0,
      true,
      false,
    ],
    [
      "New gross",
      (tE?.new_front_end_gross ?? 0) + (tE?.new_back_end_gross ?? 0),
      (tm?.total_new_front_end_gross ?? 0) + (tm?.total_new_back_end_gross ?? 0),
      true,
      true,
    ],
    [
      "Used units",
      tE?.used_units ?? 0,
      tm?.total_used_units ?? 0,
      false,
      false,
    ],
    [
      "Used front",
      tE?.used_front_end_gross ?? 0,
      tm?.total_used_front_end_gross ?? 0,
      true,
      false,
    ],
    [
      "Used back",
      tE?.used_back_end_gross ?? 0,
      tm?.total_used_back_end_gross ?? 0,
      true,
      false,
    ],
    [
      "Used gross",
      (tE?.used_front_end_gross ?? 0) + (tE?.used_back_end_gross ?? 0),
      (tm?.total_used_front_end_gross ?? 0) +
        (tm?.total_used_back_end_gross ?? 0),
      true,
      true,
    ],
    ...(sprinters
      ? ([
          [
            "Sprinter units",
            tE?.sprinter_units ?? 0,
            tm?.total_sprinter_units ?? 0,
            false,
            false,
          ],
          [
            "Sprinter front",
            tE?.sprinter_front_end_gross ?? 0,
            tm?.total_sprinter_front_end_gross ?? 0,
            true,
            false,
          ],
          [
            "Sprinter back",
            tE?.sprinter_back_end_gross ?? 0,
            tm?.total_sprinter_back_end_gross ?? 0,
            true,
            false,
          ],
          [
            "Sprinter gross",
            (tE?.sprinter_front_end_gross ?? 0) +
              (tE?.sprinter_back_end_gross ?? 0),
            (tm?.total_sprinter_front_end_gross ?? 0) +
              (tm?.total_sprinter_back_end_gross ?? 0),
            true,
            true,
          ],
        ] as [string, number, number, boolean, boolean][])
      : []),
    [
      "Total gross",
      (tE?.new_front_end_gross ?? 0) +
        (tE?.new_back_end_gross ?? 0) +
        (tE?.used_front_end_gross ?? 0) +
        (tE?.used_back_end_gross ?? 0) +
        (tE?.sprinter_front_end_gross ?? 0) +
        (tE?.sprinter_back_end_gross ?? 0),
      tm?.total_gross ?? 0,
      true,
      true,
    ],
  ];

  // Date + 4 new + 4 used + total gross, plus 4 more where Sprinters show.
  // Used for the notes row's colSpan and the empty-state message, both of
  // which look broken if the count is off by one.
  const columnCount = 10 + (sprinters ? 4 : 0);

  const slug = dealership.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const dailyCsvHeaders = [
    "Date",
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
    "Sales calls",
    "Appointments",
    "Notes",
  ];
  const dailyCsvRows: (string | number | null)[][] = (dailyEntries ?? []).map(
    (e) => [
      e.entry_date,
      e.new_units,
      e.new_front_end_gross,
      e.new_back_end_gross,
      e.new_front_end_gross + e.new_back_end_gross,
      e.used_units,
      e.used_front_end_gross,
      e.used_back_end_gross,
      e.used_front_end_gross + e.used_back_end_gross,
      ...(sprinters
        ? [
            e.sprinter_units,
            e.sprinter_front_end_gross,
            e.sprinter_back_end_gross,
            e.sprinter_front_end_gross + e.sprinter_back_end_gross,
          ]
        : []),
      e.new_front_end_gross +
        e.new_back_end_gross +
        e.used_front_end_gross +
        e.used_back_end_gross +
        e.sprinter_front_end_gross +
        e.sprinter_back_end_gross,
      e.sales_calls,
      e.appointments,
      e.notes ?? "",
    ],
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Reports
          </p>
          <h1 className="text-xl font-semibold tracking-tight">
            {dealership.name}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <PrintButton />
          <ExportCsvButton
            filename={`${slug}-daily.csv`}
            headers={dailyCsvHeaders}
            rows={dailyCsvRows}
            label="Export daily"
          />
          {role === "editor" ? (
            <Link
              href={`/dealerships/${dealershipId}/entry`}
              className="rounded-md btn-primary px-4 py-2 text-sm font-semibold shadow-sm transition-colors"
            >
              Enter today&apos;s numbers
            </Link>
          ) : null}
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold">
          This month
          <span className="ml-2 font-normal text-zinc-400">
            {formatMonth(monthStartISODate())}
          </span>
        </h2>
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                <th className="py-2.5 pr-4 font-medium">Metric</th>
                <th className="py-2.5 pr-4 font-medium">Today</th>
                <th className="py-2.5 pr-4 font-medium">Month to date</th>
                <th className="py-2.5 pr-4 font-medium text-blue-700 dark:text-blue-400">
                  Projected month-end
                </th>
              </tr>
            </thead>
            <tbody>
              {metrics.map(([label, todayVal, mtdVal, isCurrency, emphasize]) => (
                <tr
                  key={label}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                >
                  <td
                    className={`py-2.5 pr-4 font-medium ${
                      emphasize ? "" : "text-zinc-500"
                    }`}
                  >
                    {label}
                  </td>
                  <td className={`py-2.5 pr-4 ${emphasize ? "font-medium" : ""}`}>
                    {formatMetric(todayVal, isCurrency)}
                  </td>
                  <td className={`py-2.5 pr-4 ${emphasize ? "font-medium" : ""}`}>
                    {formatMetric(mtdVal, isCurrency)}
                  </td>
                  <td className="py-2.5 pr-4 font-semibold text-blue-700 dark:text-blue-400">
                    {formatMetric(projectMonthEnd(mtdVal), isCurrency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <p className="mt-2 text-xs text-zinc-400">
          Projected month-end assumes the current daily pace holds for the rest
          of the month.
        </p>
      </section>

      <SummarySection
        title="Annual"
        rows={annualRows}
        filename={`${slug}-annual.csv`}
        sprinters={sprinters}
      />
      <SummarySection
        title="Monthly"
        rows={monthlyRows}
        compact
        filename={`${slug}-monthly.csv`}
        sprinters={sprinters}
      />

      <section>
        <h2 className="mb-3 text-sm font-semibold">
          Daily
          <span className="ml-2 font-normal text-zinc-400">
            most recent 31 entries
          </span>
        </h2>
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                <th className="py-2.5 pr-4 font-medium">Date</th>
                <th className="py-2.5 pr-4 font-medium">New units</th>
                <th className="py-2.5 pr-4 font-medium">New front</th>
                <th className="py-2.5 pr-4 font-medium">New back</th>
                <th className="py-2.5 pr-4 font-medium">New gross</th>
                <th className="py-2.5 pr-4 font-medium">Used units</th>
                <th className="py-2.5 pr-4 font-medium">Used front</th>
                <th className="py-2.5 pr-4 font-medium">Used back</th>
                <th className="py-2.5 pr-4 font-medium">Used gross</th>
                {sprinters ? (
                  <>
                    <th className="py-2.5 pr-4 font-medium">Sprinter units</th>
                    <th className="py-2.5 pr-4 font-medium">Sprinter front</th>
                    <th className="py-2.5 pr-4 font-medium">Sprinter back</th>
                    <th className="py-2.5 pr-4 font-medium">Sprinter gross</th>
                  </>
                ) : null}
                <th className="py-2.5 pr-4 font-medium text-blue-700 dark:text-blue-400">
                  Total gross
                </th>
                {role === "editor" ? (
                  <th className="py-2.5 pr-4 font-medium print:hidden" />
                ) : null}
              </tr>
            </thead>
            <tbody>
              {(dailyEntries ?? []).map((e) => {
                const newGross = e.new_front_end_gross + e.new_back_end_gross;
                const usedGross =
                  e.used_front_end_gross + e.used_back_end_gross;
                const sprinterGross =
                  e.sprinter_front_end_gross + e.sprinter_back_end_gross;
                const total = newGross + usedGross + sprinterGross;
                const cols = columnCount + (role === "editor" ? 1 : 0);
                return (
                  <Fragment key={e.id}>
                    <tr
                      className={`hover:bg-blue-50/40 dark:hover:bg-blue-950/20 ${
                        e.notes
                          ? ""
                          : "border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                      }`}
                    >
                      <td className="py-2.5 pr-4 font-medium">
                        {e.entry_date}
                      </td>
                      <td className="py-2.5 pr-4">{e.new_units}</td>
                      <td className="py-2.5 pr-4">
                        {formatCurrency(e.new_front_end_gross)}
                      </td>
                      <td className="py-2.5 pr-4">
                        {formatCurrency(e.new_back_end_gross)}
                      </td>
                      <td className="py-2.5 pr-4 font-medium">
                        {formatCurrency(newGross)}
                      </td>
                      <td className="py-2.5 pr-4">{e.used_units}</td>
                      <td className="py-2.5 pr-4">
                        {formatCurrency(e.used_front_end_gross)}
                      </td>
                      <td className="py-2.5 pr-4">
                        {formatCurrency(e.used_back_end_gross)}
                      </td>
                      <td className="py-2.5 pr-4 font-medium">
                        {formatCurrency(usedGross)}
                      </td>
                      {sprinters ? (
                        <>
                          <td className="py-2.5 pr-4">{e.sprinter_units}</td>
                          <td className="py-2.5 pr-4">
                            {formatCurrency(e.sprinter_front_end_gross)}
                          </td>
                          <td className="py-2.5 pr-4">
                            {formatCurrency(e.sprinter_back_end_gross)}
                          </td>
                          <td className="py-2.5 pr-4 font-medium">
                            {formatCurrency(sprinterGross)}
                          </td>
                        </>
                      ) : null}
                      <td className="py-2.5 pr-4 font-semibold text-blue-700 dark:text-blue-400">
                        {formatCurrency(total)}
                      </td>
                      {role === "editor" ? (
                        <td className="py-2.5 pr-4 print:hidden">
                          <div className="flex gap-3">
                            <Link
                              href={`/dealerships/${dealershipId}/entry?date=${e.entry_date}`}
                              className="text-blue-600 hover:underline dark:text-blue-400"
                            >
                              Edit
                            </Link>
                            {user.isSuperAdmin ? (
                              <form action={deleteEntry}>
                                <input
                                  type="hidden"
                                  name="entry_id"
                                  value={e.id}
                                />
                                <input
                                  type="hidden"
                                  name="dealership_id"
                                  value={dealershipId}
                                />
                                <ConfirmButton
                                  message={`Delete the entry for ${e.entry_date}? This can't be undone.`}
                                  className="text-red-600 hover:underline dark:text-red-400"
                                >
                                  Delete
                                </ConfirmButton>
                              </form>
                            ) : null}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                    {e.notes ? (
                      <tr className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                        <td colSpan={cols} className="pb-2.5 pr-4">
                          <div className="rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                            <span className="mr-1.5 font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                              Notes
                            </span>
                            <span className="whitespace-pre-wrap break-words">
                              {e.notes}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
              {(dailyEntries ?? []).length === 0 ? (
                <tr>
                  <td
                    colSpan={columnCount + (role === "editor" ? 1 : 0)}
                    className="py-4 text-zinc-500"
                  >
                    No entries yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </Card>
      </section>

      {role === "editor" ? <ImportForm dealershipId={dealershipId} /> : null}
    </div>
  );
}

function SummarySection({
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
        <p className="text-sm text-zinc-500">No data yet.</p>
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                <th className="py-2.5 pr-4 font-medium">Period</th>
                <th className="py-2.5 pr-4 font-medium">New units</th>
                {compact ? null : (
                  <>
                    <th className="py-2.5 pr-4 font-medium">New front</th>
                    <th className="py-2.5 pr-4 font-medium">New back</th>
                    <th className="py-2.5 pr-4 font-medium">New gross</th>
                  </>
                )}
                <th className="py-2.5 pr-4 font-medium">Used units</th>
                {compact ? null : (
                  <>
                    <th className="py-2.5 pr-4 font-medium">Used front</th>
                    <th className="py-2.5 pr-4 font-medium">Used back</th>
                    <th className="py-2.5 pr-4 font-medium">Used gross</th>
                  </>
                )}
                {sprinters ? (
                  <>
                    <th className="py-2.5 pr-4 font-medium">Sprinter units</th>
                    {compact ? null : (
                      <>
                        <th className="py-2.5 pr-4 font-medium">
                          Sprinter front
                        </th>
                        <th className="py-2.5 pr-4 font-medium">
                          Sprinter back
                        </th>
                        <th className="py-2.5 pr-4 font-medium">
                          Sprinter gross
                        </th>
                      </>
                    )}
                  </>
                ) : null}
                <th className="py-2.5 pr-4 font-medium text-blue-700 dark:text-blue-400">
                  Total gross
                </th>
                <th className="py-2.5 pr-4 font-medium">Days</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.label}
                  className="border-b border-zinc-100 last:border-0 hover:bg-blue-50/40 dark:border-zinc-900 dark:hover:bg-blue-950/20"
                >
                  <td className="py-2.5 pr-4 font-medium">{r.label}</td>
                  <td className="py-2.5 pr-4">{r.total_new_units}</td>
                  {compact ? null : (
                    <>
                      <td className="py-2.5 pr-4">
                        {formatCurrency(r.total_new_front_end_gross)}
                      </td>
                      <td className="py-2.5 pr-4">
                        {formatCurrency(r.total_new_back_end_gross)}
                      </td>
                      <td className="py-2.5 pr-4 font-medium">
                        {formatCurrency(
                          r.total_new_front_end_gross +
                            r.total_new_back_end_gross,
                        )}
                      </td>
                    </>
                  )}
                  <td className="py-2.5 pr-4">{r.total_used_units}</td>
                  {compact ? null : (
                    <>
                      <td className="py-2.5 pr-4">
                        {formatCurrency(r.total_used_front_end_gross)}
                      </td>
                      <td className="py-2.5 pr-4">
                        {formatCurrency(r.total_used_back_end_gross)}
                      </td>
                      <td className="py-2.5 pr-4 font-medium">
                        {formatCurrency(
                          r.total_used_front_end_gross +
                            r.total_used_back_end_gross,
                        )}
                      </td>
                    </>
                  )}
                  {sprinters ? (
                    <>
                      <td className="py-2.5 pr-4">{r.total_sprinter_units}</td>
                      {compact ? null : (
                        <>
                          <td className="py-2.5 pr-4">
                            {formatCurrency(r.total_sprinter_front_end_gross)}
                          </td>
                          <td className="py-2.5 pr-4">
                            {formatCurrency(r.total_sprinter_back_end_gross)}
                          </td>
                          <td className="py-2.5 pr-4 font-medium">
                            {formatCurrency(
                              r.total_sprinter_front_end_gross +
                                r.total_sprinter_back_end_gross,
                            )}
                          </td>
                        </>
                      )}
                    </>
                  ) : null}
                  <td className="py-2.5 pr-4 font-semibold text-blue-700 dark:text-blue-400">
                    {formatCurrency(r.total_gross)}
                  </td>
                  <td className="py-2.5 pr-4">{r.days_logged}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </section>
  );
}

function formatMetric(value: number, isCurrency: boolean): string {
  return isCurrency
    ? formatCurrency(value)
    : Math.round(value).toLocaleString("en-US");
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white px-4 shadow-sm dark:border-zinc-800 dark:bg-[var(--surface)]">
      {children}
    </div>
  );
}
