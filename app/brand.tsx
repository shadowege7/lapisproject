export const COMPANY_NAME = "Lapis Automotive Group";

/**
 * The Lapis monogram: a lapis-blue rounded tile with an "L". Sized via the
 * `className` (defaults to a header-friendly size).
 */
export function BrandMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-flex items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-800 font-bold text-white shadow-sm ${className}`}
    >
      L
    </span>
  );
}

/** Monogram + wordmark, used in the header and on the login card. */
export function BrandLockup({
  markClassName,
  nameClassName = "text-base font-semibold tracking-tight",
}: {
  markClassName?: string;
  nameClassName?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <BrandMark className={markClassName} />
      <span className={nameClassName}>{COMPANY_NAME}</span>
    </span>
  );
}
