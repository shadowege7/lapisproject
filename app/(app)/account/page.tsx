import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { updateOwnPassword } from "./actions";
import { NotificationsToggle } from "./notifications";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ updated?: string; error?: string }>;
}) {
  const { updated, error } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("notifications_enabled")
    .eq("id", user.id)
    .single();
  const notificationsEnabledForAccount = profile?.notifications_enabled ?? false;

  const inputClass =
    "rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700";

  return (
    <div className="flex max-w-md flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
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
          className="w-fit rounded-md btn-primary px-4 py-2 text-sm font-semibold shadow-sm transition-colors"
        >
          Update password
        </button>
      </form>

      <div className="flex flex-col gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <h2 className="text-sm font-semibold">Notifications</h2>
        <p className="text-sm text-zinc-500">
          Get a push notification when a day&apos;s numbers are entered for a
          store you can access.
        </p>
        {notificationsEnabledForAccount ? (
          <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
            Your account is set to receive notifications.
          </p>
        ) : (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            An admin hasn&apos;t enabled notifications for your account yet — you
            can still enable this device now and you&apos;ll receive them once
            they do.
          </p>
        )}
        <NotificationsToggle />
      </div>
    </div>
  );
}
