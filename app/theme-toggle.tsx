"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTheme(
      document.documentElement.classList.contains("dark") ? "dark" : "light",
    );
  }, []);

  // Until mounted, render the default (LAPIS Mode = on) so server and first
  // client render match; the effect then reconciles to the real theme.
  const on = mounted ? theme === "dark" : true;

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
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
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
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
