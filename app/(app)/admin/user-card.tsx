"use client";

import { useActionState, useRef, useState } from "react";
import {
  deleteUser,
  resetUserPassword,
  setMembership,
  setSuperAdmin,
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

export function UserCard({
  userId,
  email,
  isSelf,
  isSuperAdmin,
  memberships,
  dealerships,
}: {
  userId: string;
  email: string;
  isSelf: boolean;
  isSuperAdmin: boolean;
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

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-[#0e1626]">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span className="font-medium">
          {email}
          {isSuperAdmin ? (
            <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
              super admin
            </span>
          ) : null}
          {isSelf ? (
            <span className="ml-2 text-xs text-zinc-400">(you)</span>
          ) : null}
        </span>

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
      </div>

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
  return (
    <form ref={formRef} action={setMembership} className="inline-flex">
      <input type="hidden" name="user_id" value={userId} />
      <input type="hidden" name="dealership_id" value={dealershipId} />
      <select
        name="role"
        defaultValue={role}
        onChange={() => formRef.current?.requestSubmit()}
        className={selectClass}
        aria-label="Role"
      >
        <option value="editor">Editor</option>
        <option value="viewer">Viewer</option>
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
