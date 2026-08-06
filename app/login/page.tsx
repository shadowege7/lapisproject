import Link from "next/link";
import { login } from "./actions";
import { BrandLogo } from "@/app/brand-logo";
import { APP_NAME, Copyright } from "@/app/brand";
import { ThemeToggle } from "@/app/theme-toggle";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <div className="relative flex flex-1 items-center justify-center px-4 py-12">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/Lapis-Obsidian-Emblem.png"
            alt=""
            aria-hidden
            className="h-16 w-auto select-none dark:hidden"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/Lapis-Platinum-Emblem.png"
            alt=""
            aria-hidden
            className="hidden h-16 w-auto select-none dark:block"
          />
          <BrandLogo className="h-10" />
          <p className="text-sm text-zinc-500">{APP_NAME}</p>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-white p-8 shadow-lg shadow-blue-900/5 dark:border-blue-950/60 dark:bg-[var(--surface)]">
          <p className="mb-6 text-sm text-zinc-500">Sign in to continue</p>

          {error ? (
            <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          ) : null}

          <form action={login} className="flex flex-col gap-4">
            <input type="hidden" name="next" value={next ?? "/dashboard"} />
            <label className="flex flex-col gap-1 text-sm font-medium">
              Email
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Password
              <input
                type="password"
                name="password"
                required
                autoComplete="current-password"
                className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700"
              />
            </label>
            <button
              type="submit"
              className="mt-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              Sign in
            </button>
          </form>

          <p className="mt-4 text-center text-sm">
            <Link
              href="/forgot-password"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              Forgot your password?
            </Link>
          </p>
        </div>

        <Copyright className="mt-6 text-center text-xs text-zinc-500" />
      </div>
    </div>
  );
}
