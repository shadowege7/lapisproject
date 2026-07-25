import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listAllUsers } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import type { DealershipRole } from "@/lib/database.types";
import { createDealership, createPosition, deletePosition } from "./actions";
import { InviteForm } from "./invite-form";
import { UsersPanel, type AdminUser } from "./users-panel";
import { StoreRow } from "./store-row";
import { ConfirmButton } from "./confirm-button";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isSuperAdmin) redirect("/dashboard");

  const supabase = await createClient();

  const [
    { data: dealerships },
    { data: members },
    { data: positions },
    usersResult,
  ] = await Promise.all([
    supabase.from("dealerships").select("id, name").order("name"),
    supabase
      .from("dealership_members")
      .select("id, dealership_id, user_id, role"),
    supabase
      .from("positions")
      .select("id, name, sort_order")
      .order("sort_order")
      .order("name"),
    listAllUsers(),
  ]);

  const authUsers = usersResult.users;
  const authUsersError = usersResult.error;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, is_super_admin, full_name, notifications_enabled, position_id");

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
  const emailById = new Map(authUsers.map((u) => [u.id, u.email ?? ""]));
  const dealershipById = new Map(dealerships?.map((d) => [d.id, d.name]));
  const dealershipList = dealerships ?? [];
  const positionsList = (positions ?? []).map((p) => ({
    id: p.id,
    name: p.name,
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
    memberships: membershipsByUser.get(u.id) ?? [],
  }));

  return (
    <div className="flex flex-col gap-10">
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
          Job titles you can assign to users.
        </p>
        <ul className="flex flex-wrap gap-2">
          {positionsList.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-2 rounded-full border border-zinc-200 px-3 py-1 text-sm dark:border-zinc-700"
            >
              {p.name}
              <form action={deletePosition} className="flex">
                <input type="hidden" name="position_id" value={p.id} />
                <ConfirmButton
                  message={`Remove the “${p.name}” position? Anyone assigned to it will have no position.`}
                  className="text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
                >
                  ✕
                </ConfirmButton>
              </form>
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
