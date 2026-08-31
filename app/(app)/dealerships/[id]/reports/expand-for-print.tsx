"use client";

import { useEffect } from "react";

/**
 * Opens every collapsed `<details data-print-expand>` while the page is being
 * printed, then puts it back.
 *
 * The Daily table starts collapsed, and a closed `<details>` prints as its
 * summary line and nothing else — so without this, collapsing it by default
 * would quietly drop a month of rows from every printout. What is on paper
 * should not depend on which sections someone happened to have open.
 *
 * CSS alone cannot do it. A closed `<details>` hides its content through the
 * browser's own shadow content, not through a rule on the children, so there
 * is nothing for an `@media print` block to override in the engines this is
 * used on.
 *
 * Both signals are listened for because neither covers every browser:
 * `beforeprint`/`afterprint` are what Chrome, Edge and Firefox fire, and
 * Safari instead flips a `print` media query. Whichever arrives first opens
 * the sections; `reopened` makes the pair idempotent, so if both fire the
 * second is a no-op rather than a state the restore cannot undo.
 */
export function ExpandForPrint() {
  useEffect(() => {
    let reopened: HTMLDetailsElement[] = [];

    const expand = () => {
      if (reopened.length) return;
      reopened = Array.from(
        document.querySelectorAll<HTMLDetailsElement>(
          "details[data-print-expand]",
        ),
      ).filter((node) => !node.open);
      for (const node of reopened) node.open = true;
    };

    const restore = () => {
      for (const node of reopened) node.open = false;
      reopened = [];
    };

    const media = window.matchMedia("print");
    const onMediaChange = (event: MediaQueryListEvent) =>
      event.matches ? expand() : restore();

    window.addEventListener("beforeprint", expand);
    window.addEventListener("afterprint", restore);
    media.addEventListener("change", onMediaChange);
    return () => {
      window.removeEventListener("beforeprint", expand);
      window.removeEventListener("afterprint", restore);
      media.removeEventListener("change", onMediaChange);
    };
  }, []);

  return null;
}
