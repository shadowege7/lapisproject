/**
 * Shown on a store's pages when it is archived or super-admins-only. Only super
 * admins can open such a store at all (0041), so this is always for them.
 */
export function StoreStateBanner({
  archivedAt,
  superAdminOnly,
}: {
  archivedAt: string | null;
  superAdminOnly: boolean;
}) {
  if (archivedAt) {
    return (
      <p
        role="status"
        className="rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-200"
      >
        <strong>Archived.</strong> This store is hidden from everyone&apos;s
        dashboard and its members can&apos;t open it. Its numbers are kept here
        read-only. Restore it from Admin → Dealerships → Archived stores.
      </p>
    );
  }
  if (superAdminOnly) {
    return (
      <p
        role="status"
        className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
      >
        <strong>Super admins only.</strong> Nobody else can see this store, and
        its numbers stay out of the company totals.
      </p>
    );
  }
  return null;
}
