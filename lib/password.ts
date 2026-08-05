import { randomInt } from "node:crypto";

/**
 * Deliberately excludes look-alike characters (0/O, 1/l/I) because these
 * passwords get read aloud or copied off a screen by hand.
 *
 * Kept identical to the Launchpad's `lib/password.ts`: the two apps share an
 * auth directory, so a password issued by one is typed into the other.
 */
const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Cryptographically random temporary password for a newly created account.
 *
 * No separators. Grouping with dashes reads more easily, but people retype
 * these into a password box and the dashes get dropped, mistyped as spaces, or
 * swallowed by autofill — and the sign-in then fails for no visible reason.
 */
export function generateTempPassword(length = 14): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[randomInt(ALPHABET.length)];
  }
  return out;
}
