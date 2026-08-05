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
  setShowLeaderboard,
} from "./actions";
import { InviteForm } from "./invite-form";
import { EmailTestForm } from "./email-test-form";
import { UsersPanel, type AdminUser } from "./users-panel";
import { StoreRow } from "./store-row";
import { isMailConfigured } from "@/lib/email";
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
  searchParams: Promise<{ email_changed?: string; email_error?: string }>;
}) {
  const { email_changed: emailChanged, email_error: emailError } =
    await searchParams;
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
    supabase.from("dealerships").select("id, name").order("name"),
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
  // actually be sent, rather than assuming it works.
  const mailConfigured = isMailConfigured();

  const authUsers = usersResult.users;
  const authUsersError = usersResult.error;

  const { data: profiles } = await supabase
    .from("profiles")
    .select(
      "id, is_super_admin, full_name, notifications_enabled, position_id, main_dealership_id",
    );

  const { data: leaderboardSetting } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "show_leaderboard")
    .maybeSingle();
  const showLeaderboard = leaderboardSetting?.value !== false;

  const superAdminById = new Map(
    profiles?.map((p) => [p.id, p.is_super_admin]),
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
    notificationsEnabled: notifyById.get(u.id) ?? false,
    positionId: positionIdByUser.get(u.id) ?? null,
    mainDealershipId: mainStoreByUser.get(u.id) ?? null,
    lastSignInLabel: formatSignIn(u.lastSignInAt),
    memberships: membershipsByUser.get(u.id) ?? [],
  }));

  return (
    <div className="flex flex-col gap-10">
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
        <p className="text-xs font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400">
          Lapis Automotive Group
        </p>
        <h1 className="text-xl font-semibold tracking-tight">Admin</h1>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Dealerships</h2>
        <p className="text-xs text-zinc-500">
          Open a store to see and edit who has access. Super admins have full
          access to every store.
        </p>
        <div className="flex flex-col gap-2">
          {dealershipList.map((d) => (
            <StoreRow
              key={d.id}
              dealershipId={d.id}
              name={d.name}
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
            required
            className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
          />
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            Add
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Positions</h2>
        <p className="text-xs text-zinc-500">
          Job titles you can assign to users. Turn on “Group rollup” for a
          position to let those users see the all-stores summary at the top of
          the dashboard. (Super admins always see it.)
        </p>
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
            required
            className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
          />
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            Add
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Dashboard</h2>
        <p className="text-xs text-zinc-500">
          Settings that change what everyone sees on the dashboard.
        </p>
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
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Email</h2>
        <p className="text-xs text-zinc-500">
          Verify the SMTP you configured in Supabase → Authentication is
          delivering. This sends a password-reset email to the address below.
        </p>
        <EmailTestForm defaultEmail={user.email} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Add a user</h2>
        <InviteForm dealerships={dealershipList} positions={positionsList} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Users &amp; access</h2>
        <p className="text-xs text-zinc-500">
          Search, or open a domain group and then a user, to set their position,
          per-store editor/viewer access, notifications, or password.
        </p>
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
      </section>
    </div>
  );
}
