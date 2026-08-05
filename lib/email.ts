import "server-only";

/**
 * Outbound email for the daily report.
 *
 * Deliberately plain SMTP rather than a provider SDK: the business already
 * relays auth mail through Google Workspace, and the same credentials work
 * here. Anything that speaks SMTP — a Workspace relay, Resend, Postmark — is a
 * matter of four environment variables, with no code change.
 *
 *   SMTP_HOST      smtp-relay.gmail.com
 *   SMTP_PORT      587
 *   SMTP_USER      the mailbox or relay account to authenticate as
 *   SMTP_PASSWORD  its password, or a Google app password
 *   SMTP_FROM      "Lapis Sales Tracker <reports@lapis.com>"  (optional)
 *
 * With none of them set, sending is skipped and logged rather than throwing.
 * That matters: the report goes out on the same request that saves the day's
 * numbers, and a missing mail server must never lose someone's entry.
 */

export interface Mail {
  to: string[];
  subject: string;
  html: string;
  text: string;
}

export type MailResult =
  | { sent: true; count: number }
  | { sent: false; reason: string };

export function isMailConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD,
  );
}

export async function sendMail(mail: Mail): Promise<MailResult> {
  if (mail.to.length === 0) return { sent: false, reason: "no recipients" };
  if (!isMailConfigured()) return { sent: false, reason: "SMTP not configured" };

  // Imported here rather than at module scope so the dependency is only
  // loaded on the requests that actually send.
  const nodemailer = (await import("nodemailer")).default;

  const port = Number(process.env.SMTP_PORT ?? 587);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // 465 is implicit TLS; 587 starts plaintext and upgrades with STARTTLS.
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASSWORD!,
    },
  });

  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER!,
      // Recipients go in bcc so nobody's address is exposed to the rest of
      // the list, and so the list itself is not published to every reader.
      to: process.env.SMTP_FROM ?? process.env.SMTP_USER!,
      bcc: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
    return { sent: true, count: mail.to.length };
  } catch (error) {
    // Logged rather than thrown: see the note at the top about not losing an
    // entry because a mail server is down.
    console.error("[daily-report] send failed", {
      recipients: mail.to.length,
      message: error instanceof Error ? error.message : String(error),
    });
    return {
      sent: false,
      reason: error instanceof Error ? error.message : "send failed",
    };
  }
}
