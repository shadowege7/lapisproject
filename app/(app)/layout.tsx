import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/login/actions";
import { BrandLogo } from "@/app/brand-logo";
import { COMPANY_NAME, Copyright } from "@/app/brand";
import { ThemeToggle } from "@/app/theme-toggle";

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
      <header className="sticky top-0 z-10 border-b border-blue-100 bg-white/80 backdrop-blur dark:border-blue-950/60 dark:bg-[var(--surface)]/80 print:hidden">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/dashboard" className="shrink-0">
            <BrandLogo className="h-6" />
          </Link>
          <nav className="flex items-center gap-4 text-sm">
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
            <span className="hidden text-zinc-400 sm:inline">{user.email}</span>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-md border border-zinc-200 px-2.5 py-1 text-zinc-600 hover:border-blue-300 hover:text-blue-700 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-blue-800 dark:hover:text-blue-400"
              >
                Sign out
              </button>
            </form>
            <ThemeToggle />
          </nav>
        </div>
      </header>
      {/* The mark at full size, once, under the sticky header — the header
          copy is deliberately small so it does not compete with it. Hidden
          when printing, where a report's own title carries the branding. */}
      <div className="flex justify-center px-4 pt-8 pb-2 print:hidden">
        <BrandLogo className="h-9" />
      </div>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-8 pt-4">
        {children}
      </main>
      <footer className="mx-auto w-full max-w-7xl px-4 py-6 text-xs text-zinc-400">
        <p>{COMPANY_NAME} · Sales Tracker</p>
        <Copyright className="mt-1" />
      </footer>
    </div>
  );
}
