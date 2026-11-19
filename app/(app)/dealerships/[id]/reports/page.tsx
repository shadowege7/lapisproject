import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, effectiveRole } from "@/lib/auth";
import {
  formatMonth,
  formatYear,
  monthEndISODate,
  monthStartISODate,
  todayISODate,
} from "@/lib/format";
import { ExportCsvButton } from "./export-button";
import { PrintButton } from "./print-button";
import { DealImportForm } from "./deal-import-form";
import { MonthPanel } from "./month-panel";
import { DailyTable } from "./daily-table";
import { ExpandForPrint } from "./expand-for-print";
import { PacePanel } from "./pace-panel";
import { projectMonthEnd } from "@/lib/projection";
import { shiftMonth, type InsightDay } from "@/lib/insights";
import { ActivityPanel } from "./activity-panel";
import { MonthlyTrends, type TrendPoint } from "./monthly-trends";
import { MissedEntries } from "./missed-entries";
import { StoreSwitcher } from "./store-switcher";
import { SummarySection, type SummaryRow } from "./summary-section";
import { SalespeopleSection } from "./salespeople-section";
import { parsePeriod, parseRank } from "@/lib/salespeople";
import { StoreStateBanner } from "../store-state-banner";

/**
 * How far back the weekday ranking looks. A year gives roughly fifty samples
 * per weekday, enough that one exceptional Saturday cannot decide the order,
 * and it is recent enough to describe how the store sells now. The 31 rows the
 * Daily table fetches would be about four samples a day, which is not a
 * ranking so much as a coincidence — hence the separate, narrower query.
 */

const INSIGHT_COLUMNS =
  "entry_date, new_units, used_units, sprinter_units, new_front_end_gross, new_back_end_gross, used_front_end_gross, used_back_end_gross, sprinter_front_end_gross, sprinter_back_end_gross, sales_calls, appointments";

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    sp?: string;
    rank?: string;
    manage?: string;
    sp_error?: string;
    sp_done?: string;
    month?: string;
    edit?: string;
  }>;
}) {
  const { id: dealershipId } = await params;
  const query = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();

  // ?month=YYYY-MM opens a past month: the same page, scoped to that month.
  // The current month (or anything unreadable or in the future) is the
  // ordinary live view.
  const currentMonth = monthStartISODate();
  const requested = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(query.month ?? "");
  const viewMonth =
    requested && `${requested[0]}-01` < currentMonth ? `${requested[0]}-01` : null;
  const viewMonthEnd = viewMonth ? monthEndISODate(viewMonth) : null;
  /** The month the Pace and activity sections describe. */
  const insightMonth = viewMonth ?? currentMonth;

  const [
    { data: dealership },
    { data: membership },
    { data: dailyEntries },
    { data: monthly },
    { data: annual },
    { data: switchableStores },
    { data: openedMonth },
    { data: insightRows },
    { data: lastYearRows },
    { data: budget },
  ] = await Promise.all([
    supabase
      .from("dealerships")
      .select("id, name, tracks_sprinters, tracks_salespeople, salespeople_tracked_since, super_admin_only, archived_at")
      .eq("id", dealershipId)
      .single(),
    supabase
      .from("dealership_members")
      .select("role")
      .eq("dealership_id", dealershipId)
      .eq("user_id", user.id)
      .maybeSingle(),
    viewMonth && viewMonthEnd
      ? supabase
          .from("daily_entries")
          .select("*")
          .eq("dealership_id", dealershipId)
          .gte("entry_date", viewMonth)
          .lte("entry_date", viewMonthEnd)
          .order("entry_date", { ascending: false })
      : supabase
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
    // Every store this user may open, for the switcher. No filter here on
    // purpose: `dealerships_select` already narrows this to super admins and
    // active members, so the scoping is the database's rather than ours.
    supabase
      .from("dealerships")
      .select("id, name")
      .is("archived_at", null)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name"),
    // The opened month may be older than the twelve the Monthly table lists.
    viewMonth
      ? supabase
          .from("monthly_summary")
          .select("*")
          .eq("dealership_id", dealershipId)
          .eq("month", viewMonth)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    // Pace and Calls & appointments: the viewed month and the one before it…
    supabase
      .from("daily_entries")
      .select(INSIGHT_COLUMNS)
      .eq("dealership_id", dealershipId)
      .gte("entry_date", shiftMonth(insightMonth, -1))
      .lte("entry_date", monthEndISODate(insightMonth)),
    // …and the same month last year, which only shows once there's data.
    supabase
      .from("daily_entries")
      .select(INSIGHT_COLUMNS)
      .eq("dealership_id", dealershipId)
      .gte("entry_date", shiftMonth(insightMonth, -12))
      .lte("entry_date", monthEndISODate(shiftMonth(insightMonth, -12))),
    supabase
      .from("store_budgets")
      .select("new_units, used_units, sprinter_units")
      .eq("dealership_id", dealershipId)
      .eq("month", insightMonth)
      .maybeSingle(),
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
    // Each month opens its own view of this page; this month is the live one.
    href:
      r.month === currentMonth
        ? `/dealerships/${dealershipId}/reports`
        : `/dealerships/${dealershipId}/reports?month=${r.month.slice(0, 7)}`,
    selected: viewMonth ? r.month === viewMonth : r.month === currentMonth,
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
  const thisMonth = viewMonth
    ? (openedMonth ?? undefined)
    : (monthly ?? []).find((m) => m.month === currentMonth);
  const isPast = viewMonth !== null;
  const canEdit = role === "editor" && !dealership.archived_at;

  const allInsightRows = [...(insightRows ?? []), ...(lastYearRows ?? [])] as InsightDay[];
  const todayLogged = !!todayEntry;

  // Monthly trend tiles, oldest first. The month in progress plots its
  // projected units (rounded per category, like the New / Used cards) so a
  // half-finished month doesn't read as a slump.
  const monthUnits = (m: NonNullable<typeof monthly>[number]) =>
    m.month === currentMonth
      ? Math.round(projectMonthEnd(m.total_new_units, todayLogged)) +
        Math.round(projectMonthEnd(m.total_used_units, todayLogged)) +
        (sprinters ? Math.round(projectMonthEnd(m.total_sprinter_units, todayLogged)) : 0)
      : m.total_new_units + m.total_used_units + (sprinters ? m.total_sprinter_units : 0);
  const trendMonths = [...(monthly ?? [])].reverse();
  const trendPoint = (m: NonNullable<typeof monthly>[number], value: number | null): TrendPoint => ({
    label: formatMonth(m.month).slice(0, 3),
    full: formatMonth(m.month),
    value,
    current: m.month === currentMonth,
  });
  const unitTrend = trendMonths.map((m) => trendPoint(m, monthUnits(m)));
  const perUnitTrend = trendMonths.map((m) => {
    const sold = m.total_new_units + m.total_used_units + (sprinters ? m.total_sprinter_units : 0);
    return trendPoint(m, sold > 0 ? m.total_gross / sold : null);
  });

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
            Dealership Insights
            {viewMonth ? (
              <>
                {" · "}
                <span className="text-zinc-700 dark:text-zinc-300">
                  {formatMonth(viewMonth)}
                </span>
              </>
            ) : null}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">
              {dealership.name}
            </h1>
            <MissedEntries
              daysLogged={thisMonth?.days_logged ?? 0}
              todayLogged={!!todayEntry}
              pastMonth={viewMonth ?? undefined}
            />
          </div>
          {viewMonth ? (
            <Link
              href={`/dealerships/${dealershipId}/reports`}
              className="mt-1 inline-block text-sm font-medium text-blue-700 hover:underline dark:text-blue-400 print:hidden"
            >
              ← Back to this month
            </Link>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <StoreSwitcher
            stores={switchableStores ?? []}
            currentId={dealershipId}
          />
          <PrintButton />
          <ExportCsvButton
            filename={`${slug}${viewMonth ? `-${viewMonth.slice(0, 7)}` : ""}-daily.csv`}
            headers={dailyCsvHeaders}
            rows={dailyCsvRows}
            label="Export daily"
          />
          {canEdit && !isPast ? (
            <Link
              href={`/dealerships/${dealershipId}/entry`}
              className="rounded-md btn-primary px-4 py-2 text-sm font-semibold shadow-sm transition-colors"
            >
              Enter today&apos;s numbers
            </Link>
          ) : null}
        </div>
      </div>

      <StoreStateBanner
        archivedAt={dealership.archived_at}
        superAdminOnly={dealership.super_admin_only}
      />

      <MonthPanel
        month={thisMonth}
        todayLogged={!!todayEntry}
        sprinters={sprinters}
        dealershipId={dealershipId}
        canEdit={canEdit}
        pastMonth={viewMonth ?? undefined}
      />

      <PacePanel
        dealershipId={dealershipId}
        viewMonth={insightMonth}
        currentMonth={currentMonth}
        today={today}
        todayLogged={todayLogged}
        sprinters={sprinters}
        rows={allInsightRows}
        budget={budget ?? null}
        canSetBudget={user.canEditBudgets}
      />

      {/* Only for stores an admin has switched on. */}
      {dealership.tracks_salespeople ? (
        <SalespeopleSection
          dealershipId={dealershipId}
          sprinters={sprinters}
          trackedSince={dealership.salespeople_tracked_since}
          period={parsePeriod(query.sp)}
          rank={parseRank(query.rank)}
          month={viewMonth && viewMonthEnd ? { from: viewMonth, to: viewMonthEnd } : undefined}
          canEdit={canEdit}
          manageOpen={canEdit && query.manage === "1"}
          editingId={canEdit && query.manage === "1" ? query.edit : undefined}
          error={query.sp_error}
          done={query.sp_done}
        />
      ) : null}

      <ActivityPanel
        viewMonth={insightMonth}
        currentMonth={currentMonth}
        today={today}
        todayLogged={todayLogged}
        sprinters={sprinters}
        rows={allInsightRows}
      />

      {isPast ? null : (
        <>
          <SummarySection
            title="Annual"
            rows={annualRows}
            filename={`${slug}-annual.csv`}
            sprinters={sprinters}
          />
        </>
      )}
      <SummarySection
        title="Monthly"
        rows={monthlyRows}
        compact
        filename={`${slug}-monthly.csv`}
        sprinters={sprinters}
        before={<MonthlyTrends units={unitTrend} perUnit={perUnitTrend} />}
      />

      <ExpandForPrint />
      <DailyTable
        entries={dailyEntries ?? []}
        sprinters={sprinters}
        dealershipId={dealershipId}
        canEdit={canEdit}
        canDelete={user.isSuperAdmin}
        monthLabel={viewMonth ? formatMonth(viewMonth) : undefined}
      />

      {canEdit && !isPast ? (
        <DealImportForm
          dealershipId={dealershipId}
          tracksSprinters={sprinters}
          today={today}
          monthStart={currentMonth}
        />
      ) : null}
    </div>
  );
}
