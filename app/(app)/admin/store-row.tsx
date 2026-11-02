"use client";

import { useEffect, useRef, useState } from "react";
import {
  deleteStore,
  setMembership,
  setReportRecipient,
  setSalespersonTracking,
  setStoreArchived,
  setStoreOrder,
  setStoreSuperAdminOnly,
  unassignStore,
} from "./actions";
import { ConfirmButton } from "./confirm-button";
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
  sortOrder,
  tracksSalespeople,
  superAdminOnly,
  members,
  allUsers,
  subscribedIds,
  mailConfigured,
}: {
  dealershipId: string;
  name: string;
  /** Position among the dashboard cards; null means "not placed". */
  sortOrder: number | null;
  /** Editors here enter numbers per salesperson. */
  tracksSalespeople: boolean;
  /** Only super admins can see this store. */
  superAdminOnly: boolean;
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
        <span className="flex min-w-0 items-center gap-3">
          <OrderBox dealershipId={dealershipId} sortOrder={sortOrder} />
          <span className="truncate font-medium">{name}</span>
        </span>
        <span className="flex items-center gap-2 text-xs text-zinc-500">
          {superAdminOnly ? (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              Super admins only
            </span>
          ) : null}
          {tracksSalespeople ? (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              Salespeople
            </span>
          ) : null}
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

        <SwitchRow
          action={setSalespersonTracking}
          field="tracks_salespeople"
          dealershipId={dealershipId}
          name={name}
          enabled={tracksSalespeople}
          label="Track individual salespeople"
          on="On. This store's editors enter numbers per salesperson and manage the roster from Dealership Insights. Turning it off hides it; nothing is deleted."
          off="Off. Turn on to let this store's editors enter numbers per salesperson. Viewers see the results on Dealership Insights."
        />

        <SwitchRow
          action={setStoreSuperAdminOnly}
          field="super_admin_only"
          dealershipId={dealershipId}
          name={name}
          enabled={superAdminOnly}
          label="Super admins only"
          on="On. Only super admins can see this store, enter its numbers or get its emails and notifications. Its members get no access, and it stays out of the company totals."
          off="Off. Everyone assigned to this store can see it. Turn on for a test store, or one that isn't open yet."
        />

        <ReportRecipients
          dealershipId={dealershipId}
          allUsers={allUsers}
          subscribedIds={subscribedIds}
          mailConfigured={mailConfigured}
          superAdminOnly={superAdminOnly}
        />

        {available.length > 0 ? (
          <form
            action={setMembership}
            className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800"
          >
            <input type="hidden" name="dealership_id" value={dealershipId} />
            <span className="text-xs text-zinc-500">Add user:</span>
            <select name="user_id" required aria-label={`Add a user to ${name}`} className={selectClass}>
              {available.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName ? `${u.fullName} — ${u.email}` : u.email}
                </option>
              ))}
            </select>
            <select name="role" defaultValue="viewer" aria-label={`Role for the new member of ${name}`} className={selectClass}>
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

        <StoreDangerZone dealershipId={dealershipId} name={name} />
      </div>
    </details>
  );
}

/**
 * An archived store: out of every daily view, its numbers kept. Restore puts
 * it back as it was; Delete removes it for good.
 */
export function ArchivedStoreRow({
  dealershipId,
  name,
  archivedAt,
}: {
  dealershipId: string;
  name: string;
  archivedAt: string;
}) {
  return (
    <li className="rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-[var(--surface)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{name}</p>
          <p className="text-xs text-zinc-500">
            Archived {new Date(archivedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles" })}
            {" · "}
            <a
              href={`/dealerships/${dealershipId}/reports`}
              className="underline underline-offset-2 hover:text-zinc-900 dark:hover:text-white"
            >
              View its numbers
            </a>
          </p>
        </div>
        <form action={setStoreArchived}>
          <input type="hidden" name="dealership_id" value={dealershipId} />
          <input type="hidden" name="archive" value="false" />
          <button
            type="submit"
            className="min-h-9 rounded-md border border-zinc-300 px-3 text-sm font-semibold text-zinc-700 hover:border-blue-400 hover:text-blue-700 dark:border-zinc-700 dark:text-zinc-200 dark:hover:text-blue-400"
          >
            Restore
          </button>
        </form>
      </div>
      <DeleteStore dealershipId={dealershipId} name={name} />
    </li>
  );
}

/** Archive and Delete, at the bottom of an open store's panel. */
function StoreDangerZone({ dealershipId, name }: { dealershipId: string; name: string }) {
  return (
    <div className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">Archive store</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            For a store that has closed or been sold. It disappears from the
            dashboard, entry and Insights for everyone, and its members lose
            access. Every number is kept, and you can restore it any time.
          </p>
        </div>
        <form action={setStoreArchived}>
          <input type="hidden" name="dealership_id" value={dealershipId} />
          <input type="hidden" name="archive" value="true" />
          <ConfirmButton
            message={`Archive ${name}? It will be hidden from everyone's dashboard and its members will lose access. Its numbers are kept, and you can restore it from the Archived list.`}
            className="min-h-9 shrink-0 rounded-md border border-zinc-300 px-3 text-sm font-semibold text-zinc-700 hover:border-blue-400 hover:text-blue-700 dark:border-zinc-700 dark:text-zinc-200 dark:hover:text-blue-400"
          >
            Archive
          </ConfirmButton>
        </form>
      </div>
      <DeleteStore dealershipId={dealershipId} name={name} />
    </div>
  );
}

/**
 * Permanent delete. Collapsed by default, and the button stays disabled until
 * the store's name is typed exactly — the server checks the same thing.
 */
function DeleteStore({ dealershipId, name }: { dealershipId: string; name: string }) {
  const [typed, setTyped] = useState("");
  const matches = typed.trim() === name.trim();
  return (
    <details className="mt-3">
      <summary className="inline-flex cursor-pointer list-none items-center text-sm font-medium text-red-700 hover:underline dark:text-red-400 [&::-webkit-details-marker]:hidden">
        Delete store…
      </summary>
      <form
        action={deleteStore}
        className="mt-2 flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-950/30"
      >
        <input type="hidden" name="dealership_id" value={dealershipId} />
        <p className="text-xs text-red-800 dark:text-red-200">
          This permanently deletes <strong>{name}</strong> and everything it
          logged: every day of numbers, budgets, salespeople, who has access,
          and its report emails. It can&apos;t be undone. If the store has
          closed, archive it instead.
        </p>
        <label className="flex flex-col gap-1 text-xs font-medium text-red-800 dark:text-red-200">
          Type <span className="font-mono">{name}</span> to confirm
          <input
            name="confirm_name"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            className="rounded-md border border-red-300 bg-white px-2.5 py-2 text-base text-zinc-900 outline-none focus:ring-2 focus:ring-red-500/30 sm:text-sm dark:border-red-900 dark:bg-transparent dark:text-zinc-50"
          />
        </label>
        <button
          type="submit"
          disabled={!matches}
          className="min-h-9 w-fit rounded-md bg-red-600 px-3 text-sm font-semibold text-white enabled:hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Delete permanently
        </button>
      </form>
    </details>
  );
}

/**
 * The store's position among the dashboard cards.
 *
 * Saves on blur and on Enter, so there is no button to forget — the same
 * pattern as the role dropdowns and the report checkboxes. It sits inside the
 * <summary>, so every click has to be stopped from reaching it: a click on a
 * summary toggles the panel open, and typing a number should not do that.
 *
 * Leaving the box empty clears the position rather than storing zero, which is
 * what sends an unplaced store to the end of the dashboard instead of the top.
 */
function OrderBox({
  dealershipId,
  sortOrder,
}: {
  dealershipId: string;
  sortOrder: number | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const saved = sortOrder === null ? "" : String(sortOrder);

  return (
    <form
      ref={formRef}
      action={setStoreOrder}
      onClick={(event) => event.stopPropagation()}
      className="shrink-0"
    >
      <input type="hidden" name="dealership_id" value={dealershipId} />
      <input
        type="number"
        name="sort_order"
        min={1}
        step={1}
        defaultValue={saved}
        aria-label={`Dashboard position for ${dealershipId}`}
        title="Position on the dashboard. Leave empty to send this store to the end."
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            (event.target as HTMLInputElement).blur();
          }
        }}
        onBlur={(event) => {
          // Only when it actually changed, so opening and closing the panel
          // does not fire a write per store.
          if (event.target.value !== saved) formRef.current?.requestSubmit();
        }}
        className="w-12 rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-center font-mono text-xs tabular-nums outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700"
      />
    </form>
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
  superAdminOnly,
}: {
  dealershipId: string;
  allUsers: { id: string; email: string; fullName: string | null }[];
  subscribedIds: string[];
  mailConfigured: boolean;
  superAdminOnly: boolean;
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

      {superAdminOnly ? (
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          This store is super admins only, so only the super admins ticked
          here get its email. Everyone else stays on the list and starts
          receiving it again if the store is opened up.
        </p>
      ) : null}

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
        aria-label="Member role"
      >
        <option value="editor">Editor</option>
        <option value="viewer">Viewer</option>
      </select>
    </form>
  );
}

/**
 * A per-store on/off setting. Saves on click, like the report checkboxes — the
 * button submits the opposite of the current state.
 */
function SwitchRow({
  action,
  field,
  dealershipId,
  name,
  enabled,
  label,
  on,
  off,
}: {
  action: (formData: FormData) => Promise<void>;
  field: string;
  dealershipId: string;
  name: string;
  enabled: boolean;
  label: string;
  on: string;
  off: string;
}) {
  const labelId = `${field}-${dealershipId}`;
  return (
    <form
      action={action}
      className="mt-3 flex items-start justify-between gap-4 border-t border-zinc-100 pt-3 dark:border-zinc-800"
    >
      <input type="hidden" name="dealership_id" value={dealershipId} />
      <input type="hidden" name={field} value={(!enabled).toString()} />
      <div className="min-w-0">
        <p id={labelId} className="text-sm font-medium">
          {label}
        </p>
        <p className="mt-0.5 text-xs text-zinc-500">{enabled ? on : off}</p>
      </div>
      <button
        type="submit"
        role="switch"
        aria-checked={enabled}
        aria-labelledby={labelId}
        title={`${enabled ? "Turn off" : "Turn on"} “${label}” for ${name}`}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${
          enabled
            ? "btn-primary border-transparent"
            : "border-zinc-300 bg-transparent dark:border-zinc-600"
        }`}
      >
        <span
          aria-hidden
          className={`inline-block h-4 w-4 rounded-full transition-transform ${
            enabled
              ? "translate-x-6 bg-white dark:bg-[var(--surface)]"
              : "translate-x-1 bg-zinc-400"
          }`}
        />
      </button>
    </form>
  );
}
