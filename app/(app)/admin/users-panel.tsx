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
}

function domainOf(email: string): string {
  const at = email.lastIndexOf("@");
  return at >= 0 ? email.slice(at + 1).toLowerCase() : "(no domain)";
}

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

  const groups = useMemo(() => {
    const filtered = query
      ? users.filter((u) =>
          `${u.email} ${u.fullName ?? ""}`.toLowerCase().includes(query),
        )
      : users;

    const map = new Map<string, AdminUser[]>();
    for (const u of filtered) {
      const d = domainOf(u.email);
      const arr = map.get(d) ?? [];
      arr.push(u);
      map.set(d, arr);
    }
    return [...map.entries()]
      .map(([domain, list]) => ({
        domain,
        list: [...list].sort((a, b) => a.email.localeCompare(b.email)),
      }))
      .sort((a, b) => a.domain.localeCompare(b.domain));
  }, [users, query]);

  const totalShown = groups.reduce((n, g) => n + g.list.length, 0);

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search users by name or email…"
        className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700"
      />

      {totalShown === 0 ? (
        <p className="text-sm text-zinc-500">
          {query ? `No users match “${q}”.` : "No users yet."}
        </p>
      ) : (
        groups.map(({ domain, list }) => (
          <details
            key={domain}
            open={query ? true : undefined}
            className="group rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[var(--surface)]"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
              <span className="font-medium">{domain}</span>
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
        ))
      )}
    </div>
  );
}
