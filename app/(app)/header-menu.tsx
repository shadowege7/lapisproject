"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The header's navigation: a row on a wide screen, a menu behind a button on a
 * phone.
 *
 * The children are rendered once and restyled, not rendered twice behind
 * `hidden`. Two copies would mean two theme toggles and two sign-out forms in
 * the document, and a screen reader reading the whole lot out.
 *
 * The panel is positioned against the sticky header — `position: sticky` makes
 * it a containing block — so it spans the full width of the bar and hangs
 * directly beneath it.
 */
export function HeaderMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointerDown = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={root} className="flex items-center">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="header-nav"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className="rounded-lg border border-zinc-300 p-2 text-zinc-700 transition-colors hover:border-blue-400 hover:text-blue-700 dark:border-zinc-600 dark:text-zinc-200 dark:hover:border-blue-500 dark:hover:text-blue-300 sm:hidden"
      >
        <GridIcon />
      </button>

      <nav
        id="header-nav"
        aria-label="Main"
        // Closed after following a link, but not after using the theme
        // toggle — that would shut the menu on someone mid-decision.
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a")) setOpen(false);
        }}
        className={`${open ? "flex" : "hidden"} absolute left-0 right-0 top-full flex-col items-start gap-3 border-b border-blue-100 bg-white px-4 py-4 text-sm shadow-lg dark:border-blue-950/60 dark:bg-[var(--surface)] sm:static sm:flex sm:flex-row sm:items-center sm:gap-4 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none`}
      >
        {children}
      </nav>
    </div>
  );
}

/** The nine-dot grid, drawn rather than shipped as an icon font. */
function GridIcon() {
  const positions = [5, 12, 19];
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden focusable="false">
      {positions.map((cy) =>
        positions.map((cx) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.6" fill="currentColor" />
        )),
      )}
    </svg>
  );
}
