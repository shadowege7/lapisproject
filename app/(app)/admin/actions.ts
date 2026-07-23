"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DealershipRole } from "@/lib/database.types";
import type { InviteResult } from "./invite-types";

// Readable temp password, e.g. "X7kM-pQ2r-Tw9y" (no ambiguous chars).
function generateTempPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i++) {
    out += alphabet[bytes[i] % alphabet.length];
    if (i % 4 === 3 && i < 11) out += "-";
  }
  return out;
}

async function requireSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_super_admin) redirect("/dashboard");

  return supabase;
}

export async function createDealership(formData: FormData) {
  const supabase = await requireSuperAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await supabase.from("dealerships").insert({ name });
  revalidatePath("/admin");
}

export async function inviteAndAssign(
  _prevState: InviteResult,
  formData: FormData,
): Promise<InviteResult> {
  await requireSuperAdmin();

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const dealershipId = String(formData.get("dealership_id") ?? "");
  const role = String(formData.get("role") ?? "viewer") as DealershipRole;

  if (!email || !dealershipId) {
    return { status: "error", message: "Email and dealership are required." };
  }

  const admin = createAdminClient();

  const { data: existingList, error: listError } =
    await admin.auth.admin.listUsers();
  if (listError) {
    return { status: "error", message: listError.message };
  }

  const existing = existingList?.users.find(
    (u) => u.email?.toLowerCase() === email,
  );
  let userId = existing?.id;
  let tempPassword: string | null = null;

  if (!userId) {
    // No email delivery: create the account directly with a temporary
    // password (email pre-confirmed so they can sign in immediately).
    tempPassword = generateTempPassword();
    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: fullName ? { full_name: fullName } : undefined,
      });
    if (createError) {
      return { status: "error", message: createError.message };
    }
    userId = created.user?.id;
  }

  if (!userId) {
    return { status: "error", message: "Could not create the user." };
  }

  const supabase = await createClient();
  const { error: memberError } = await supabase
    .from("dealership_members")
    .upsert(
      { dealership_id: dealershipId, user_id: userId, role },
      { onConflict: "dealership_id,user_id" },
    );
  if (memberError) {
    return { status: "error", message: memberError.message };
  }

  revalidatePath("/admin");

  if (tempPassword) {
    return { status: "created", email, tempPassword };
  }
  return {
    status: "assigned",
    message: `${email} already had an account — assigned to the dealership.`,
  };
}

export async function removeMembership(formData: FormData) {
  const supabase = await requireSuperAdmin();
  const membershipId = String(formData.get("membership_id") ?? "");
  if (!membershipId) return;

  await supabase.from("dealership_members").delete().eq("id", membershipId);
  revalidatePath("/admin");
}

export async function deleteUser(formData: FormData) {
  const supabase = await requireSuperAdmin();
  const userId = String(formData.get("user_id") ?? "");
  if (!userId) return;

  // Never let an admin delete their own account (would lock them out).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.id === userId) return;

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw error;

  // profiles + dealership_members cascade; daily_entries.created_by is set null.
  revalidatePath("/admin");
}

export async function setSuperAdmin(formData: FormData) {
  const supabase = await requireSuperAdmin();
  const userId = String(formData.get("user_id") ?? "");
  const isSuperAdmin = formData.get("is_super_admin") === "true";
  if (!userId) return;

  await supabase
    .from("profiles")
    .update({ is_super_admin: isSuperAdmin })
    .eq("id", userId);
  revalidatePath("/admin");
}
