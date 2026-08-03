import type { CookieOptions } from "@supabase/ssr";

/**
 * Scopes the Supabase auth cookie to a parent domain so this app and the Lapis
 * Launchpad share one session.
 *
 * Cookies are scoped by host, so two apps on `lapisreport.example.app` and
 * `lapis.example.app` only see the same session if the cookie is written for
 * `.example.app`. **Both apps must set the same value** — they already share a
 * Supabase project, so the cookie name matches; the domain is the missing
 * half. If they disagree, each writes its own cookie and signing into one
 * silently does nothing for the other.
 *
 * Left unset locally on purpose. On `localhost` cookies are shared across
 * ports anyway, and a domain of `.example.app` would never be sent — which
 * looks exactly like being signed out.
 *
 * Set NEXT_PUBLIC_COOKIE_DOMAIN in the deployed environments only.
 */
const domain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN?.trim();

export const sharedCookieOptions: CookieOptions | undefined = domain
  ? { domain }
  : undefined;
