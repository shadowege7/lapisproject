"use client";

/**
 * The entry form's submit button. If the day being saved already has numbers,
 * it warns that saving overwrites them and lets the person cancel first. The
 * date is read from the form at click time, so it's correct even after the
 * date picker is changed to a day other than the one the page loaded with.
 */
export function SaveEntryButton({
  existingDates,
  label,
  className,
}: {
  existingDates: string[];
  label: string;
  className?: string;
}) {
  const taken = new Set(existingDates);
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        const field = e.currentTarget.form?.elements.namedItem(
          "entry_date",
        ) as unknown as HTMLInputElement | null;
        const date = field?.value ?? "";
        if (
          date &&
          taken.has(date) &&
          !window.confirm(
            `Numbers are already saved for ${date}. Saving will overwrite them with what's on this form. Continue?`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      {label}
    </button>
  );
}
