import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import {
  createDealership,
  deleteUser,
  inviteAndAssign,
  removeMembership,
  setSuperAdmin,
} from "./actions";
import { ConfirmButton } from "./confirm-button";

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

  const profileById = new Map(profiles?.map((p) => [p.id, p]));
  const emailById = new Map(
    authUsers?.users.map((u) => [u.id, u.email ?? "(no email)"]),
  );
  const dealershipById = new Map(dealerships?.map((d) => [d.id, d.name]));

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
          {(dealerships ?? []).map((d) => (
            <li key={d.id}>{d.name}</li>
          ))}
          {(dealerships ?? []).length === 0 ? (
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
        <h2 className="font-medium">Team access</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                <th className="py-2 pr-4">User</th>
                <th className="py-2 pr-4">Dealership</th>
                <th className="py-2 pr-4">Role</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {(members ?? []).map((m) => (
                <tr
                  key={m.id}
                  className="border-b border-zinc-100 dark:border-zinc-900"
                >
                  <td className="py-2 pr-4">
                    {emailById.get(m.user_id) ?? m.user_id}
                  </td>
                  <td className="py-2 pr-4">
                    {dealershipById.get(m.dealership_id) ?? m.dealership_id}
                  </td>
                  <td className="py-2 pr-4">{m.role}</td>
                  <td className="py-2 pr-4">
                    <form action={removeMembership}>
                      <input
                        type="hidden"
                        name="membership_id"
                        value={m.id}
                      />
                      <button
                        type="submit"
                        className="text-red-600 hover:underline dark:text-red-400"
                      >
                        Remove
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {(members ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 text-zinc-500">
                    No team members assigned yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <form
          action={inviteAndAssign}
          className="flex flex-wrap items-end gap-2"
        >
          <label className="flex flex-col gap-1 text-sm">
            Email
            <input
              type="email"
              name="email"
              required
              className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Full name (optional)
            <input
              type="text"
              name="full_name"
              className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Dealership
            <select
              name="dealership_id"
              required
              className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
            >
              {(dealerships ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Role
            <select
              name="role"
              defaultValue="viewer"
              className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
          </label>
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            Invite &amp; assign
          </button>
        </form>
        <p className="text-xs text-zinc-500">
          If the email doesn&apos;t already have an account, this sends an
          invite email so they can set a password.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Users</h2>
        <p className="text-xs text-zinc-500">
          Super admins can view and edit every dealership and manage all
          users. Removing a user deletes their account and dealership access;
          any sales entries they logged are kept.
        </p>
        <ul className="flex flex-col gap-2 text-sm">
          {(authUsers?.users ?? []).map((u) => {
            const profile = profileById.get(u.id);
            const isSelf = u.id === user.id;
            return (
              <li
                key={u.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1"
              >
                <span className="flex-1">
                  {u.email}
                  {profile?.is_super_admin ? (
                    <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                      super admin
                    </span>
                  ) : null}
                  {isSelf ? (
                    <span className="ml-2 text-xs text-zinc-400">(you)</span>
                  ) : null}
                </span>
                <form action={setSuperAdmin}>
                  <input type="hidden" name="user_id" value={u.id} />
                  <input
                    type="hidden"
                    name="is_super_admin"
                    value={(!profile?.is_super_admin).toString()}
                  />
                  <button
                    type="submit"
                    className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {profile?.is_super_admin
                      ? "Revoke super admin"
                      : "Make super admin"}
                  </button>
                </form>
                {isSelf ? null : (
                  <form action={deleteUser}>
                    <input type="hidden" name="user_id" value={u.id} />
                    <ConfirmButton
                      message={`Permanently delete ${u.email}? This removes their account and all dealership access. This cannot be undone.`}
                      className="text-sm text-red-600 hover:underline dark:text-red-400"
                    >
                      Remove user
                    </ConfirmButton>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
