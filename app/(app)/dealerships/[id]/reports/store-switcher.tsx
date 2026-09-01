"use client";

import { useRouter } from "next/navigation";

/**
 * Jumps to another store's insights.
 *
 * The options are whatever `dealerships` returned for this user, which the
 * `dealerships_select` policy already narrows to super admins and *active*
 * members — so the list is scoped by the database rather than by this
 * component, and a store nobody should see cannot reach it in the first place.
 * Picking one is also not a way in: the reports route re-checks access on the
 * way in and 404s a store the viewer has no claim on.
 *
 * Rendered only when there is somewhere to go. A lone store in a picker is a
 * control that cannot do anything.
 */
export function StoreSwitcher({
  stores,
  currentId,
}: {
  stores: { id: string; name: string }[];
  currentId: string;
}) {
  const router = useRouter();

  if (stores.length < 2) return null;

  return (
    <label className="flex items-center gap-2 text-sm print:hidden">
      <span className="sr-only">Switch store</span>
      <select
        value={currentId}
        onChange={(event) => {
          const next = event.target.value;
          if (next !== currentId) {
            router.push(`/dealerships/${next}/reports`);
          }
        }}
        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-blue-400 dark:border-zinc-700 dark:bg-[var(--surface)] dark:text-zinc-200 dark:hover:border-blue-800"
      >
        {stores.map((store) => (
          <option key={store.id} value={store.id}>
            {store.name}
          </option>
        ))}
      </select>
    </label>
  );
}
