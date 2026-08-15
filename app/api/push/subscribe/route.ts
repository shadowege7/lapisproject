import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Same-origin endpoint the service worker calls when a push subscription
 * rotates (`pushsubscriptionchange`), and a fallback re-save path. It mirrors
 * the `savePushSubscription` server action: authenticate with the session
 * cookie the SW forwards, then upsert on `endpoint` with the service-role
 * client.
 *
 * This route authenticates itself and returns 401 when there is no session
 * rather than relying on the proxy — `/api/push` is allowed through the proxy
 * (see proxy.ts) so the SW gets a JSON 401 it can swallow instead of an HTML
 * login redirect.
 */
export async function POST(request: NextRequest) {
  let body: {
    endpoint?: unknown;
    p256dh?: unknown;
    auth?: unknown;
    userAgent?: unknown;
    oldEndpoint?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  const p256dh = typeof body.p256dh === "string" ? body.p256dh : "";
  const auth = typeof body.auth === "string" ? body.auth : "";
  const userAgent =
    typeof body.userAgent === "string" ? body.userAgent : null;
  const oldEndpoint =
    typeof body.oldEndpoint === "string" ? body.oldEndpoint : null;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { error: "Missing subscription fields." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      user_agent: userAgent,
    },
    { onConflict: "endpoint" },
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // When the browser rotated an existing subscription, drop the stale row so a
  // dead endpoint isn't left behind for this user.
  if (oldEndpoint && oldEndpoint !== endpoint) {
    await admin
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", oldEndpoint)
      .eq("user_id", user.id);
  }

  return NextResponse.json({ ok: true });
}
