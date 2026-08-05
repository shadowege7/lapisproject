import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, effectiveRole } from "@/lib/auth";
import { createAdminClient, listAllUsers } from "@/lib/supabase/admin";
import {
  formatCurrency,
  formatMonth,
  monthStartISODate,
  todayISODate,
} from "@/lib/format";
import { projectMonthEnd } from "@/lib/projection";

export default async function DealershipDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: dealershipId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();

  const [{ data: dealership }, { data: membership }, { data: month }, { data: recent }] =
    await Promise.all([
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
    ]);

  if (!dealership) notFound();

  const role = effectiveRole(user, membership?.role);
  if (!role) redirect("/dashboard");

  const today = todayISODate();
  const todayEntry = (recent ?? []).find((e) => e.entry_date === today);
  const todayGross = todayEntry
    ? todayEntry.new_front_end_gross +
      todayEntry.new_back_end_gross +
      todayEntry.used_front_end_gross +
      todayEntry.used_back_end_gross +
      todayEntry.sprinter_front_end_gross +
      todayEntry.sprinter_back_end_gross
    : 0;

  const mtdUnits =
    (month?.total_new_units ?? 0) +
    (month?.total_used_units ?? 0) +
    (month?.total_sprinter_units ?? 0);
  const mtdGross = month?.total_gross ?? 0;

  /** "12 new · 9 used", with Sprinters only where there were any. */
  const units = (n: number, used: number, sprinter: number) =>
    [
      `${n} new`,
      `${used} used`,
      ...(sprinter > 0 ? [`${sprinter} Sprinter`] : []),
    ].join(" · ");

  const notesEntries = (recent ?? []).filter((e) => e.notes && e.notes.trim());

  const team = user.isSuperAdmin
    ? await loadTeam(dealershipId)
    : null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400">
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
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
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
            value={formatCurrency(projectMonthEnd(mtdGross))}
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
            value={formatCurrency(todayGross)}
            sub={
              todayEntry
                ? units(
                    todayEntry.new_units,
                    todayEntry.used_units,
                    todayEntry.sprinter_units,
                  )
                : "No entry yet"
            }
          />
        </div>
      </section>

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
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[var(--surface)]">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p
        className={`mt-1 text-xl font-semibold tabular-nums ${
          accent ? "text-blue-700 dark:text-blue-400" : ""
        }`}
      >
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-xs text-zinc-400">{sub}</p> : null}
    </div>
  );
}
