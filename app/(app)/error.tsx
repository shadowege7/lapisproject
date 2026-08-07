"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Replaces Next's bare "Application error" screen, which drops a service
 * manager on an unbranded page with no way back. Mirrors the Launchpad's.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Page failed to render:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div
        role="alert"
        className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-[var(--surface)]"
      >
        <h1 className="text-lg font-semibold">This page didn&apos;t load</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Something went wrong fetching it. Nothing you were looking at has been
          changed. Try again — if it keeps happening, tell whoever looks after
          this app.
        </p>

        {error.digest ? (
          <p className="mt-3 text-xs text-zinc-500">
            Reference code:{" "}
            <code className="font-mono select-all">{error.digest}</code>
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-md btn-primary px-4 py-2 text-sm font-semibold"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:border-blue-400 hover:text-blue-700 dark:border-zinc-700 dark:text-zinc-200"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
