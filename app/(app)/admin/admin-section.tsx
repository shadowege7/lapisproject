/**
 * One collapsible block of the admin page.
 *
 * A <details> rather than client state, matching the store and user rows: no
 * JavaScript needed, keyboard-operable for free, and the browser remembers
 * nothing between loads — which is right here, since the useful default is the
 * same every time.
 *
 * The `meta` line matters more than it looks. A page of collapsed headings is
 * only an improvement if you can still tell what is inside them, so each
 * header carries the thing you would otherwise open it to check: how many
 * stores, whether mail is set up.
 */
export function AdminSection({
  title,
  meta,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string;
  /** State worth seeing while closed — a count, a status. */
  meta?: string;
  hint?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[var(--surface)]"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <h2 className="font-medium">{title}</h2>
        {meta ? (
          <span className="truncate text-xs text-zinc-500">{meta}</span>
        ) : null}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="ml-auto h-4 w-4 shrink-0 text-zinc-400 transition-transform group-open:rotate-90"
          aria-hidden
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
      </summary>

      <div className="flex flex-col gap-3 border-t border-zinc-100 p-4 dark:border-zinc-800">
        {hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
        {children}
      </div>
    </details>
  );
}
