import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listAllUsers } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import type { DealershipRole } from "@/lib/database.types";
import { createDealership } from "./actions";
import { InviteForm } from "./invite-form";
import { UserRow } from "./user-row";

function domainOf(email: string): string {
  const at = email.lastIndexOf("@");
  return at >= 0 ? email.slice(at + 1).toLowerCase() : "(no domain)";
}

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isSuperAdmin) redirect("/dashboard");

  const supabase = await createClient();

  const [{ data: dealerships }, { data: members }, usersResult] =
    await Promise.all([
      supabase.from("dealerships").select("id, name").order("name"),
      supabase
        .from("dealership_members")
        .select("id, dealership_id, user_id, role"),
      listAllUsers(),
    ]);

  const authUsers = usersResult.users;
  const authUsersError = usersResult.error;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, is_super_admin, full_name");

  const superAdminById = new Map(
    profiles?.map((p) => [p.id, p.is_super_admin]),
  );
  const fullNameById = new Map(profiles?.map((p) => [p.id, p.full_name]));
  const emailById = new Map(authUsers.map((u) => [u.id, u.email ?? ""]));
  const dealershipById = new Map(dealerships?.map((d) => [d.id, d.name]));
  const dealershipList = dealerships ?? [];

  // memberships grouped per user (for the user rows)
  const membershipsByUser = new Map<
    string,
    { dealershipId: string; role: DealershipRole }[]
  >();
  // members grouped per store (for the store access view)
  const membersByStore = new Map<
    string,
    { userId: string; role: DealershipRole; email: string; fullName: string | null }[]
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

  // users grouped by email domain
  const groups = new Map<string, typeof authUsers>();
  for (const u of authUsers) {
    const d = domainOf(u.email ?? "");
    const arr = groups.get(d) ?? [];
    arr.push(u);
    groups.set(d, arr);
  }
  const sortedGroups = [...groups.entries()]
    .map(([domain, list]) => ({
      domain,
      list: [...list].sort((a, b) =>
        (a.email ?? "").localeCompare(b.email ?? ""),
      ),
    }))
    .sort((a, b) => a.domain.localeCompare(b.domain));

  const summaryClass =
    "flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden";

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
          Open a store to see who has access. Super admins have full access to
          every store.
        </p>
        <div className="flex flex-col gap-2">
          {dealershipList.map((d) => {
            const storeMembers = membersByStore.get(d.id) ?? [];
            return (
              <details
                key={d.id}
                className="group rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#0e1626]"
              >
                <summary className={summaryClass}>
                  <span className="font-medium">{d.name}</span>
                  <span className="flex items-center gap-2 text-xs text-zinc-500">
                    {storeMembers.length} with access
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4 text-zinc-400 transition-transform group-open:rotate-90"
                      aria-hidden
                    >
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </span>
                </summary>
                <div className="border-t border-zinc-100 p-4 dark:border-zinc-800">
                  {storeMembers.length === 0 ? (
                    <p className="text-sm text-zinc-500">
                      No users assigned to this store.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-1.5 text-sm">
                      {storeMembers.map((m) => (
                        <li
                          key={m.userId}
                          className="flex items-center justify-between gap-3"
                        >
                          <span className="min-w-0 truncate">
                            {m.fullName ? (
                              <span className="font-medium">
                                {m.fullName}{" "}
                              </span>
                            ) : null}
                            <span className="text-zinc-500">{m.email}</span>
                          </span>
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                            {m.role}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </details>
            );
          })}
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
        <h2 className="font-medium">Add a user</h2>
        <InviteForm dealerships={dealershipList} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Users &amp; access</h2>
        <p className="text-xs text-zinc-500">
          Users are grouped by email domain. Open a group, then open a user to
          manage their per-store editor/viewer access, reset their password, or
          remove them.
        </p>
        {authUsersError ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            Couldn&apos;t load the user list ({authUsersError.message}). Reload
            the page to try again.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {sortedGroups.map(({ domain, list }) => (
              <details
                key={domain}
                className="group rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#0e1626]"
              >
                <summary className={summaryClass}>
                  <span className="font-medium">{domain}</span>
                  <span className="flex items-center gap-2 text-xs text-zinc-500">
                    {list.length} user{list.length === 1 ? "" : "s"}
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4 text-zinc-400 transition-transform group-open:rotate-90"
                      aria-hidden
                    >
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </span>
                </summary>
                <div className="flex flex-col gap-2 border-t border-zinc-100 p-3 dark:border-zinc-800">
                  {list.map((u) => (
                    <UserRow
                      key={u.id}
                      userId={u.id}
                      email={u.email ?? "(no email)"}
                      fullName={fullNameById.get(u.id) ?? null}
                      isSelf={u.id === user.id}
                      isSuperAdmin={superAdminById.get(u.id) ?? false}
                      memberships={membershipsByUser.get(u.id) ?? []}
                      dealerships={dealershipList}
                    />
                  ))}
                </div>
              </details>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
