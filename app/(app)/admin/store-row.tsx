"use client";

import { useEffect, useRef, useState } from "react";
import { setMembership, setReportRecipient, unassignStore } from "./actions";
import type { DealershipRole } from "@/lib/database.types";

const selectClass =
  "rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700";

interface StoreMember {
  userId: string;
  email: string;
  fullName: string | null;
  role: DealershipRole;
}

export function StoreRow({
  dealershipId,
  name,
  members,
  allUsers,
  subscribedIds,
  mailConfigured,
}: {
  dealershipId: string;
  name: string;
  members: StoreMember[];
  allUsers: { id: string; email: string; fullName: string | null }[];
  /** Who currently gets this store's emailed daily report. */
  subscribedIds: string[];
  mailConfigured: boolean;
}) {
  const assignedIds = new Set(members.map((m) => m.userId));
  const available = allUsers.filter((u) => !assignedIds.has(u.id));

  return (
    <details className="group rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[var(--surface)]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="font-medium">{name}</span>
        <span className="flex items-center gap-2 text-xs text-zinc-500">
          {members.length} with access
          {subscribedIds.length > 0
            ? ` · ${subscribedIds.length} emailed`
            : ""}
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
      <div className="border-t border-zinc-100 p-4 dark:border-zinc-800">
        {members.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No users assigned to this store.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm">
            {members.map((m) => (
              <li
                key={m.userId}
                className="flex flex-wrap items-center gap-x-3 gap-y-1"
              >
                <span className="min-w-40 flex-1 truncate">
                  {m.fullName ? (
                    <span className="font-medium">{m.fullName} </span>
                  ) : null}
                  <span className="text-zinc-500">{m.email}</span>
                </span>
                <StoreRoleSelect
                  dealershipId={dealershipId}
                  userId={m.userId}
                  role={m.role}
                />
                <form action={unassignStore}>
                  <input type="hidden" name="user_id" value={m.userId} />
                  <input
                    type="hidden"
                    name="dealership_id"
                    value={dealershipId}
                  />
                  <button
                    type="submit"
                    className="text-zinc-500 hover:text-red-600 hover:underline dark:hover:text-red-400"
                  >
                    Unassign
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <ReportRecipients
          dealershipId={dealershipId}
          allUsers={allUsers}
          subscribedIds={subscribedIds}
          mailConfigured={mailConfigured}
        />

        {available.length > 0 ? (
          <form
            action={setMembership}
            className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800"
          >
            <input type="hidden" name="dealership_id" value={dealershipId} />
            <span className="text-xs text-zinc-500">Add user:</span>
            <select name="user_id" required className={selectClass}>
              {available.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName ? `${u.fullName} — ${u.email}` : u.email}
                </option>
              ))}
            </select>
            <select name="role" defaultValue="viewer" className={selectClass}>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <button
              type="submit"
              className="rounded-md btn-primary px-3 py-1 text-sm font-semibold"
            >
              Add
            </button>
          </form>
        ) : null}
      </div>
    </details>
  );
}

/**
 * Who gets emailed this store's numbers when someone saves them.
 *
 * Every user is listed, not just this store's members: the point of the list
 * is that it is independent of access. Each checkbox submits its own form, so
 * there is no Save button to forget — the same pattern as the role dropdowns
 * above.
 */
function ReportRecipients({
  dealershipId,
  allUsers,
  subscribedIds,
  mailConfigured,
}: {
  dealershipId: string;
  allUsers: { id: string; email: string; fullName: string | null }[];
  subscribedIds: string[];
  mailConfigured: boolean;
}) {
  const subscribed = new Set(subscribedIds);

  return (
    <details className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm [&::-webkit-details-marker]:hidden">
        <span className="font-medium">Daily report email</span>
        <span className="text-xs text-zinc-500">
          {subscribed.size === 0
            ? "nobody"
            : `${subscribed.size} ${subscribed.size === 1 ? "person" : "people"}`}
        </span>
        <span className="text-blue-600 dark:text-blue-400">Choose</span>
      </summary>

      <p className="mt-2 text-xs text-zinc-500">
        Sent whenever this store&apos;s numbers are saved for a day, including
        when an earlier day is corrected. Anyone can be added, whether or not
        they have access to this store.
      </p>

      {!mailConfigured ? (
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          No mail server is configured, so nothing is being sent yet. Choices
          made here are saved and take effect once the SMTP settings are in
          place.
        </p>
      ) : null}

      <ul className="mt-2 flex flex-col gap-1">
        {allUsers.map((u) => {
          const on = subscribed.has(u.id);
          return (
            <li key={u.id}>
              <form action={setReportRecipient}>
                <input
                  type="hidden"
                  name="dealership_id"
                  value={dealershipId}
                />
                <input type="hidden" name="profile_id" value={u.id} />
                <input
                  type="hidden"
                  name="subscribed"
                  value={(!on).toString()}
                />
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 rounded px-1 py-1 text-left text-sm hover:bg-zinc-50 dark:hover:bg-white/[0.03]"
                >
                  <span
                    aria-hidden
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${
                      on
                        ? "border-blue-600 btn-primary"
                        : "border-zinc-300 dark:border-zinc-600"
                    }`}
                  >
                    {on ? "✓" : ""}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {u.fullName ? (
                      <span className="font-medium">{u.fullName} </span>
                    ) : null}
                    <span className="text-zinc-500">{u.email}</span>
                  </span>
                  <span className="sr-only">
                    {on ? "Stop emailing" : "Email"} {u.email} the daily report
                    for this store
                  </span>
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function StoreRoleSelect({
  dealershipId,
  userId,
  role,
}: {
  dealershipId: string;
  userId: string;
  role: DealershipRole;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [value, setValue] = useState<DealershipRole>(role);
  useEffect(() => setValue(role), [role]);
  return (
    <form ref={formRef} action={setMembership} className="inline-flex">
      <input type="hidden" name="user_id" value={userId} />
      <input type="hidden" name="dealership_id" value={dealershipId} />
      <select
        name="role"
        value={value}
        onChange={(e) => {
          setValue(e.target.value as DealershipRole);
          formRef.current?.requestSubmit();
        }}
        className={selectClass}
        aria-label="Role"
      >
        <option value="editor">Editor</option>
        <option value="viewer">Viewer</option>
      </select>
    </form>
  );
}
