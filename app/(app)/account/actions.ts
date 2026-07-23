"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updateOwnPassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (password.length < 8) {
    redirect(
      `/account?error=${encodeURIComponent("Password must be at least 8 characters.")}`,
    );
  }
  if (password !== confirm) {
    redirect(
      `/account?error=${encodeURIComponent("The two passwords do not match.")}`,
    );
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    redirect(`/account?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/account?updated=1");
}
