import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Service-role client for privileged operations (inviting users, listing
 * all auth users). Never import this into client components — it must
 * only be used from Server Actions / Route Handlers already gated on
 * `is_super_admin`.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

export interface AdminUser {
  id: string;
  email: string | null;
  lastSignInAt: string | null;
}

/**
 * List all auth users, resilient to the intermittent `bad_jwt` (ES256) 403s
 * we've seen from the admin API: retries a few times with short backoff, and
 * requests a large page so the list isn't silently capped at the 50/page
 * default. Returns a trimmed shape plus any final error (never throws).
 */
export async function listAllUsers(): Promise<{
  users: AdminUser[];
  error: { message: string } | null;
}> {
  const admin = createAdminClient();
  const maxAttempts = 3;
  let lastError: { message: string } | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (!error) {
      return {
        users: data.users.map((u) => ({
          id: u.id,
          email: u.email ?? null,
          lastSignInAt: u.last_sign_in_at ?? null,
        })),
        error: null,
      };
    }

    lastError = { message: error.message };
    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
    }
  }

  return { users: [], error: lastError };
}
