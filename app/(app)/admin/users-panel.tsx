"use client";

import { useMemo, useState } from "react";
import { UserRow } from "./user-row";
import type { DealershipRole } from "@/lib/database.types";

export interface AdminUser {
  id: string;
  email: string;
  fullName: string | null;
  isSelf: boolean;
  isSuperAdmin: boolean;
  canEditBudgets: boolean;
  notificationsEnabled: boolean;
  positionId: string | null;
  mainDealershipId: string | null;
  lastSignInLabel: string;
  memberships: { dealershipId: string; role: DealershipRole }[];
  /** The Launchpad's "has this person left" flag. False = offboarded. */
  isActive: boolean;
}

// Users with no main store are grouped here.
const CORPORATE = "Corporate";

export function UsersPanel({
  users,
  dealerships,
  positions,
}: {
  users: AdminUser[];
  dealerships: { id: string; name: string }[];
  positions: { id: string; name: string }[];
}) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();

  const { groups, offboarded } = useMemo(() => {
    const filtered = query
      ? users.filter((u) =>
          `${u.email} ${u.fullName ?? ""}`.toLowerCase().includes(query),
        )
      : users;

    // Active employees are grouped by their main store; anyone without one is
    // Corporate. Offboarded people are pulled into their own flat list so they
    // can't be mistaken for someone who still signs in.
    const activeUsers = filtered.filter((u) => u.isActive);
    const offboardedUsers = filtered
      .filter((u) => !u.isActive)
      .sort((a, b) => a.email.localeCompare(b.email));

    const nameById = new Map(dealerships.map((d) => [d.id, d.name]));
    const map = new Map<string, AdminUser[]>();
    for (const u of activeUsers) {
      const store =
        (u.mainDealershipId && nameById.get(u.mainDealershipId)) || CORPORATE;
      const arr = map.get(store) ?? [];
      arr.push(u);
      map.set(store, arr);
    }

    // Store groups follow the configured dealership order (the prop is already
    // sorted by sort_order); Corporate sits last.
    const order = dealerships.map((d) => d.name);
    const groups = [...map.entries()]
      .map(([store, list]) => ({
        store,
        list: [...list].sort((a, b) => a.email.localeCompare(b.email)),
      }))
      .sort((a, b) => {
        if (a.store === CORPORATE) return 1;
        if (b.store === CORPORATE) return -1;
        return order.indexOf(a.store) - order.indexOf(b.store);
      });

    return { groups, offboarded: offboardedUsers };
  }, [users, query, dealerships]);

  const activeShown = groups.reduce((n, g) => n + g.list.length, 0);
  const totalShown = activeShown + offboarded.length;

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search users by name or email…"
        aria-label="Search users by name or email"
        className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700"
      />

      {totalShown === 0 ? (
        <p className="text-sm text-zinc-500">
          {query ? `No users match “${q}”.` : "No users yet."}
        </p>
      ) : (
        <>
          {groups.map(({ store, list }) => (
            <details
              key={store}
              open={query ? true : undefined}
              className="group rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[var(--surface)]"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <span className="font-medium">{store}</span>
                <span className="flex items-center gap-2 text-xs text-zinc-500">
                  {list.length} user{list.length === 1 ? "" : "s"}
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4 text-zinc-400 transition-transform group-open:rotate-90"
                    aria-hidden
                  >
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </span>
              </summary>
              <div className="flex flex-col gap-2 border-t border-zinc-100 p-3 dark:border-zinc-800">
                {list.map((u) => (
                  <UserRow
                    key={u.id}
                    userId={u.id}
                    email={u.email}
                    fullName={u.fullName}
                    isSelf={u.isSelf}
                    isSuperAdmin={u.isSuperAdmin}
                    canEditBudgets={u.canEditBudgets}
                    notificationsEnabled={u.notificationsEnabled}
                    positionId={u.positionId}
                    positions={positions}
                    mainDealershipId={u.mainDealershipId}
                    lastSignInLabel={u.lastSignInLabel}
                    memberships={u.memberships}
                    dealerships={dealerships}
                  />
                ))}
              </div>
            </details>
          ))}

          {activeShown === 0 ? (
            <p className="text-sm text-zinc-500">
              {query
                ? `No active users match “${q}”.`
                : "No active users."}
            </p>
          ) : null}

          {/* Offboarded people live in their own list so they can't be
              mistaken for someone who still signs in. Rendered only when
              there is at least one — a lone empty "Offboarded" heading would
              read as a bug. */}
          {offboarded.length > 0 ? (
            <details
              open={query ? true : undefined}
              className="group rounded-xl border border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-white/[0.02]"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2">
                  <span className="font-medium text-zinc-600 dark:text-zinc-300">
                    Offboarded
                  </span>
                  <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    disabled
                  </span>
                </span>
                <span className="flex items-center gap-2 text-xs text-zinc-500">
                  {offboarded.length} user{offboarded.length === 1 ? "" : "s"}
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4 text-zinc-400 transition-transform group-open:rotate-90"
                    aria-hidden
                  >
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </span>
              </summary>
              <div className="flex flex-col gap-2 border-t border-zinc-100 p-3 dark:border-zinc-800">
                <p className="text-xs text-zinc-500">
                  Offboarded in the Launchpad — their sign-in is disabled, so
                  they can&apos;t reach either app. Their store and position
                  history is kept for reporting. Remove them here only to erase
                  the account entirely.
                </p>
                {offboarded.map((u) => (
                  <UserRow
                    key={u.id}
                    userId={u.id}
                    email={u.email}
                    fullName={u.fullName}
                    isSelf={u.isSelf}
                    isSuperAdmin={u.isSuperAdmin}
                    canEditBudgets={u.canEditBudgets}
                    notificationsEnabled={u.notificationsEnabled}
                    positionId={u.positionId}
                    positions={positions}
                    mainDealershipId={u.mainDealershipId}
                    lastSignInLabel={u.lastSignInLabel}
                    memberships={u.memberships}
                    dealerships={dealerships}
                    offboarded
                  />
                ))}
              </div>
            </details>
          ) : null}
        </>
      )}
    </div>
  );
}
