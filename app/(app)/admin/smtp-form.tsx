import { saveSmtpSettings, sendTestReportEmail } from "./actions";
import type { SmtpSummary } from "@/lib/smtp-settings";

const inputClass =
  "rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700";

/**
 * The mail server the daily store reports send through.
 *
 * A server component with plain form actions: it works without JavaScript, and
 * the outcome comes back as a banner rather than needing client state.
 *
 * The saved password is never sent to this page — only whether one exists.
 * Leaving the field blank keeps it, so an admin can fix a typo in the host
 * without re-entering the secret.
 */
export function SmtpForm({
  settings,
  defaultTestEmail,
  saved,
  tested,
  error,
}: {
  settings: SmtpSummary;
  defaultTestEmail: string;
  saved: boolean;
  tested: string | null;
  error: string | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-zinc-500">
        Used for the daily store reports. Anything that speaks SMTP works — the
        Google Workspace relay, or a provider like Resend. Saved here, so it can
        be changed without a redeploy.
      </p>

      {settings.source === "environment" ? (
        <p className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
          Currently using the settings from the deployment&apos;s environment
          variables. Saving here overrides them.
        </p>
      ) : null}

      {settings.source === "unset" ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          No mail server is set up, so no reports are being sent.
        </p>
      ) : null}

      {/* Shown whenever anything has been saved, including after it was
          cleared: if these settings change unexpectedly, the first useful
          question is who touched them and when. */}
      {settings.updatedAt ? (
        <p className="text-xs text-zinc-500">
          Last changed{settings.updatedBy ? ` by ${settings.updatedBy}` : ""} on{" "}
          {new Date(settings.updatedAt).toLocaleString("en-US", {
            timeZone: "America/Los_Angeles",
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}{" "}
          PT
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
        >
          {error}
        </p>
      ) : null}
      {saved ? (
        <p
          role="status"
          className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300"
        >
          Saved. Send yourself a test below to be sure it works.
        </p>
      ) : null}
      {tested ? (
        <p
          role="status"
          className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300"
        >
          Sent to {tested}. If it doesn&apos;t arrive, check the junk folder
          before changing anything.
        </p>
      ) : null}

      <form action={saveSmtpSettings} className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
            Host
            <input
              type="text"
              name="host"
              required
              defaultValue={settings.host}
              placeholder="smtp-relay.gmail.com"
              className={inputClass}
            />
          </label>
          <label className="flex w-24 flex-col gap-1 text-sm font-medium">
            Port
            <input
              type="number"
              name="port"
              min={1}
              max={65535}
              required
              defaultValue={settings.port}
              className={inputClass}
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
            Username
            <input
              type="text"
              name="username"
              required
              defaultValue={settings.username}
              placeholder="reports@lapis.com"
              className={inputClass}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
            Password
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              placeholder={
                settings.hasPassword ? "Saved — leave blank to keep" : "Required"
              }
              className={inputClass}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm font-medium">
          From address
          <input
            type="text"
            name="mail_from"
            defaultValue={settings.from}
            placeholder="Lapis Sales Tracker <reports@lapis.com>"
            className={inputClass}
          />
          <span className="text-xs font-normal text-zinc-500">
            Optional. Defaults to the username.
          </span>
        </label>

        <div>
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            Save mail settings
          </button>
        </div>
      </form>

      <form
        action={sendTestReportEmail}
        className="flex flex-wrap items-end gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800"
      >
        <label className="flex flex-col gap-1 text-sm font-medium">
          Send a test to
          <input
            type="email"
            name="email"
            required
            defaultValue={defaultTestEmail}
            className={inputClass}
          />
        </label>
        <button
          type="submit"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-semibold hover:border-blue-400 hover:text-blue-700 dark:border-zinc-700 dark:hover:text-blue-400"
        >
          Send test
        </button>
      </form>
    </div>
  );
}
