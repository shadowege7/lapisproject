"use client";

import { useActionState, useState } from "react";
import { inviteAndAssign } from "./actions";
import { INITIAL_INVITE_RESULT } from "./invite-types";

const inputClass =
  "rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700";

export function InviteForm({
  dealerships,
  positions,
}: {
  dealerships: { id: string; name: string }[];
  positions: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(
    inviteAndAssign,
    INITIAL_INVITE_RESULT,
  );

  // The primary store is tracked so it can be dropped from the "also give
  // access to" list — you don't grant a second membership to the same store.
  const [primary, setPrimary] = useState(dealerships[0]?.id ?? "");
  const others = dealerships.filter((d) => d.id !== primary);

  return (
    <div className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Email
            <input type="email" name="email" required className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            First name
            <input type="text" name="first_name" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Preferred name
            <input
              type="text"
              name="preferred_name"
              placeholder="Optional"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Last name
            <input type="text" name="last_name" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Main store
            <select
              name="dealership_id"
              required
              value={primary}
              onChange={(e) => setPrimary(e.target.value)}
              className={inputClass}
            >
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
          <label className="flex flex-col gap-1 text-sm font-medium">
            Position
            <select name="position_id" defaultValue="" className={inputClass}>
              <option value="">— None —</option>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {others.length > 0 ? (
          <fieldset className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            <legend className="px-1 text-xs font-medium text-zinc-500">
              Also give access to (optional)
            </legend>
            <div className="mt-1 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {others.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <label className="flex flex-1 items-center gap-2">
                    <input
                      type="checkbox"
                      name="extra_dealership_id"
                      value={d.id}
                      className="h-4 w-4"
                    />
                    <span className="min-w-0 truncate">{d.name}</span>
                  </label>
                  <select
                    name={`extra_role_${d.id}`}
                    defaultValue="viewer"
                    aria-label={`Role at ${d.name}`}
                    className="rounded-md border border-zinc-300 bg-transparent px-1.5 py-1 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700"
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
              ))}
            </div>
          </fieldset>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="w-fit rounded-md btn-primary px-3 py-2 text-sm font-semibold shadow-sm transition-colors disabled:opacity-60"
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
        No email is sent. The user is created with a starter password, shown
        once below — share it securely. Preferred name is what they get called
        around the business; leave it blank to use their first name.
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
        Shown only once. Share it securely with {email} — it&apos;s their login
        password.
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
