import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import type { DealershipRole } from "@/lib/database.types";
import { createDealership } from "./actions";
import { InviteForm } from "./invite-form";
import { UserCard } from "./user-card";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isSuperAdmin) redirect("/dashboard");

  const supabase = await createClient();
  const admin = createAdminClient();

  const [{ data: dealerships }, { data: members }, { data: authUsers }] =
    await Promise.all([
      supabase.from("dealerships").select("id, name").order("name"),
      supabase
        .from("dealership_members")
        .select("id, dealership_id, user_id, role"),
      admin.auth.admin.listUsers(),
    ]);

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, is_super_admin");

  const superAdminById = new Map(
    profiles?.map((p) => [p.id, p.is_super_admin]),
  );
  const dealershipById = new Map(dealerships?.map((d) => [d.id, d.name]));

  const membershipsByUser = new Map<
    string,
    { dealershipId: string; role: DealershipRole }[]
  >();
  for (const m of members ?? []) {
    const arr = membershipsByUser.get(m.user_id) ?? [];
    arr.push({ dealershipId: m.dealership_id, role: m.role });
    membershipsByUser.set(m.user_id, arr);
  }
  for (const arr of membershipsByUser.values()) {
    arr.sort((a, b) =>
      (dealershipById.get(a.dealershipId) ?? "").localeCompare(
        dealershipById.get(b.dealershipId) ?? "",
      ),
    );
  }

  const dealershipList = dealerships ?? [];

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
        <ul className="flex flex-col gap-1 text-sm">
          {dealershipList.map((d) => (
            <li key={d.id}>{d.name}</li>
          ))}
          {dealershipList.length === 0 ? (
            <li className="text-zinc-500">No dealerships yet.</li>
          ) : null}
        </ul>
        <form action={createDealership} className="flex gap-2">
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
          Assign each user to one or more stores and choose whether they can
          edit or only view each one. Removing a user deletes their account;
          any sales entries they logged are kept.
        </p>
        <div className="flex flex-col gap-3">
          {(authUsers?.users ?? []).map((u) => (
            <UserCard
              key={u.id}
              userId={u.id}
              email={u.email ?? "(no email)"}
              isSelf={u.id === user.id}
              isSuperAdmin={superAdminById.get(u.id) ?? false}
              memberships={membershipsByUser.get(u.id) ?? []}
              dealerships={dealershipList}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
