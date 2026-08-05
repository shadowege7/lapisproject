"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, listAllUsers } from "@/lib/supabase/admin";
import { createResetClient } from "@/lib/supabase/reset-client";
import { composeFullName } from "@/lib/names";
import { generateTempPassword } from "@/lib/password";
import type { DealershipRole } from "@/lib/database.types";
import type {
  InviteResult,
  ResetResult,
  TestEmailResult,
} from "./invite-types";

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
  const firstName = String(formData.get("first_name") ?? "").trim();
  const preferredName = String(formData.get("preferred_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  // `full_name` stays the display name of record — this app reads it
  // everywhere — so it is composed from the parts rather than typed.
  const fullName =
    composeFullName({
      first_name: firstName,
      preferred_name: preferredName,
      last_name: lastName,
      // A file or form filled in before the split may still send one box.
      full_name: String(formData.get("full_name") ?? "").trim(),
    }) ?? "";
  const dealershipId = String(formData.get("dealership_id") ?? "");
  const role = String(formData.get("role") ?? "viewer") as DealershipRole;
  const positionId = String(formData.get("position_id") ?? "");

  if (!email || !dealershipId) {
    return { status: "error", message: "Email and dealership are required." };
  }

  const admin = createAdminClient();

  const { users, error: listError } = await listAllUsers();
  if (listError) {
    return { status: "error", message: listError.message };
  }

  const existing = users.find((u) => u.email?.toLowerCase() === email);
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
        user_metadata: {
          ...(fullName ? { full_name: fullName } : {}),
          // Read by the Launchpad's signup trigger into
          // profiles.must_change_password, which is what forces a real
          // password to be chosen. This app has no such gate of its own —
          // see the README.
          must_change_password: true,
        },
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

  // The parts are stored alongside the composed name, so the Launchpad can
  // greet someone by the name they actually go by. Only written for accounts
  // created here — an address that already existed keeps whatever it had
  // rather than being overwritten by boxes this admin may have left blank.
  const nameParts =
    tempPassword && (firstName || preferredName || lastName)
      ? {
          first_name: firstName || null,
          preferred_name: preferredName || null,
          last_name: lastName || null,
        }
      : {};

  if (positionId || Object.keys(nameParts).length > 0) {
    await supabase
      .from("profiles")
      .update({
        ...(positionId ? { position_id: positionId } : {}),
        ...nameParts,
      })
      .eq("id", userId);
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

/** Assign a user to a store, or change their role there (upsert). */
export async function setMembership(formData: FormData) {
  const supabase = await requireSuperAdmin();
  const userId = String(formData.get("user_id") ?? "");
  const dealershipId = String(formData.get("dealership_id") ?? "");
  const role = String(formData.get("role") ?? "viewer") as DealershipRole;
  if (!userId || !dealershipId) return;
  if (role !== "editor" && role !== "viewer") return;

  await supabase.from("dealership_members").upsert(
    { dealership_id: dealershipId, user_id: userId, role },
    { onConflict: "dealership_id,user_id" },
  );
  revalidatePath("/admin");
}

/** Remove one store assignment by user + store (used by the per-user UI). */
export async function unassignStore(formData: FormData) {
  const supabase = await requireSuperAdmin();
  const userId = String(formData.get("user_id") ?? "");
  const dealershipId = String(formData.get("dealership_id") ?? "");
  if (!userId || !dealershipId) return;

  await supabase
    .from("dealership_members")
    .delete()
    .eq("user_id", userId)
    .eq("dealership_id", dealershipId);
  revalidatePath("/admin");
}

/** Reset a user's password to a fresh temporary one (shown once to the admin). */
export async function resetUserPassword(
  _prevState: ResetResult,
  formData: FormData,
): Promise<ResetResult> {
  await requireSuperAdmin();
  const userId = String(formData.get("user_id") ?? "");
  if (!userId) return { status: "error", message: "Missing user." };

  const admin = createAdminClient();
  const tempPassword = generateTempPassword();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: tempPassword,
  });
  if (error) return { status: "error", message: error.message };

  // Send them back through the Launchpad's set-password gate, so an
  // admin-issued password is replaced by one only they know.
  await admin
    .from("profiles")
    .update({ must_change_password: true })
    .eq("id", userId);

  return { status: "reset", tempPassword };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Change the address a user signs in with.
 *
 * This is their identity for both apps — one Supabase project sits behind the
 * Launchpad and this one — so it changes in both at once.
 *
 * `email_confirm: true` applies it immediately rather than parking it as a
 * pending change awaiting a click in the old mailbox, which is the point: this
 * is used when someone's name changed or their address was wrong, and the old
 * mailbox may be unreachable. `public.profiles.email` follows via a database
 * trigger, so it cannot drift.
 */
export async function changeUserEmail(formData: FormData): Promise<void> {
  await requireSuperAdmin();

  const userId = String(formData.get("user_id") ?? "");
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  const back = (key: string, value: string) =>
    redirect(`/admin?${key}=${encodeURIComponent(value)}`);

  if (!userId) back("email_error", "Missing user.");
  if (!email) back("email_error", "Enter an email address.");
  if (!EMAIL.test(email)) {
    back("email_error", "That doesn't look like an email address.");
  }

  const admin = createAdminClient();

  // Checked up front, because Supabase does not report this usefully: the
  // underlying unique violation surfaces as a 500 whose AuthError message is
  // the string "{}" — the same empty-error shape sendTestEmail works around
  // below. profiles.email is kept in step with auth.users by a trigger, so
  // asking here gives a real answer.
  const { data: clash } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .neq("id", userId)
    .maybeSingle();

  if (clash) {
    back("email_error", "That address already belongs to another account.");
  }

  const { error } = await admin.auth.admin.updateUserById(userId, {
    email,
    email_confirm: true,
  });

  if (error) {
    // Belt and braces for the same collision, in case a profile row is
    // missing. The empty-message case is why the check above exists.
    const raw = `${error.message} ${(error as { code?: string }).code ?? ""} ${JSON.stringify(error)}`;
    const taken =
      raw.includes("23505") ||
      raw.includes("duplicate key") ||
      raw.includes("already been registered") ||
      raw.includes("email_exists");

    console.error("changeUserEmail failed:", {
      userId,
      status: (error as { status?: number }).status,
      code: (error as { code?: string }).code,
      message: error.message,
    });

    back(
      "email_error",
      taken
        ? "That address already belongs to another account."
        : error.message && error.message !== "{}"
          ? error.message
          : "Could not change the address. Check the server logs.",
    );
  }

  revalidatePath("/admin");
  back("email_changed", email);
}

/**
 * Send a real Supabase auth email (a password-recovery message) through the
 * SMTP configured in Supabase → Authentication → SMTP, so an admin can confirm
 * delivery from the webpage. The recipient must already have an account for an
 * email to be sent; the link itself can be ignored.
 */
export async function sendTestEmail(
  _prevState: TestEmailResult,
  formData: FormData,
): Promise<TestEmailResult> {
  await requireSuperAdmin();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email) return { status: "error", message: "Enter an email address." };

  // Deliberately not the ssr client used for the auth check above: it forces
  // PKCE, and a PKCE reset link is only redeemable in the browser that sent
  // it — useless for a message the recipient opens on their own device, and
  // the reason these test emails produced links that always failed.
  const { error } = await createResetClient().auth.resetPasswordForEmail(email);
  if (error) {
    // Log the full shape for Vercel → Logs; Supabase sometimes returns an
    // AuthError whose `.message` is empty ("{}") when GoTrue itself 500s on the
    // SMTP send, so build a message from whatever fields are populated.
    console.error("sendTestEmail failed:", {
      name: error.name,
      message: error.message,
      status: (error as { status?: number }).status,
      code: (error as { code?: string }).code,
      raw: JSON.stringify(error),
    });
    const status = (error as { status?: number }).status;
    const code = (error as { code?: string }).code;
    const detail =
      [
        error.message && error.message !== "{}" ? error.message : null,
        code,
        status ? `HTTP ${status}` : null,
      ]
        .filter(Boolean)
        .join(" · ") ||
      error.name ||
      "Supabase returned an empty error — check Supabase → Logs → Auth for the SMTP send error.";
    return { status: "error", message: detail };
  }

  return { status: "sent", email };
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

export async function setNotifications(formData: FormData) {
  const supabase = await requireSuperAdmin();
  const userId = String(formData.get("user_id") ?? "");
  const enabled = formData.get("notifications_enabled") === "true";
  if (!userId) return;

  await supabase
    .from("profiles")
    .update({ notifications_enabled: enabled })
    .eq("id", userId);
  revalidatePath("/admin");
}

export async function createPosition(formData: FormData) {
  const supabase = await requireSuperAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const { data: maxRow } = await supabase
    .from("positions")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort = (maxRow?.sort_order ?? 0) + 1;

  await supabase.from("positions").insert({ name, sort_order: nextSort });
  revalidatePath("/admin");
}

export async function setPositionRollup(formData: FormData) {
  const supabase = await requireSuperAdmin();
  const positionId = String(formData.get("position_id") ?? "");
  const enabled = formData.get("can_view_rollup") === "true";
  if (!positionId) return;

  await supabase
    .from("positions")
    .update({ can_view_rollup: enabled })
    .eq("id", positionId);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function deletePosition(formData: FormData) {
  const supabase = await requireSuperAdmin();
  const positionId = String(formData.get("position_id") ?? "");
  if (!positionId) return;

  await supabase.from("positions").delete().eq("id", positionId);
  revalidatePath("/admin");
}

export async function setUserPosition(formData: FormData) {
  const supabase = await requireSuperAdmin();
  const userId = String(formData.get("user_id") ?? "");
  const positionId = String(formData.get("position_id") ?? "");
  if (!userId) return;

  await supabase
    .from("profiles")
    .update({ position_id: positionId || null })
    .eq("id", userId);
  revalidatePath("/admin");
}

/** Toggle the dashboard "Leaders" section for everyone at once. */
export async function setShowLeaderboard(formData: FormData) {
  const supabase = await requireSuperAdmin();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const enabled = formData.get("show_leaderboard") === "true";

  await supabase.from("app_settings").upsert(
    {
      key: "show_leaderboard",
      value: enabled,
      updated_at: new Date().toISOString(),
      updated_by: user?.id ?? null,
    },
    { onConflict: "key" },
  );
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function setMainStore(formData: FormData) {
  const supabase = await requireSuperAdmin();
  const userId = String(formData.get("user_id") ?? "");
  const dealershipId = String(formData.get("dealership_id") ?? "");
  if (!userId) return;

  await supabase
    .from("profiles")
    .update({ main_dealership_id: dealershipId || null })
    .eq("id", userId);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}
