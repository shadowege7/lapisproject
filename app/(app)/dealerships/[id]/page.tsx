import { Fragment } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, effectiveRole } from "@/lib/auth";
import { createAdminClient, listAllUsers } from "@/lib/supabase/admin";
import {
  formatCurrency,
  formatMonth,
  formatShortDay,
  monthStartISODate,
  todayISODate,
} from "@/lib/format";
import { projectMonthEnd } from "@/lib/projection";
import { BudgetForm } from "./budget-form";

export default async function DealershipDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ budget?: string; budget_error?: string }>;
}) {
  const { id: dealershipId } = await params;
  const { budget: budgetSaved, budget_error: budgetError } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();

  const [
    { data: dealership },
    { data: membership },
    { data: month },
    { data: recent },
    { data: budget },
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
        .from("monthly_summary")
        .select("*")
        .eq("dealership_id", dealershipId)
        .eq("month", monthStartISODate())
        .maybeSingle(),
      supabase
        .from("daily_entries")
        .select("*")
        .eq("dealership_id", dealershipId)
        .order("entry_date", { ascending: false })
        .limit(14),
      supabase
        .from("store_budgets")
        .select("new_units, used_units, sprinter_units, updated_at")
        .eq("dealership_id", dealershipId)
        .eq("month", monthStartISODate())
        .maybeSingle(),
    ]);

  if (!dealership) notFound();

  const role = effectiveRole(user, membership?.role);
  if (!role) redirect("/dashboard");

  const today = todayISODate();
  const todayEntry = (recent ?? []).find((e) => e.entry_date === today);
  // Display-only stand-in for the Today card. `todayEntry` is left untouched —
  // it, and only it, keys the projection below. `recent` is entry_date desc, so
  // the first row older than today is the most recent prior day.
  const previousEntry = (recent ?? []).find((e) => e.entry_date < today);
  const displayEntry = todayEntry ?? previousEntry;
  const isStandIn = !todayEntry && !!previousEntry;
  const displayGross = displayEntry
    ? displayEntry.new_front_end_gross +
      displayEntry.new_back_end_gross +
      displayEntry.used_front_end_gross +
      displayEntry.used_back_end_gross +
      displayEntry.sprinter_front_end_gross +
      displayEntry.sprinter_back_end_gross
    : 0;

  const mtdUnits =
    (month?.total_new_units ?? 0) +
    (month?.total_used_units ?? 0) +
    (month?.total_sprinter_units ?? 0);
  const mtdGross = month?.total_gross ?? 0;

  /**
   * "12 new · 9 used · 3 Sprinter". Shown whenever this store tracks
   * Sprinters, including at zero — a Sprinter store wants that line the same
   * way it wants its used line.
   *
   * Each count and its label sit in one unbreakable span, so a narrow column
   * never splits "9" from "used".
   */
  const units = (n: number, used: number, sprinter: number) => {
    const parts = [
      [n, "new"],
      [used, "used"],
      ...(dealership.tracks_sprinters ? [[sprinter, "Sprinter"] as const] : []),
    ] as const;

    return (
      <>
        {parts.map(([count, name], i) => (
          <Fragment key={name}>
            {/* Only where the figures share a line — from `sm` up each takes
                its own, and a dot would dangle at the end of the one above.
                Outside the nowrap span, so it stays a legal place to break. */}
            {i > 0 ? <span className="sm:hidden">{" · "}</span> : null}
            <span className="whitespace-nowrap sm:block">
              {count} {name}
            </span>
          </Fragment>
        ))}
      </>
    );
  };

  const notesEntries = (recent ?? []).filter((e) => e.notes && e.notes.trim());

  const team = user.isSuperAdmin
    ? await loadTeam(dealershipId)
    : null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Store
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {dealership.name}
          </h1>
          <span className="mt-1 inline-block rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {role === "editor" ? "Editor access" : "View only"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {role === "editor" ? (
            <Link
              href={`/dealerships/${dealershipId}/entry`}
              className="rounded-md btn-primary px-4 py-2 text-sm font-semibold shadow-sm transition-colors"
            >
              Enter today&apos;s numbers
            </Link>
          ) : null}
          <Link
            href={`/dealerships/${dealershipId}/reports`}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:border-blue-400 hover:text-blue-700 dark:border-zinc-700 dark:text-zinc-200 dark:hover:text-blue-400"
          >
            View reports
          </Link>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold">
          This month
          <span className="ml-2 font-normal text-zinc-400">
            {formatMonth(monthStartISODate())}
          </span>
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="Total gross"
            value={formatCurrency(mtdGross)}
            sub={`${month?.days_logged ?? 0} days logged`}
          />
          <Stat
            label="Projected gross"
            value={formatCurrency(projectMonthEnd(mtdGross, !!todayEntry))}
            accent
            sub="at current pace"
          />
          <Stat
            label="Units MTD"
            value={String(mtdUnits)}
            sub={units(
              month?.total_new_units ?? 0,
              month?.total_used_units ?? 0,
              month?.total_sprinter_units ?? 0,
            )}
          />
          <Stat
            label="Today"
            value={formatCurrency(displayGross)}
            sub={
              displayEntry
                ? units(
                    displayEntry.new_units,
                    displayEntry.used_units,
                    displayEntry.sprinter_units,
                  )
                : "No entry yet"
            }
            standInDate={
              isStandIn && displayEntry
                ? formatShortDay(displayEntry.entry_date)
                : undefined
            }
          />
        </div>
      </section>

      {budgetError ? (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
        >
          Couldn&apos;t save the budget: {budgetError}
        </p>
      ) : null}

      <BudgetForm
        dealershipId={dealershipId}
        month={monthStartISODate()}
        tracksSprinters={dealership.tracks_sprinters}
        budget={budget}
        canEdit={user.canEditBudgets}
        saved={budgetSaved === "saved"}
      />

      <section>
        <h2 className="mb-3 text-sm font-semibold">Recent notes</h2>
        {notesEntries.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No notes on the last {recent?.length ?? 0} entries.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {notesEntries.map((e) => (
              <li
                key={e.id}
                className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/50 dark:bg-amber-950/30"
              >
                <span className="mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
                  {e.entry_date}
                </span>
                <p className="whitespace-pre-wrap break-words text-sm text-amber-900 dark:text-amber-100">
                  {e.notes}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {team ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold">
            Team
            <span className="ml-2 font-normal text-zinc-400">
              {team.length} {team.length === 1 ? "member" : "members"}
            </span>
          </h2>
          {team.length === 0 ? (
            <p className="text-sm text-zinc-500">No one has access yet.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[var(--surface)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                    <th className="px-4 py-2.5 font-medium">Name</th>
                    <th className="px-4 py-2.5 font-medium">Email</th>
                    <th className="px-4 py-2.5 font-medium">Access</th>
                  </tr>
                </thead>
                <tbody>
                  {team.map((m) => (
                    <tr
                      key={m.userId}
                      className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                    >
                      <td className="px-4 py-2.5 font-medium">
                        {m.fullName ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-500">
                        {m.email ?? "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        {m.role === "editor" ? "Editor" : "Viewer"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

interface TeamMember {
  userId: string;
  fullName: string | null;
  email: string | null;
  role: string;
}

/** Roster for one store, with emails resolved via the service-role client. Super-admin only. */
async function loadTeam(dealershipId: string): Promise<TeamMember[]> {
  const admin = createAdminClient();
  const [{ data: members }, { users }] = await Promise.all([
    admin
      .from("dealership_members")
      .select("user_id, role")
      .eq("dealership_id", dealershipId),
    listAllUsers(),
  ]);

  const memberList = members ?? [];
  const emailById = new Map(users.map((u) => [u.id, u.email]));

  const nameById = new Map<string, string | null>();
  if (memberList.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name")
      .in(
        "id",
        memberList.map((m) => m.user_id),
      );
    for (const p of profiles ?? []) nameById.set(p.id, p.full_name);
  }

  return memberList
    .map((m) => ({
      userId: m.user_id,
      fullName: nameById.get(m.user_id) ?? null,
      email: emailById.get(m.user_id) ?? null,
      role: m.role,
    }))
    .sort((a, b) =>
      (a.fullName ?? a.email ?? "").localeCompare(b.fullName ?? b.email ?? ""),
    );
}

function Stat({
  label,
  value,
  sub,
  accent = false,
  standInDate,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  accent?: boolean;
  /**
   * Set only when this tile is showing a previous day as a stand-in for a
   * still-empty today. Switches the tile to the not-today treatment — dashed
   * amber border, reduced opacity, an "Awaiting today" badge and the date — so
   * it can never be mistaken for real today numbers.
   */
  standInDate?: string;
}) {
  return (
    <div
      className={`rounded-xl border bg-white p-4 dark:bg-[var(--surface)] ${
        standInDate
          ? "border-dashed border-amber-300 opacity-75 dark:border-amber-800/60"
          : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {label}
        </p>
        {standInDate ? (
          <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
            Awaiting today
          </span>
        ) : null}
      </div>
      <p
        className={`mt-1 font-mono text-xl font-semibold tabular-nums ${
          accent ? "text-blue-700 dark:text-blue-400" : ""
        }`}
      >
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-xs text-zinc-400">{sub}</p> : null}
      {standInDate ? (
        <p className="mt-0.5 text-[11px] text-zinc-500">
          Yesterday&apos;s numbers · {standInDate}
        </p>
      ) : null}
    </div>
  );
}
