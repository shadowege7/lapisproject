import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { BrandLogo } from "@/app/brand-logo";
import { Copyright } from "@/app/brand";
import { ThemeToggle } from "@/app/theme-toggle";
import { setPassword } from "./actions";

const field =
  "w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700";

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  // Deliberately not `requireUser()` — that helper redirects *here*, so using
  // it would loop. This page only needs a signed-in user.
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Someone who already has a real password can still reach this page to
  // change it voluntarily; only the copy differs.
  const forced = user.mustChangePassword;

  return (
    <div className="relative flex flex-1 items-center justify-center px-4 py-12">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <BrandLogo className="h-10" />
          <p className="text-sm text-zinc-500">Sales Tracker</p>
        </div>

        <form
          action={setPassword}
          className="rounded-2xl border border-blue-100 bg-white p-8 shadow-lg shadow-blue-900/5 dark:border-blue-950/60 dark:bg-[var(--surface)]"
        >
          <h1 className="text-lg font-semibold">
            {forced ? "Choose your password" : "Change your password"}
          </h1>
          <p className="mt-1 mb-5 text-sm text-zinc-500">
            {forced
              ? "Your account was set up with a temporary password. Pick a new one to continue."
              : "Enter a new password for your account."}
          </p>

          {error ? (
            <p
              role="alert"
              className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
            >
              {error}
            </p>
          ) : null}

          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm font-medium">
              New password
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={10}
                required
                className={field}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Confirm password
              <input
                id="confirm"
                name="confirm"
                type="password"
                autoComplete="new-password"
                minLength={10}
                required
                className={field}
              />
            </label>
          </div>

          <p className="mt-2 mb-6 text-xs text-zinc-500">
            At least 10 characters.
          </p>

          <button
            type="submit"
            className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            Save password
          </button>
        </form>

        <Copyright className="mt-6 text-center text-xs text-zinc-500" />
      </div>
    </div>
  );
}
