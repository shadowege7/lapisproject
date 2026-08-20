import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendMail, isMailConfigured, type MailResult } from "@/lib/email";
import {
  buildDailyReport,
  type MonthlyFigures,
  type ReportFigures,
} from "@/lib/daily-report";
import { projectMonthEnd } from "@/lib/projection";
import { monthStartISODate, todayISODate } from "@/lib/format";

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
  figures: Omit<
    ReportFigures,
    "storeName" | "tracksSprinters" | "appUrl" | "monthly"
  >,
): Promise<MailResult> {
  try {
    if (!(await isMailConfigured())) {
      return { sent: false, reason: "no mail server configured" };
    }

    const admin = createAdminClient();
    const month = monthStartISODate();

    const [
      { data: store },
      { data: subscriptions },
      { data: summary },
      { data: budget },
      { data: todayRow },
    ] = await Promise.all([
      admin
        .from("dealerships")
        .select("name, tracks_sprinters")
        .eq("id", dealershipId)
        .single(),
      admin
        .from("daily_report_recipients")
        .select("profile_id")
        .eq("dealership_id", dealershipId),
      // Month-to-date rollup for the This month figures — includes the entry
      // just saved, since it's a view over daily_entries.
      admin
        .from("monthly_summary")
        .select(
          "total_new_units, total_used_units, total_sprinter_units, total_gross",
        )
        .eq("dealership_id", dealershipId)
        .eq("month", month)
        .maybeSingle(),
      admin
        .from("store_budgets")
        .select("new_units, used_units, sprinter_units")
        .eq("dealership_id", dealershipId)
        .eq("month", month)
        .maybeSingle(),
      // Whether today's (PT) entry is in — the projection divisor, exactly as
      // the dashboard computes it. Independent of which day this report is for.
      admin
        .from("daily_entries")
        .select("dealership_id")
        .eq("dealership_id", dealershipId)
        .eq("entry_date", todayISODate())
        .maybeSingle(),
    ]);

    if (!store) return { sent: false, reason: "store not found" };
    if (!subscriptions?.length) return { sent: false, reason: "no recipients" };

    // The This month / Budget / Projected block that mirrors the dashboard tile.
    const todayLogged = !!todayRow;
    const monthly: MonthlyFigures = {
      mtdGross: summary?.total_gross ?? 0,
      mtdNewUnits: summary?.total_new_units ?? 0,
      mtdUsedUnits: summary?.total_used_units ?? 0,
      mtdSprinterUnits: summary?.total_sprinter_units ?? 0,
      budget: budget
        ? {
            newUnits: budget.new_units,
            usedUnits: budget.used_units,
            sprinterUnits: budget.sprinter_units,
          }
        : null,
      projNewUnits: Math.round(
        projectMonthEnd(summary?.total_new_units ?? 0, todayLogged),
      ),
      projUsedUnits: Math.round(
        projectMonthEnd(summary?.total_used_units ?? 0, todayLogged),
      ),
      projSprinterUnits: Math.round(
        projectMonthEnd(summary?.total_sprinter_units ?? 0, todayLogged),
      ),
    };

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
      monthly,
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
