"use client";

import { useActionState } from "react";
import { sendTestEmail } from "./actions";
import { INITIAL_TEST_EMAIL_RESULT } from "./invite-types";

const inputClass =
  "rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700";

export function EmailTestForm({ defaultEmail }: { defaultEmail: string }) {
  const [state, formAction, pending] = useActionState(
    sendTestEmail,
    INITIAL_TEST_EMAIL_RESULT,
  );

  return (
    <div className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Send to
          <input
            type="email"
            name="email"
            required
            defaultValue={defaultEmail}
            className={inputClass}
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md btn-primary px-3 py-2 text-sm font-semibold shadow-sm transition-colors disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send test email"}
        </button>
      </form>

      {state.status === "error" ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          Couldn&apos;t send: {state.message}
        </p>
      ) : null}

      {state.status === "sent" ? (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          Triggered a password-reset email to {state.email} through your
          Supabase SMTP. Check that inbox (and spam) within a couple of minutes.
          If it never arrives, the SMTP settings need attention.
        </p>
      ) : null}

      <p className="text-xs text-zinc-500">
        This sends a real Supabase “reset your password” email through the SMTP
        you set under Supabase → Authentication. Use an address that already has
        an account (like your own) — you can ignore the reset link. Supabase
        rate-limits these, so wait a minute between tries.
      </p>
    </div>
  );
}
