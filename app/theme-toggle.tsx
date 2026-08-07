"use client";

import { useSyncExternalStore } from "react";

/**
 * The theme lives on <html class="dark">, set before paint by the inline
 * script in the root layout. This reads that class through
 * useSyncExternalStore rather than mirroring it into React state in an effect —
 * the mirror version drifts on first paint, and the shared ESLint config bans
 * setting state from an effect. Ported from the Launchpad so the two match.
 */
function subscribe(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

function getSnapshot() {
  return document.documentElement.classList.contains("dark");
}

// The root layout renders <html class="dark"> by default, so dark is the
// honest server value and hydration matches.
function getServerSnapshot() {
  return true;
}

export function ThemeToggle() {
  const on = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    const next = on ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("theme", next);
    } catch {
      // ignore storage errors (private mode, etc.)
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="LAPIS Mode"
      title={on ? "LAPIS Mode on — switch to light" : "Turn on LAPIS Mode"}
      onClick={toggle}
      className="inline-flex items-center gap-2"
    >
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          on ? "bg-blue-600" : "bg-zinc-300 dark:bg-zinc-600"
        }`}
      >
        <span
          // A ring so the knob's edge always reads — a plain white knob was
          // invisible on the pale "off" track in the light theme (1.72:1).
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow ring-1 ring-black/30 transition-transform ${
            on ? "translate-x-[1.125rem]" : "translate-x-0.5"
          }`}
        />
      </span>
      <span className="hidden text-xs font-medium text-zinc-600 sm:inline dark:text-zinc-300">
        LAPIS Mode
      </span>
    </button>
  );
}
