import Link from "next/link";
import { requestPasswordReset } from "@/app/login/actions";
import { BrandLogo } from "@/app/brand-logo";
import { APP_NAME, Copyright } from "@/app/brand";
import { ThemeToggle } from "@/app/theme-toggle";

const field =
  "rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700";

const card =
  "rounded-2xl border border-blue-100 bg-white p-8 shadow-lg shadow-blue-900/5 dark:border-blue-950/60 dark:bg-[var(--surface)]";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;

  return (
    <div className="relative flex flex-1 items-center justify-center px-4 py-12">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <BrandLogo className="h-10" />
          <p className="text-sm text-zinc-500">{APP_NAME}</p>
        </div>

        <div className={card}>
          {sent ? (
            <>
              <h1 className="text-lg font-semibold">Check your email</h1>
              {/* Worded so it reads the same whether or not an account exists —
                  otherwise this page becomes a way to discover who works here. */}
              <p className="mt-2 text-sm text-zinc-500">
                If there&apos;s an account for that address, a link to set a new
                password is on its way. It expires in an hour and can only be
                used once.
              </p>
              {/* Said plainly, because the link opens a different address than
                  the one they are standing on and that looks wrong otherwise. */}
              <p className="mt-3 text-sm text-zinc-500">
                The link opens the Lapis Launchpad to set your password. The
                same sign-in covers both, so you&apos;ll come straight back here
                afterwards.
              </p>
              <p className="mt-3 text-sm text-zinc-500">
                Nothing after a few minutes? Check your junk folder, or ask an
                administrator.
              </p>
              <Link
                href="/login"
                className="mt-5 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400"
              >
                ← Back to sign in
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-lg font-semibold">Forgot your password?</h1>
              <p className="mt-2 mb-5 text-sm text-zinc-500">
                Enter your work email and we&apos;ll send you a link to set a new
                one.
              </p>

              <form action={requestPasswordReset} className="flex flex-col gap-4">
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Email
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className={field}
                  />
                </label>

                <button
                  type="submit"
                  className="mt-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  Send me a link
                </button>
              </form>

              <Link
                href="/login"
                className="mt-5 inline-block text-sm text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400"
              >
                ← Back to sign in
              </Link>
            </>
          )}
        </div>

        <Copyright className="mt-6 text-center text-xs text-zinc-500" />
      </div>
    </div>
  );
}
