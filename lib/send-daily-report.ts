import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendMail, isMailConfigured, type MailResult } from "@/lib/email";
import { buildDailyReport, type ReportFigures } from "@/lib/daily-report";

/**
 * Emails a store's daily numbers to whoever an admin subscribed.
 *
 * Uses the admin client on purpose. The recipient list and the addresses on it
 * belong to other people, and the person saving the entry is usually a plain
 * editor who cannot read either under RLS — but they are allowed to *trigger*
 * a send. The list is never shown to them, only used.
 *
 * Never throws. It is called after the entry is already saved, and a mail
 * problem must not turn a successful save into an error page.
 */
export async function sendDailyReport(
  dealershipId: string,
  figures: Omit<ReportFigures, "storeName" | "tracksSprinters" | "appUrl">,
): Promise<MailResult> {
  try {
    if (!isMailConfigured()) return { sent: false, reason: "SMTP not configured" };

    const admin = createAdminClient();

    const [{ data: store }, { data: subscriptions }] = await Promise.all([
      admin
        .from("dealerships")
        .select("name, tracks_sprinters")
        .eq("id", dealershipId)
        .single(),
      admin
        .from("daily_report_recipients")
        .select("profile_id")
        .eq("dealership_id", dealershipId),
    ]);

    if (!store) return { sent: false, reason: "store not found" };
    if (!subscriptions?.length) return { sent: false, reason: "no recipients" };

    const { data: people } = await admin
      .from("profiles")
      .select("email, is_active")
      .in(
        "id",
        subscriptions.map((s) => s.profile_id),
      );

    // is_active is the Launchpad's "has this person left" flag on the shared
    // profile row. Someone offboarded should stop receiving store mail even if
    // nobody remembered to take them off this list.
    const to = (people ?? [])
      .filter((p) => p.is_active !== false && p.email)
      .map((p) => p.email);

    if (to.length === 0) return { sent: false, reason: "no active recipients" };

    const mail = buildDailyReport({
      ...figures,
      storeName: store.name,
      tracksSprinters: store.tracks_sprinters,
      appUrl: appUrl(),
    });

    return await sendMail({ ...mail, to });
  } catch (error) {
    console.error("[daily-report] could not send", {
      dealershipId,
      message: error instanceof Error ? error.message : String(error),
    });
    return { sent: false, reason: "unexpected error" };
  }
}

/** Absolute base for links and images in the mail. */
function appUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  // Vercel sets this per deployment; it is the preview URL on previews, which
  // is the right thing for a preview to link to.
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "https://lapisreport.dealerhaven.app";
}
