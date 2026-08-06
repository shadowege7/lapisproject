"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  changeUserEmail,
  setBudgetAccess,
  deleteUser,
  resetUserPassword,
  setMainStore,
  setMembership,
  setNotifications,
  setSuperAdmin,
  setUserPosition,
  unassignStore,
} from "./actions";
import { ConfirmButton } from "./confirm-button";
import { INITIAL_RESET_RESULT } from "./invite-types";
import type { DealershipRole } from "@/lib/database.types";

interface StoreMembership {
  dealershipId: string;
  role: DealershipRole;
}

const selectClass =
  "rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700";

/**
 * Collapsed by default: shows just the user's name + email. Expanding reveals
 * super-admin / reset / delete actions and per-store editor/viewer access.
 */
export function UserRow({
  userId,
  email,
  fullName,
  isSelf,
  isSuperAdmin,
  canEditBudgets,
  notificationsEnabled,
  positionId,
  positions,
  mainDealershipId,
  lastSignInLabel,
  memberships,
  dealerships,
}: {
  userId: string;
  email: string;
  fullName: string | null;
  isSelf: boolean;
  isSuperAdmin: boolean;
  canEditBudgets: boolean;
  notificationsEnabled: boolean;
  positionId: string | null;
  positions: { id: string; name: string }[];
  mainDealershipId: string | null;
  lastSignInLabel: string;
  memberships: StoreMembership[];
  dealerships: { id: string; name: string }[];
}) {
  const [resetState, resetAction] = useActionState(
    resetUserPassword,
    INITIAL_RESET_RESULT,
  );

  const nameById = new Map(dealerships.map((d) => [d.id, d.name]));
  const assignedIds = new Set(memberships.map((m) => m.dealershipId));
  const available = dealerships.filter((d) => !assignedIds.has(d.id));
  const positionName = positions.find((p) => p.id === positionId)?.name ?? null;
  const hasAllStores =
    isSuperAdmin ||
    (dealerships.length > 0 && memberships.length === dealerships.length);

  return (
    <details className="group rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[var(--surface)]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block truncate">
            {fullName ? <span className="font-medium">{fullName} </span> : null}
            <span className={fullName ? "text-zinc-500" : "font-medium"}>
              {email}
            </span>
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {positionName ? (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {positionName}
              </span>
            ) : null}
            {isSuperAdmin ? (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                super admin
              </span>
            ) : null}
            {notificationsEnabled ? (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                notified
              </span>
            ) : null}
            {canEditBudgets && !isSuperAdmin ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                budgets
              </span>
            ) : null}
            {isSelf ? <span className="text-xs text-zinc-400">(you)</span> : null}
            <span className="text-xs text-zinc-400">
              {memberships.length} store{memberships.length === 1 ? "" : "s"}
            </span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span
            className="whitespace-nowrap text-xs text-zinc-400"
            title="Last sign-in"
          >
            {lastSignInLabel}
          </span>
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

      <div className="flex flex-col gap-3 border-t border-zinc-100 p-4 dark:border-zinc-800">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <form action={setSuperAdmin}>
            <input type="hidden" name="user_id" value={userId} />
            <input
              type="hidden"
              name="is_super_admin"
              value={(!isSuperAdmin).toString()}
            />
            <button
              type="submit"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              {isSuperAdmin ? "Revoke super admin" : "Make super admin"}
            </button>
          </form>

          <form action={setNotifications}>
            <input type="hidden" name="user_id" value={userId} />
            <input
              type="hidden"
              name="notifications_enabled"
              value={(!notificationsEnabled).toString()}
            />
            <button
              type="submit"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              {notificationsEnabled
                ? "Turn off notifications"
                : "Turn on notifications"}
            </button>
          </form>

          {/* Super admins already have it, so offering the toggle there
              would suggest it could be taken away, which it cannot. */}
          {isSuperAdmin ? null : (
            <form action={setBudgetAccess}>
              <input type="hidden" name="user_id" value={userId} />
              <input
                type="hidden"
                name="can_edit_budgets"
                value={(!canEditBudgets).toString()}
              />
              <button
                type="submit"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                {canEditBudgets
                  ? "Revoke budget editing"
                  : "Allow budget editing"}
              </button>
            </form>
          )}

          <form action={resetAction}>
            <input type="hidden" name="user_id" value={userId} />
            <button
              type="submit"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              Reset password
            </button>
          </form>

          {isSelf ? null : (
            <form action={deleteUser}>
              <input type="hidden" name="user_id" value={userId} />
              <ConfirmButton
                message={`Permanently delete ${email}? This removes their account and all dealership access. This cannot be undone.`}
                className="text-red-600 hover:underline dark:text-red-400"
              >
                Remove user
              </ConfirmButton>
            </form>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-zinc-500">Position</span>
          <PositionSelect
            userId={userId}
            positionId={positionId}
            positions={positions}
          />
        </div>

        <EmailField userId={userId} email={email} />

        {resetState.status === "reset" ? (
          <TempPassword password={resetState.tempPassword} email={email} />
        ) : null}
        {resetState.status === "error" ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {resetState.message}
          </p>
        ) : null}

        <div className="rounded-lg border border-zinc-100 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-white/[0.02]">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Store access
          </p>

          {hasAllStores ? (
            <div className="mb-2 flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-zinc-500">Main store</span>
                <MainStoreSelect
                  userId={userId}
                  mainDealershipId={mainDealershipId}
                  dealerships={dealerships}
                />
              </div>
              <p className="text-xs text-zinc-400">
                Pinned first on their dashboard, and scopes notifications: set a
                main store to notify only for it, or leave “None” to notify for
                all stores.
              </p>
            </div>
          ) : null}

          {isSuperAdmin ? (
            <p className="mb-2 text-xs text-zinc-500">
              Super admins can view and edit every store regardless of the
              assignments below.
            </p>
          ) : null}

          {memberships.length === 0 ? (
            <p className="text-sm text-zinc-500">No stores assigned.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {memberships.map((m) => (
                <li
                  key={m.dealershipId}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
                >
                  <span className="min-w-40 flex-1">
                    {nameById.get(m.dealershipId) ?? m.dealershipId}
                  </span>
                  <RoleSelect
                    userId={userId}
                    dealershipId={m.dealershipId}
                    role={m.role}
                  />
                  <form action={unassignStore}>
                    <input type="hidden" name="user_id" value={userId} />
                    <input
                      type="hidden"
                      name="dealership_id"
                      value={m.dealershipId}
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

          {available.length > 0 ? (
            <form
              action={setMembership}
              className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800"
            >
              <input type="hidden" name="user_id" value={userId} />
              <span className="text-xs text-zinc-500">Add to store:</span>
              <select name="dealership_id" required className={selectClass}>
                {available.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <select name="role" defaultValue="viewer" className={selectClass}>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                type="submit"
                className="rounded-md bg-blue-600 px-3 py-1 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Add
              </button>
            </form>
          ) : (
            <p className="mt-2 text-xs text-zinc-400">Assigned to all stores.</p>
          )}
        </div>
      </div>
    </details>
  );
}

/**
 * Changing the address a user signs in with.
 *
 * A <details> and a plain form action rather than client state: it keeps
 * working without JavaScript, and the outcome comes back as a banner at the
 * top of the page instead of needing state threaded through this row.
 * Collapsed because this is their identity for both apps, and an input
 * pre-filled with the current address is one stray keystroke from an
 * accidental edit.
 */
function EmailField({ userId, email }: { userId: string; email: string }) {
  return (
    <details className="group text-sm">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 [&::-webkit-details-marker]:hidden">
        <span className="text-zinc-500">Sign-in email</span>
        <span className="font-mono text-xs">{email}</span>
        <span className="text-blue-600 group-open:hidden dark:text-blue-400">
          Change
        </span>
      </summary>

      <form
        action={changeUserEmail}
        className="mt-2 flex flex-wrap items-center gap-2"
      >
        <input type="hidden" name="user_id" value={userId} />
        <label className="sr-only" htmlFor={`email-${userId}`}>
          Sign-in email
        </label>
        <input
          id={`email-${userId}`}
          name="email"
          type="email"
          defaultValue={email}
          required
          className="min-w-56 rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700"
        />
        <button
          type="submit"
          className="rounded-md bg-blue-600 px-3 py-1 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Save
        </button>
      </form>

      <p className="mt-1 text-xs text-zinc-400">
        This is what they sign in with, on the Launchpad as well as here. The
        change takes effect immediately — no confirmation email is sent, so tell
        them.
      </p>
    </details>
  );
}

function RoleSelect({
  userId,
  dealershipId,
  role,
}: {
  userId: string;
  dealershipId: string;
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

function PositionSelect({
  userId,
  positionId,
  positions,
}: {
  userId: string;
  positionId: string | null;
  positions: { id: string; name: string }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [value, setValue] = useState(positionId ?? "");
  useEffect(() => setValue(positionId ?? ""), [positionId]);
  return (
    <form ref={formRef} action={setUserPosition} className="inline-flex">
      <input type="hidden" name="user_id" value={userId} />
      <select
        name="position_id"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          formRef.current?.requestSubmit();
        }}
        className={selectClass}
        aria-label="Position"
      >
        <option value="">— None —</option>
        {positions.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </form>
  );
}

function MainStoreSelect({
  userId,
  mainDealershipId,
  dealerships,
}: {
  userId: string;
  mainDealershipId: string | null;
  dealerships: { id: string; name: string }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [value, setValue] = useState(mainDealershipId ?? "");
  useEffect(() => setValue(mainDealershipId ?? ""), [mainDealershipId]);
  return (
    <form ref={formRef} action={setMainStore} className="inline-flex">
      <input type="hidden" name="user_id" value={userId} />
      <select
        name="dealership_id"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          formRef.current?.requestSubmit();
        }}
        className={selectClass}
        aria-label="Main store"
      >
        <option value="">— None —</option>
        {dealerships.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
    </form>
  );
}

function TempPassword({
  password,
  email,
}: {
  password: string;
  email: string;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        `Email: ${email}\nTemporary password: ${password}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/40">
      <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
        New temporary password — shown once
      </p>
      <p className="mt-1 font-mono text-sm font-semibold tracking-wide">
        {password}
      </p>
      <button
        type="button"
        onClick={copy}
        className="mt-2 rounded-md border border-blue-300 bg-white px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-transparent dark:text-blue-300 dark:hover:bg-blue-900/40"
      >
        {copied ? "Copied ✓" : "Copy credentials"}
      </button>
    </div>
  );
}
