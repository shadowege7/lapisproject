import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

let configured = false;

function configure(): boolean {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@lapisauto.com";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

/**
 * Send a push notification about a store's daily entry to every user who
 * (a) has notifications enabled by an admin, and (b) has access to that store
 * (a member of it, or a super admin), excluding the person who saved it.
 * Never throws — notification failures must not break saving an entry.
 */
export async function notifyStoreEntry(opts: {
  dealershipId: string;
  title: string;
  body: string;
  excludeUserId?: string;
}): Promise<void> {
  try {
    if (!configure()) return;
    const admin = createAdminClient();

    const { data: notifProfiles } = await admin
      .from("profiles")
      .select("id, is_super_admin")
      .eq("notifications_enabled", true);
    if (!notifProfiles || notifProfiles.length === 0) return;

    const { data: memberRows } = await admin
      .from("dealership_members")
      .select("user_id")
      .eq("dealership_id", opts.dealershipId);
    const memberIds = new Set((memberRows ?? []).map((m) => m.user_id));

    const targetIds = notifProfiles
      .filter(
        (p) =>
          p.id !== opts.excludeUserId &&
          (p.is_super_admin || memberIds.has(p.id)),
      )
      .map((p) => p.id);
    if (targetIds.length === 0) return;

    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in("user_id", targetIds);
    if (!subs || subs.length === 0) return;

    const payload = JSON.stringify({
      title: opts.title,
      body: opts.body,
      url: "/dashboard",
      tag: `store-${opts.dealershipId}`,
    });

    await Promise.allSettled(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: s.endpoint,
              keys: { p256dh: s.p256dh, auth: s.auth },
            },
            payload,
          );
        } catch (err: unknown) {
          const code = (err as { statusCode?: number })?.statusCode;
          if (code === 404 || code === 410) {
            // Subscription gone — clean it up.
            await admin.from("push_subscriptions").delete().eq("id", s.id);
          }
        }
      }),
    );
  } catch {
    // Swallow — notifications are best-effort.
  }
}
