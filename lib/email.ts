import "server-only";

import { getSmtpConfig, type SmtpConfig } from "@/lib/smtp-settings";

/**
 * Outbound email for the daily report.
 *
 * Deliberately plain SMTP rather than a provider SDK: the business already
 * relays auth mail through Google Workspace, and the same credentials work
 * here. Anything that speaks SMTP — a Workspace relay, Resend, Postmark — is a
 * change of settings, never a change of code.
 *
 * Settings come from the admin page, falling back to SMTP_* environment
 * variables. With neither, sending is skipped and logged rather than throwing.
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

export async function isMailConfigured(): Promise<boolean> {
  return (await getSmtpConfig()) !== null;
}

export async function sendMail(
  mail: Mail,
  /** Pass a config to test one that has not been saved yet. */
  override?: SmtpConfig,
): Promise<MailResult> {
  if (mail.to.length === 0) return { sent: false, reason: "no recipients" };

  const config = override ?? (await getSmtpConfig());
  if (!config) return { sent: false, reason: "no mail server configured" };

  // Imported here rather than at module scope so the (sizeable) mail library
  // is only loaded on the requests that actually send.
  const nodemailer = (await import("nodemailer")).default;

  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    // 465 is implicit TLS; 587 starts plaintext and upgrades with STARTTLS.
    secure: config.port === 465,
    auth: { user: config.username, pass: config.password },
  });

  try {
    await transport.sendMail({
      from: config.from,
      // Recipients go in bcc so nobody's address is exposed to the rest of
      // the list, and so the list itself is not published to every reader.
      to: config.from,
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
      host: config.host,
      source: config.source,
      message: error instanceof Error ? error.message : String(error),
    });
    return {
      sent: false,
      reason: error instanceof Error ? error.message : "send failed",
    };
  }
}
