import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { logout } from "@/app/login/actions";
import { BrandLogo } from "@/app/brand-logo";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-blue-100 bg-white/80 backdrop-blur dark:border-blue-950/60 dark:bg-[#0e1626]/80">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/dashboard" className="shrink-0">
            <BrandLogo />
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
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {children}
      </main>
      <footer className="mx-auto w-full max-w-5xl px-4 py-6 text-xs text-zinc-400">
        Lapis Automotive Group · Sales Tracker
      </footer>
    </div>
  );
}
