import { createBrowserClient } from "@supabase/ssr";
import { sharedCookieOptions } from "./cookie-options";
import type { Database } from "@/lib/database.types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // Must match the server clients: a host-scoped cookie written by the
    // browser would shadow the shared one, and the other app would see the
    // session vanish.
    { cookieOptions: sharedCookieOptions },
  );
}
