import { Fragment } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import { ConfirmButton } from "@/app/(app)/admin/confirm-button";
import type { Database } from "@/lib/database.types";
import { deleteEntry } from "./actions";
import { Card, GROUP_RULE, GROUP_PAD } from "./table-chrome";

type DailyEntry = Database["public"]["Tables"]["daily_entries"]["Row"];

/**
 * The most recent daily entries, with the four-column blocks banded under
 * spanning group headers.
 *
 * Deliberately still a real `<table>`: the print rules in `app/globals.css`
 * repeat `thead` across pages via `display: table-header-group`, which only
 * works on an actual table. Rebuilding this as divs would silently break
 * pagination on a month's worth of rows.
 */
export function DailyTable({
  entries,
  sprinters,
  dealershipId,
  canEdit,
  canDelete,
}: {
  entries: DailyEntry[];
  sprinters: boolean;
  dealershipId: string;
  canEdit: boolean;
  canDelete: boolean;
}) {
  // Date + 4 new + 4 used + total gross, plus 4 more where Sprinters show.
  // Used for the notes row's colSpan and the empty-state message, both of
  // which look broken if the count is off by one. The group-header row spans
  // the same columns and has to add up to the same number.
  const columnCount = 10 + (sprinters ? 4 : 0);
  const cols = columnCount + (canEdit ? 1 : 0);

  // The Date column stays put while the rest scrolls under it, so a row is
  // still identifiable at 360px. It needs an opaque background of its own,
  // because a table cell paints over its row's background: hence the explicit
  // hover colour rather than inheriting the row's translucent tint.
  // z-index is set per use rather than baked in here: the header cells have to
  // sit above the body cells as well as above the columns scrolling under them.
  const stickyDate =
    "sticky left-0 bg-white pl-4 pr-4 dark:bg-[var(--surface)] print:static";

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold">
        Daily
        <span className="ml-2 font-normal text-zinc-400">
          most recent 31 entries
        </span>
      </h2>
      <Card flush>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500">
              <th className={`${stickyDate} z-20 pb-1 pt-2.5 font-semibold`} />
              <th
                scope="colgroup"
                colSpan={4}
                className={`${GROUP_RULE} ${GROUP_PAD} pb-1 pr-4 pt-2.5 font-semibold`}
              >
                New
              </th>
              <th
                scope="colgroup"
                colSpan={4}
                className={`${GROUP_RULE} ${GROUP_PAD} pb-1 pr-4 pt-2.5 font-semibold`}
              >
                Used
              </th>
              {sprinters ? (
                <th
                  scope="colgroup"
                  colSpan={4}
                  className={`${GROUP_RULE} ${GROUP_PAD} pb-1 pr-4 pt-2.5 font-semibold`}
                >
                  Sprinter
                </th>
              ) : null}
              <th
                scope="colgroup"
                className={`${GROUP_RULE} ${GROUP_PAD} pb-1 pr-4 pt-2.5 font-semibold text-blue-700 dark:text-blue-400`}
              >
                Total
              </th>
              {canEdit ? <th className="print:hidden" /> : null}
            </tr>
            <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
              <th scope="col" className={`${stickyDate} z-20 py-2.5 font-medium`}>
                Date
              </th>
              <th
                scope="col"
                className={`${GROUP_RULE} ${GROUP_PAD} py-2.5 pr-4 font-medium`}
              >
                Units
              </th>
              <th scope="col" className="py-2.5 pr-4 font-medium">
                Front
              </th>
              <th scope="col" className="py-2.5 pr-4 font-medium">
                Back
              </th>
              <th scope="col" className="py-2.5 pr-4 font-medium">
                Gross
              </th>
              <th
                scope="col"
                className={`${GROUP_RULE} ${GROUP_PAD} py-2.5 pr-4 font-medium`}
              >
                Units
              </th>
              <th scope="col" className="py-2.5 pr-4 font-medium">
                Front
              </th>
              <th scope="col" className="py-2.5 pr-4 font-medium">
                Back
              </th>
              <th scope="col" className="py-2.5 pr-4 font-medium">
                Gross
              </th>
              {sprinters ? (
                <>
                  <th
                    scope="col"
                    className={`${GROUP_RULE} ${GROUP_PAD} py-2.5 pr-4 font-medium`}
                  >
                    Units
                  </th>
                  <th scope="col" className="py-2.5 pr-4 font-medium">
                    Front
                  </th>
                  <th scope="col" className="py-2.5 pr-4 font-medium">
                    Back
                  </th>
                  <th scope="col" className="py-2.5 pr-4 font-medium">
                    Gross
                  </th>
                </>
              ) : null}
              <th
                scope="col"
                className={`${GROUP_RULE} ${GROUP_PAD} py-2.5 pr-4 font-medium text-blue-700 dark:text-blue-400`}
              >
                Gross
              </th>
              {canEdit ? (
                <th className="py-2.5 pr-4 font-medium print:hidden" />
              ) : null}
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              const newGross = e.new_front_end_gross + e.new_back_end_gross;
              const usedGross = e.used_front_end_gross + e.used_back_end_gross;
              const sprinterGross =
                e.sprinter_front_end_gross + e.sprinter_back_end_gross;
              const total = newGross + usedGross + sprinterGross;
              return (
                <Fragment key={e.id}>
                  <tr
                    className={`group hover:bg-blue-50/40 dark:hover:bg-blue-950/20 ${
                      e.notes
                        ? ""
                        : "border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                    }`}
                  >
                    <td
                      className={`${stickyDate} z-10 py-2.5 font-mono font-medium tabular-nums group-hover:bg-blue-50 dark:group-hover:bg-blue-900`}
                    >
                      {e.entry_date}
                    </td>
                    <td
                      className={`${GROUP_RULE} ${GROUP_PAD} py-2.5 pr-4 font-mono tabular-nums`}
                    >
                      {e.new_units}
                    </td>
                    <td className="py-2.5 pr-4 font-mono tabular-nums">
                      {formatCurrency(e.new_front_end_gross)}
                    </td>
                    <td className="py-2.5 pr-4 font-mono tabular-nums">
                      {formatCurrency(e.new_back_end_gross)}
                    </td>
                    <td className="py-2.5 pr-4 font-mono font-medium tabular-nums">
                      {formatCurrency(newGross)}
                    </td>
                    <td
                      className={`${GROUP_RULE} ${GROUP_PAD} py-2.5 pr-4 font-mono tabular-nums`}
                    >
                      {e.used_units}
                    </td>
                    <td className="py-2.5 pr-4 font-mono tabular-nums">
                      {formatCurrency(e.used_front_end_gross)}
                    </td>
                    <td className="py-2.5 pr-4 font-mono tabular-nums">
                      {formatCurrency(e.used_back_end_gross)}
                    </td>
                    <td className="py-2.5 pr-4 font-mono font-medium tabular-nums">
                      {formatCurrency(usedGross)}
                    </td>
                    {sprinters ? (
                      <>
                        <td
                          className={`${GROUP_RULE} ${GROUP_PAD} py-2.5 pr-4 font-mono tabular-nums`}
                        >
                          {e.sprinter_units}
                        </td>
                        <td className="py-2.5 pr-4 font-mono tabular-nums">
                          {formatCurrency(e.sprinter_front_end_gross)}
                        </td>
                        <td className="py-2.5 pr-4 font-mono tabular-nums">
                          {formatCurrency(e.sprinter_back_end_gross)}
                        </td>
                        <td className="py-2.5 pr-4 font-mono font-medium tabular-nums">
                          {formatCurrency(sprinterGross)}
                        </td>
                      </>
                    ) : null}
                    <td
                      className={`${GROUP_RULE} ${GROUP_PAD} py-2.5 pr-4 font-mono font-semibold tabular-nums text-blue-700 dark:text-blue-400`}
                    >
                      {formatCurrency(total)}
                    </td>
                    {canEdit ? (
                      <td className="py-2.5 pr-4 print:hidden">
                        <div className="flex gap-3">
                          <Link
                            href={`/dealerships/${dealershipId}/entry?date=${e.entry_date}`}
                            className="text-blue-600 hover:underline dark:text-blue-400"
                          >
                            Edit
                          </Link>
                          {canDelete ? (
                            <form action={deleteEntry}>
                              <input
                                type="hidden"
                                name="entry_id"
                                value={e.id}
                              />
                              <input
                                type="hidden"
                                name="dealership_id"
                                value={dealershipId}
                              />
                              <ConfirmButton
                                message={`Delete the entry for ${e.entry_date}? This can't be undone.`}
                                className="text-red-600 hover:underline dark:text-red-400"
                              >
                                Delete
                              </ConfirmButton>
                            </form>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                  {e.notes ? (
                    <tr className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                      <td colSpan={cols} className="pb-2.5 pl-4 pr-4">
                        <div className="rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                          <span className="mr-1.5 font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                            Notes
                          </span>
                          <span className="whitespace-pre-wrap break-words">
                            {e.notes}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
            {entries.length === 0 ? (
              <tr>
                <td colSpan={cols} className="py-4 pl-4 pr-4 text-zinc-500">
                  No entries yet.
                  {/* Hidden whole, link and sentence together: hiding only the
                      link would leave "…to start the log." dangling on paper. */}
                  {canEdit ? (
                    <span className="print:hidden">
                      {" "}
                      <Link
                        href={`/dealerships/${dealershipId}/entry`}
                        className="text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Enter today&apos;s numbers
                      </Link>{" "}
                      to start the log.
                    </span>
                  ) : null}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </section>
  );
}
