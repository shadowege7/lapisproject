import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, effectiveRole } from "@/lib/auth";
import {
  formatMonth,
  formatYear,
  monthStartISODate,
  todayISODate,
} from "@/lib/format";
import { ExportCsvButton } from "./export-button";
import { PrintButton } from "./print-button";
import { ImportForm } from "./import-form";
import { MonthPanel } from "./month-panel";
import { DailyTable } from "./daily-table";
import { ExpandForPrint } from "./expand-for-print";
import { SummarySection, type SummaryRow } from "./summary-section";

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

  const slug = dealership.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

  // The daily export keeps every column it has always had — Today's figures
  // included, and no averages added — because people have Excel workbooks
  // keyed to these positions. What the table on screen shows and what the CSV
  // carries are two separate decisions.
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

      <MonthPanel
        month={thisMonth}
        todayLogged={!!todayEntry}
        sprinters={sprinters}
        dealershipId={dealershipId}
        canEdit={role === "editor"}
      />

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

      <ExpandForPrint />
      <DailyTable
        entries={dailyEntries ?? []}
        sprinters={sprinters}
        dealershipId={dealershipId}
        canEdit={role === "editor"}
        canDelete={user.isSuperAdmin}
      />

      {role === "editor" ? (
        <ImportForm dealershipId={dealershipId} tracksSprinters={sprinters} />
      ) : null}
    </div>
  );
}
