import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { updateOwnPassword } from "./actions";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ updated?: string; error?: string }>;
}) {
  const { updated, error } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const inputClass =
    "rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700";

  return (
    <div className="flex max-w-md flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400">
          Account
        </p>
        <h1 className="text-xl font-semibold tracking-tight">
          {user.fullName ?? user.email}
        </h1>
        <p className="text-sm text-zinc-500">{user.email}</p>
      </div>

      {updated ? (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          Password updated.
        </p>
      ) : null}
      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <form action={updateOwnPassword} className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold">Change password</h2>
        <label className="flex flex-col gap-1 text-sm font-medium">
          New password
          <input
            type="password"
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Confirm new password
          <input
            type="password"
            name="confirm"
            required
            minLength={8}
            autoComplete="new-password"
            className={inputClass}
          />
        </label>
        <button
          type="submit"
          className="w-fit rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          Update password
        </button>
      </form>
    </div>
  );
}
