/** The customer this deployment belongs to. */
export const COMPANY_NAME = "Lapis Automotive Group";

/** Who owns the software, as distinct from who uses it. */
export const LEGAL_OWNER = "ShadowEdge LLC";

/**
 * The copyright line. Kept identical to the Launchpad's, since the two apps
 * sit on the same domain and a person moves between them.
 *
 * The year is read at render rather than hardcoded, so it does not quietly go
 * stale on New Year's Day. Safe because the pages that show it are
 * server-rendered per request, not prerendered at build time.
 */
export function Copyright({ className = "" }: { className?: string }) {
  return (
    <p className={className}>
      © {new Date().getFullYear()} {LEGAL_OWNER}. All rights reserved.
    </p>
  );
}

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
