/**
 * Shown while a route segment streams. A quiet placeholder beats a frozen
 * previous page or a blank flash.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse px-4 py-8" aria-hidden>
      <div className="h-6 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-48 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[var(--surface)]"
          />
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
