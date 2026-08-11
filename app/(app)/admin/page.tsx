import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listAllUsers } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import type { DealershipRole } from "@/lib/database.types";
import {
  createDealership,
  createPosition,
  deletePosition,
  setPositionRollup,
  setAdminRollup,
  setShowLeaderboard,
} from "./actions";
import { InviteForm } from "./invite-form";
import { EmailTestForm } from "./email-test-form";
import { UsersPanel, type AdminUser } from "./users-panel";
import { StoreRow } from "./store-row";
import { SmtpForm } from "./smtp-form";
import { AdminSection } from "./admin-section";
import { getSmtpSummary } from "@/lib/smtp-settings";
import { ConfirmButton } from "./confirm-button";

function formatSignIn(iso: string | null): string {
  if (!iso) return "Never signed in";
  return (
    new Date(iso).toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }) + " PT"
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    email_changed?: string;
    email_error?: string;
    smtp?: string;
    smtp_test?: string;
    smtp_error?: string;
  }>;
}) {
  const {
    email_changed: emailChanged,
    email_error: emailError,
    smtp: smtpSaved,
    smtp_test: smtpTested,
    smtp_error: smtpError,
  } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isSuperAdmin) redirect("/dashboard");

  const supabase = await createClient();

  const [
    { data: dealerships },
    { data: members },
    { data: positions },
    { data: reportRecipients },
    usersResult,
  ] = await Promise.all([
    supabase
      .from("dealerships")
      .select("id, name, sort_order")
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name"),
    supabase
      .from("dealership_members")
      .select("id, dealership_id, user_id, role"),
    supabase
      .from("positions")
      .select("id, name, sort_order, can_view_rollup")
      .order("sort_order")
      .order("name"),
    supabase
      .from("daily_report_recipients")
      .select("dealership_id, profile_id"),
    listAllUsers(),
  ]);

  const recipientsByStore = new Map<string, string[]>();
  for (const r of reportRecipients ?? []) {
    recipientsByStore.set(r.dealership_id, [
      ...(recipientsByStore.get(r.dealership_id) ?? []),
      r.profile_id,
    ]);
  }

  // Surfaced so an admin choosing recipients is told when nothing can
  // actually be sent, rather than assuming it works. The summary deliberately
  // carries no password — only whether one is stored.
  const smtp = await getSmtpSummary();
  const mailConfigured = smtp.source !== "unset";

  const authUsers = usersResult.users;
  const authUsersError = usersResult.error;

  const { data: profiles } = await supabase
    .from("profiles")
    .select(
      "id, is_super_admin, can_edit_budgets, full_name, notifications_enabled, position_id, main_dealership_id, is_active",
    );

  const { data: settings } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["show_leaderboard", "admin_rollup"]);

  const setting = (key: string) =>
    (settings ?? []).find((s) => s.key === key)?.value;

  // Both default to on, so a missing row behaves the way it did before the
  // setting existed.
  const showLeaderboard = setting("show_leaderboard") !== false;
  const adminRollup = setting("admin_rollup") !== false;

  const superAdminById = new Map(
    profiles?.map((p) => [p.id, p.is_super_admin]),
  );
  const budgetAccessById = new Map(
    profiles?.map((p) => [p.id, p.can_edit_budgets]),
  );
  const fullNameById = new Map(profiles?.map((p) => [p.id, p.full_name]));
  const notifyById = new Map(
    profiles?.map((p) => [p.id, p.notifications_enabled]),
  );
  const positionIdByUser = new Map(
    profiles?.map((p) => [p.id, p.position_id]),
  );
  const mainStoreByUser = new Map(
    profiles?.map((p) => [p.id, p.main_dealership_id]),
  );
  // The Launchpad's "has this person left" flag. Missing row (or null) means
  // nobody has ever offboarded them, so treat them as active.
  const activeById = new Map(profiles?.map((p) => [p.id, p.is_active]));
  const emailById = new Map(authUsers.map((u) => [u.id, u.email ?? ""]));
  const dealershipById = new Map(dealerships?.map((d) => [d.id, d.name]));
  const dealershipList = dealerships ?? [];
  const positionsList = (positions ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    canViewRollup: p.can_view_rollup,
  }));

  const allUsersLite = authUsers.map((u) => ({
    id: u.id,
    email: u.email ?? "(no email)",
    fullName: fullNameById.get(u.id) ?? null,
  }));

  // memberships grouped per user (for the user rows)
  const membershipsByUser = new Map<
    string,
    { dealershipId: string; role: DealershipRole }[]
  >();
  // members grouped per store (for the store access view)
  const membersByStore = new Map<
    string,
    {
      userId: string;
      role: DealershipRole;
      email: string;
      fullName: string | null;
    }[]
  >();
  for (const m of members ?? []) {
    const forUser = membershipsByUser.get(m.user_id) ?? [];
    forUser.push({ dealershipId: m.dealership_id, role: m.role });
    membershipsByUser.set(m.user_id, forUser);

    const forStore = membersByStore.get(m.dealership_id) ?? [];
    forStore.push({
      userId: m.user_id,
      role: m.role,
      email: emailById.get(m.user_id) ?? m.user_id,
      fullName: fullNameById.get(m.user_id) ?? null,
    });
    membersByStore.set(m.dealership_id, forStore);
  }
  for (const arr of membershipsByUser.values()) {
    arr.sort((a, b) =>
      (dealershipById.get(a.dealershipId) ?? "").localeCompare(
        dealershipById.get(b.dealershipId) ?? "",
      ),
    );
  }
  for (const arr of membersByStore.values()) {
    arr.sort((a, b) => a.email.localeCompare(b.email));
  }

  const usersData: AdminUser[] = authUsers.map((u) => ({
    id: u.id,
    email: u.email ?? "(no email)",
    fullName: fullNameById.get(u.id) ?? null,
    isSelf: u.id === user.id,
    isSuperAdmin: superAdminById.get(u.id) ?? false,
    canEditBudgets: budgetAccessById.get(u.id) ?? false,
    notificationsEnabled: notifyById.get(u.id) ?? false,
    positionId: positionIdByUser.get(u.id) ?? null,
    mainDealershipId: mainStoreByUser.get(u.id) ?? null,
    lastSignInLabel: formatSignIn(u.lastSignInAt),
    memberships: membershipsByUser.get(u.id) ?? [],
    isActive: activeById.get(u.id) ?? true,
  }));

  const offboardedCount = usersData.filter((u) => !u.isActive).length;
  const activeCount = usersData.length - offboardedCount;

  return (
    // Tighter than it was: the sections are cards now, so the border does the
    // separating that a large gap used to.
    <div className="flex flex-col gap-4">
      {emailChanged ? (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
        >
          They now sign in as <strong>{emailChanged}</strong> — on the Launchpad
          as well as here. Let them know; no email was sent.
        </p>
      ) : null}

      {emailError ? (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300"
        >
          {emailError}
        </p>
      ) : null}

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Lapis Automotive Group
        </p>
        <h1 className="text-xl font-semibold tracking-tight">Admin</h1>
      </div>

      <AdminSection
        title="Dealerships"
        meta={`${dealershipList.length} ${
          dealershipList.length === 1 ? "store" : "stores"
        }`}
        hint="The number in front of each store is its place on the dashboard — change it and click away to save. Leave it empty to send a store to the end. Open a store to see and edit who has access, and who gets its daily report by email. Super admins have full access to every store."
        defaultOpen
      >
        <div className="flex flex-col gap-2">
          {dealershipList.map((d) => (
            <StoreRow
              key={d.id}
              dealershipId={d.id}
              name={d.name}
              sortOrder={d.sort_order}
              members={membersByStore.get(d.id) ?? []}
              allUsers={allUsersLite}
              subscribedIds={recipientsByStore.get(d.id) ?? []}
              mailConfigured={mailConfigured}
            />
          ))}
          {dealershipList.length === 0 ? (
            <p className="text-sm text-zinc-500">No dealerships yet.</p>
          ) : null}
        </div>
        <form action={createDealership} className="mt-1 flex gap-2">
          <input
            type="text"
            name="name"
            placeholder="New dealership name"
            aria-label="New dealership name"
            required
            className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
          />
          <button
            type="submit"
            className="rounded-md btn-primary px-3 py-2 text-sm font-semibold shadow-sm transition-colors"
          >
            Add
          </button>
        </form>
      </AdminSection>

      <AdminSection
        title="Positions"
        meta={`${positionsList.length} ${
          positionsList.length === 1 ? "position" : "positions"
        }`}
        hint="Job titles you can assign to users. Turn on “Group rollup” for a position to let those users see the all-stores summary at the top of the dashboard. (Super admins always see it.)"
      >
        <ul className="flex flex-col gap-2">
          {positionsList.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
            >
              <span className="font-medium">{p.name}</span>
              <div className="flex items-center gap-4">
                <form action={setPositionRollup}>
                  <input type="hidden" name="position_id" value={p.id} />
                  <input
                    type="hidden"
                    name="can_view_rollup"
                    value={(!p.canViewRollup).toString()}
                  />
                  <button
                    type="submit"
                    className={
                      p.canViewRollup
                        ? "text-blue-600 hover:underline dark:text-blue-400"
                        : "text-zinc-500 hover:underline"
                    }
                  >
                    {p.canViewRollup ? "Group rollup: on" : "Group rollup: off"}
                  </button>
                </form>
                <form action={deletePosition} className="flex">
                  <input type="hidden" name="position_id" value={p.id} />
                  <ConfirmButton
                    message={`Remove the “${p.name}” position? Anyone assigned to it will have no position.`}
                    className="text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
                  >
                    Remove
                  </ConfirmButton>
                </form>
              </div>
            </li>
          ))}
          {positionsList.length === 0 ? (
            <li className="text-sm text-zinc-500">No positions yet.</li>
          ) : null}
        </ul>
        <form action={createPosition} className="flex gap-2">
          <input
            type="text"
            name="name"
            placeholder="New position"
            aria-label="New position name"
            required
            className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
          />
          <button
            type="submit"
            className="rounded-md btn-primary px-3 py-2 text-sm font-semibold shadow-sm transition-colors"
          >
            Add
          </button>
        </form>
      </AdminSection>

      <AdminSection
        title="Dashboard"
        meta={[
          showLeaderboard ? "Leaders shown" : "Leaders hidden",
          adminRollup ? "rollup on for admins" : "rollup off for admins",
        ].join(" · ")}
        hint="Settings that change what everyone sees on the dashboard."
      >
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
          <div>
            <span className="font-medium">Leaders section</span>
            <p className="text-xs text-zinc-500">
              The “Gross leader” and “Unit leader” cards shown above the store
              list.
            </p>
          </div>
          <form action={setShowLeaderboard}>
            <input
              type="hidden"
              name="show_leaderboard"
              value={(!showLeaderboard).toString()}
            />
            <button
              type="submit"
              className={
                showLeaderboard
                  ? "text-blue-600 hover:underline dark:text-blue-400"
                  : "text-zinc-500 hover:underline"
              }
            >
              {showLeaderboard ? "Shown — click to hide" : "Hidden — click to show"}
            </button>
          </form>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
          <div>
            <span className="font-medium">All-stores rollup for admins</span>
            <p className="text-xs text-zinc-500">
              The group-wide totals at the top of the dashboard. Super admins
              get these automatically; this turns that off. Positions with
              “Group rollup” switched on keep it either way.
            </p>
          </div>
          <form action={setAdminRollup}>
            <input
              type="hidden"
              name="admin_rollup"
              value={(!adminRollup).toString()}
            />
            <button
              type="submit"
              className={
                adminRollup
                  ? "text-blue-600 hover:underline dark:text-blue-400"
                  : "text-zinc-500 hover:underline"
              }
            >
              {adminRollup ? "On — click to turn off" : "Off — click to turn on"}
            </button>
          </form>
        </div>
      </AdminSection>

      {/* Opened automatically when a save or test just happened, so the
          result is not hidden behind a closed heading. */}
      <AdminSection
        title="Mail server"
        meta={
          smtp.source === "unset"
            ? "Not set up — no reports sending"
            : `${smtp.host}${
                smtp.source === "environment" ? " (from environment)" : ""
              }`
        }
        defaultOpen={Boolean(smtpSaved || smtpTested || smtpError)}
      >
        <SmtpForm
          settings={smtp}
          defaultTestEmail={user.email}
          saved={smtpSaved === "saved"}
          tested={smtpTested ?? null}
          error={smtpError ?? null}
        />
      </AdminSection>

      <AdminSection
        title="Sign-in email"
        meta="Password resets and invitations"
        hint="Separate from the mail server above: password resets and invitations are sent by Supabase, using the SMTP configured under Supabase → Authentication. This checks that one is delivering."
      >
        <EmailTestForm defaultEmail={user.email} />
      </AdminSection>

      <AdminSection title="Add a user">
        <InviteForm dealerships={dealershipList} positions={positionsList} />
      </AdminSection>

      <AdminSection
        title="Users & access"
        meta={
          offboardedCount > 0
            ? `${activeCount} active · ${offboardedCount} offboarded`
            : `${usersData.length} ${usersData.length === 1 ? "user" : "users"}`
        }
        hint="Search, or open a domain group and then a user, to set their position, per-store editor/viewer access, notifications, or password. People offboarded in the Launchpad are listed separately at the bottom."
        defaultOpen
      >
        {authUsersError ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            Couldn&apos;t load the user list ({authUsersError.message}). Reload
            the page to try again.
          </p>
        ) : (
          <UsersPanel
            users={usersData}
            dealerships={dealershipList}
            positions={positionsList}
          />
        )}
      </AdminSection>
    </div>
  );
}
