/**
 * Shared chrome for the tables on the reports page.
 *
 * Both tables here are wider than a phone, and both get printed. Everything in
 * this file exists to serve one or the other.
 */

/**
 * The scroll container a wide table sits in. `overflow-x-auto` keeps the table
 * scrolling inside its own box so the page body never scrolls sideways.
 *
 * `flush` drops the horizontal padding. The Daily table needs it: a sticky
 * first column pins to the *scrollport* edge, so with padding on the container
 * the Date cell would slide out over the gutter as soon as you scrolled. A
 * flush container puts that padding on the cells instead, where it travels
 * with them.
 */
export function Card({
  children,
  flush = false,
}: {
  children: React.ReactNode;
  flush?: boolean;
}) {
  return (
    <div
      className={`overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[var(--surface)] ${
        flush ? "" : "px-4"
      }`}
    >
      {children}
    </div>
  );
}

/**
 * The rule that opens a column group — New, Used, Sprinter, Total. Applied to
 * the first cell of each group in every row, header and body alike.
 *
 * A rule rather than a tint on purpose. The print block in `app/globals.css`
 * forces `background: transparent` and `color: #000` on every element, so any
 * grouping carried by fill or hue is simply gone on paper. It leaves borders
 * alone (recolouring them to #d4d4d8), so a vertical hairline is the one
 * grouping device that reads the same on screen, in both themes, and in ink.
 */
export const GROUP_RULE = "border-l border-zinc-200 dark:border-zinc-800";

/** Left padding for the cell that opens a group, clearing its rule. */
export const GROUP_PAD = "pl-3";
