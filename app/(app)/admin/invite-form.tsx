"use client";

import { useActionState, useState } from "react";
import { inviteAndAssign } from "./actions";
import { INITIAL_INVITE_RESULT } from "./invite-types";

const inputClass =
  "rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700";

export function InviteForm({
  dealerships,
}: {
  dealerships: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(
    inviteAndAssign,
    INITIAL_INVITE_RESULT,
  );

  return (
    <div className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Email
          <input type="email" name="email" required className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Full name (optional)
          <input type="text" name="full_name" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Dealership
          <select name="dealership_id" required className={inputClass}>
            {dealerships.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Role
          <select name="role" defaultValue="viewer" className={inputClass}>
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create & assign"}
        </button>
      </form>

      {state.status === "error" ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.message}
        </p>
      ) : null}

      {state.status === "assigned" ? (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          {state.message}
        </p>
      ) : null}

      {state.status === "created" ? (
        <CredentialCard
          email={state.email}
          tempPassword={state.tempPassword}
        />
      ) : null}

      <p className="text-xs text-zinc-500">
        No email is sent. A new user is created with a temporary password shown
        once below — share it securely; they can change it after signing in.
      </p>
    </div>
  );
}

function CredentialCard({
  email,
  tempPassword,
}: {
  email: string;
  tempPassword: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(
        `Email: ${email}\nTemporary password: ${tempPassword}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/40">
      <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
        Account created — copy these now
      </p>
      <p className="mt-1 text-xs text-blue-800/80 dark:text-blue-300/80">
        This password is shown only once. Give it to {email} so they can sign
        in and change it.
      </p>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-zinc-500">Email</dt>
        <dd className="font-mono">{email}</dd>
        <dt className="text-zinc-500">Temp password</dt>
        <dd className="font-mono font-semibold tracking-wide">
          {tempPassword}
        </dd>
      </dl>
      <button
        type="button"
        onClick={copy}
        className="mt-3 rounded-md border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-transparent dark:text-blue-300 dark:hover:bg-blue-900/40"
      >
        {copied ? "Copied ✓" : "Copy credentials"}
      </button>
    </div>
  );
}
