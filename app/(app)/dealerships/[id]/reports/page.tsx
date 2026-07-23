import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, effectiveRole } from "@/lib/auth";
import { formatCurrency, formatMonth, formatYear } from "@/lib/format";

interface SummaryRow {
  label: string;
  total_new_units: number;
  total_used_units: number;
  total_new_front_end_gross: number;
  total_new_back_end_gross: number;
  total_used_front_end_gross: number;
  total_used_back_end_gross: number;
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
      .select("id, name")
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

  const annualRows: SummaryRow[] = (annual ?? []).map((r) => ({
    label: formatYear(r.year),
    total_new_units: r.total_new_units,
    total_used_units: r.total_used_units,
    total_new_front_end_gross: r.total_new_front_end_gross,
    total_new_back_end_gross: r.total_new_back_end_gross,
    total_used_front_end_gross: r.total_used_front_end_gross,
    total_used_back_end_gross: r.total_used_back_end_gross,
    total_gross: r.total_gross,
    days_logged: r.days_logged,
  }));

  const monthlyRows: SummaryRow[] = (monthly ?? []).map((r) => ({
    label: formatMonth(r.month),
    total_new_units: r.total_new_units,
    total_used_units: r.total_used_units,
    total_new_front_end_gross: r.total_new_front_end_gross,
    total_new_back_end_gross: r.total_new_back_end_gross,
    total_used_front_end_gross: r.total_used_front_end_gross,
    total_used_back_end_gross: r.total_used_back_end_gross,
    total_gross: r.total_gross,
    days_logged: r.days_logged,
  }));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400">
            Reports
          </p>
          <h1 className="text-xl font-semibold tracking-tight">
            {dealership.name}
          </h1>
        </div>
        {role === "editor" ? (
          <Link
            href={`/dealerships/${dealershipId}/entry`}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            Enter today&apos;s numbers
          </Link>
        ) : null}
      </div>

      <SummarySection title="Annual" rows={annualRows} />
      <SummarySection title="Monthly" rows={monthlyRows} />

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
                <th className="py-2.5 pr-4 font-medium">Used units</th>
                <th className="py-2.5 pr-4 font-medium">Used front</th>
                <th className="py-2.5 pr-4 font-medium">Used back</th>
                <th className="py-2.5 pr-4 font-medium text-blue-700 dark:text-blue-400">
                  Total gross
                </th>
              </tr>
            </thead>
            <tbody>
              {(dailyEntries ?? []).map((e) => {
                const total =
                  e.new_front_end_gross +
                  e.new_back_end_gross +
                  e.used_front_end_gross +
                  e.used_back_end_gross;
                return (
                  <tr
                    key={e.id}
                    className="border-b border-zinc-100 last:border-0 hover:bg-blue-50/40 dark:border-zinc-900 dark:hover:bg-blue-950/20"
                  >
                    <td className="py-2.5 pr-4 font-medium">{e.entry_date}</td>
                    <td className="py-2.5 pr-4">{e.new_units}</td>
                    <td className="py-2.5 pr-4">
                      {formatCurrency(e.new_front_end_gross)}
                    </td>
                    <td className="py-2.5 pr-4">
                      {formatCurrency(e.new_back_end_gross)}
                    </td>
                    <td className="py-2.5 pr-4">{e.used_units}</td>
                    <td className="py-2.5 pr-4">
                      {formatCurrency(e.used_front_end_gross)}
                    </td>
                    <td className="py-2.5 pr-4">
                      {formatCurrency(e.used_back_end_gross)}
                    </td>
                    <td className="py-2.5 pr-4 font-semibold text-blue-700 dark:text-blue-400">
                      {formatCurrency(total)}
                    </td>
                  </tr>
                );
              })}
              {(dailyEntries ?? []).length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-4 text-zinc-500">
                    No entries yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
}

function SummarySection({
  title,
  rows,
}: {
  title: string;
  rows: SummaryRow[];
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">No data yet.</p>
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                <th className="py-2.5 pr-4 font-medium">Period</th>
                <th className="py-2.5 pr-4 font-medium">New units</th>
                <th className="py-2.5 pr-4 font-medium">New front</th>
                <th className="py-2.5 pr-4 font-medium">New back</th>
                <th className="py-2.5 pr-4 font-medium">Used units</th>
                <th className="py-2.5 pr-4 font-medium">Used front</th>
                <th className="py-2.5 pr-4 font-medium">Used back</th>
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
                  <td className="py-2.5 pr-4">
                    {formatCurrency(r.total_new_front_end_gross)}
                  </td>
                  <td className="py-2.5 pr-4">
                    {formatCurrency(r.total_new_back_end_gross)}
                  </td>
                  <td className="py-2.5 pr-4">{r.total_used_units}</td>
                  <td className="py-2.5 pr-4">
                    {formatCurrency(r.total_used_front_end_gross)}
                  </td>
                  <td className="py-2.5 pr-4">
                    {formatCurrency(r.total_used_back_end_gross)}
                  </td>
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

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white px-4 shadow-sm dark:border-zinc-800 dark:bg-[#0e1626]">
      {children}
    </div>
  );
}
