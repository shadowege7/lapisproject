/** The customer this deployment belongs to. */
export const COMPANY_NAME = "Lapis Automotive Group";

/**
 * What this app is called to the people using it.
 *
 * One constant rather than the name typed into each screen, so it cannot end
 * up saying two different things in two places — which is exactly what
 * happened when it was "Sales Tracker" everywhere by hand.
 *
 * The repository, the Vercel project and the docs still say "sales tracker";
 * that is the internal name for the thing, not the product name.
 */
export const APP_NAME = "Sales Portal";

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
