import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { sharedCookieOptions } from "@/lib/supabase/cookie-options";

// Reachable without a session.
const PUBLIC_PATHS = ["/login", "/forgot-password"];

// Pointless once you are signed in, so signed-in visitors get sent to the
// dashboard. Kept separate from PUBLIC_PATHS: the two lists happen to match
// today, but "may be seen signed out" and "may only be seen signed out" are
// different questions, and conflating them is what broke the Launchpad's
// emailed links.
const SIGNED_OUT_ONLY = ["/login", "/forgot-password"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: sharedCookieOptions,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: do not add logic between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const matches = (paths: string[]) =>
    paths.some((path) => request.nextUrl.pathname.startsWith(path));

  if (!user && !matches(PUBLIC_PATHS)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (user && matches(SIGNED_OUT_ONLY)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)",
  ],
};
