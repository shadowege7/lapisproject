import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/login/actions";
import { BrandLogo } from "@/app/brand-logo";
import { APP_NAME, COMPANY_NAME, Copyright } from "@/app/brand";
import { ThemeToggle } from "@/app/theme-toggle";
import { HeaderMenu } from "./header-menu";
import { PushRefresh } from "./push-refresh";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Every page in this group renders inside this layout, so this is the one
  // place the temporary-password gate has to hold.
  const user = await requireUser();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      {/* Silently re-establishes a lost/rotated push subscription on every app
          open, but only for users who already granted notifications. */}
      <PushRefresh />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-20 focus:rounded-md focus:bg-blue-600 focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-10 border-b border-blue-100 bg-white/80 backdrop-blur dark:border-blue-950/60 dark:bg-[var(--surface)]/80 print:hidden">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/dashboard" className="shrink-0">
            <BrandLogo className="h-6" />
          </Link>
          <HeaderMenu>
            <Link
              href="/dashboard"
              className="font-medium text-zinc-600 hover:text-blue-700 dark:text-zinc-300 dark:hover:text-blue-400"
            >
              Dashboard
            </Link>
            {user.isSuperAdmin ? (
              <Link
                href="/admin"
                className="font-medium text-zinc-600 hover:text-blue-700 dark:text-zinc-300 dark:hover:text-blue-400"
              >
                Admin
              </Link>
            ) : null}
            <Link
              href="/account"
              className="font-medium text-zinc-600 hover:text-blue-700 dark:text-zinc-300 dark:hover:text-blue-400"
            >
              Account
            </Link>
            {/* In the menu on a phone, where there is room for it; alongside
                the links from `md` up only if the bar is wide enough. */}
            <span className="text-zinc-400 max-sm:order-first sm:hidden md:inline">
              {user.email}
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-md border border-zinc-200 px-2.5 py-1 text-zinc-600 hover:border-blue-300 hover:text-blue-700 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-blue-800 dark:hover:text-blue-400"
              >
                Sign out
              </button>
            </form>
            <ThemeToggle />
          </HeaderMenu>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 pb-8 pt-4">
        {children}
      </main>
      <footer className="mx-auto w-full max-w-7xl px-4 py-6 text-xs text-zinc-400">
        <p>
          {COMPANY_NAME} · {APP_NAME}
        </p>
        <Copyright className="mt-1" />
      </footer>
    </div>
  );
}
