import { login } from "./actions";
import { BrandLogo } from "@/app/brand-logo";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <BrandLogo className="h-12" />
          <p className="text-sm text-zinc-500">Sales Tracker</p>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-white p-8 shadow-lg shadow-blue-900/5 dark:border-blue-950/60 dark:bg-[#0e1626]">
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
        </div>
      </div>
    </div>
  );
}
