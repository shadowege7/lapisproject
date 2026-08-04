"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createResetClient } from "@/lib/supabase/reset-client";

function safeNextPath(next: string | null): string {
  // Only allow internal, single-slash-rooted paths. Reject protocol-relative
  // ("//host") and backslash tricks ("/\host", which browsers normalize to
  // "//host") that would let `next` redirect off-site.
  if (
    !next ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.includes("\\")
  ) {
    return "/dashboard";
  }
  return next;
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? ""));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(
      `/login?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`,
    );
  }

  redirect(next);
}

/**
 * Emails a password reset link.
 *
 * Always reports success, even for an address with no account — otherwise this
 * form becomes a way to find out who works here.
 *
 * The link itself lands on the Launchpad, not here: Supabase has one Site URL
 * for the project, and both apps share the project. That is fine — the session
 * cookie is shared across dealerhaven.app, so setting a password there signs
 * them in here too.
 */
export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (email) {
    // Not the ssr client: it forces PKCE, and a PKCE link only works in the
    // browser that requested it. People read email on their phones.
    const { error } = await createResetClient().auth.resetPasswordForEmail(
      email,
    );

    if (error) {
      // Logged rather than shown, so the response is identical either way.
      console.error("[forgot-password] could not send", {
        status: error.status,
        code: error.code,
        message: error.message,
      });
    }
  }

  redirect("/forgot-password?sent=1");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
