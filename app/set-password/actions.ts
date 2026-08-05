"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const MIN_LENGTH = 10;

/**
 * Replaces a temporary password with one only the user knows.
 *
 * A copy of the Launchpad's, deliberately: the two apps share an auth
 * directory and a `profiles.must_change_password` flag, so whichever one the
 * person opens first has to be able to clear it.
 */
export async function setPassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const fail = (message: string) =>
    redirect(`/set-password?error=${encodeURIComponent(message)}`);

  if (password.length < MIN_LENGTH) {
    fail(`Password must be at least ${MIN_LENGTH} characters.`);
  }
  if (password !== confirm) {
    fail("Passwords do not match.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) fail(error.message);

  // Cleared only after the password actually changed, so a failed update can
  // never unlock the app with the temporary one still live.
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", user.id);

  if (profileError) fail(profileError.message);

  redirect("/dashboard");
}
