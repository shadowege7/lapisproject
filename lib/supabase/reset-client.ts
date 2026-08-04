import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * A client used only to *start* a password reset.
 *
 * Deliberately not the `@supabase/ssr` server client. That one hardcodes
 * `flowType: "pkce"` after spreading your options, so it cannot be overridden,
 * and `resetPasswordForEmail` then attaches a code challenge. The resulting
 * link carries a `pkce_` token that is only redeemable in the browser that
 * started the flow, because the matching verifier is stored there.
 *
 * That is wrong for a reset: an admin sends it from here, and the recipient
 * opens it on their own phone. Starting without PKCE produces a plain token
 * the Launchpad's /auth/confirm can verify from anywhere.
 *
 * Anon key, no session persistence — this never signs anyone in.
 */
export function createResetClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: "implicit",
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
