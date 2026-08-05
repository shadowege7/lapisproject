/**
 * How a person's name is assembled from its parts.
 *
 * A copy of the Launchpad's `lib/names.ts`. The two apps share the `profiles`
 * table but not a module, so this has to agree with the other copy — if you
 * change the rule here, change it there.
 *
 * `full_name` is the display name of record: this app reads it everywhere, and
 * it predates the parts. So it is composed on every write rather than being a
 * separate thing anyone types.
 */

export interface NameParts {
  first_name?: string | null;
  preferred_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
}

/**
 * The name to store and show. Preferred name wins over first name: someone who
 * goes by Kate should be shown as Kate, not Katherine.
 *
 * Falls back to whatever `full_name` already held, so rows written before the
 * parts existed keep their name instead of going blank.
 */
export function composeFullName(parts: NameParts): string | null {
  const given = parts.preferred_name?.trim() || parts.first_name?.trim() || "";
  const family = parts.last_name?.trim() || "";
  const composed = [given, family].filter(Boolean).join(" ");
  return composed || parts.full_name?.trim() || null;
}
