import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Where the mail server settings come from.
 *
 * The database wins, so an admin can change the relay from the admin page
 * without a redeploy. Environment variables remain as a fallback, which keeps
 * a fresh deployment sendable before anyone has opened the settings, and gives
 * a way back in if the saved settings are ever wrong.
 *
 * Read with the admin client on purpose: `public.smtp_settings` has no RLS
 * policies and no grants to `authenticated`, so nothing a browser can reach
 * will ever return the password. See 0017 in the Launchpad repo.
 */

export interface SmtpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  from: string;
  source: "database" | "environment";
}

/** What the admin screen is allowed to know. Never includes the password. */
export interface SmtpSummary {
  host: string;
  port: number;
  username: string;
  from: string;
  hasPassword: boolean;
  source: "database" | "environment" | "unset";
  updatedAt: string | null;
}

interface Row {
  host: string | null;
  port: number | null;
  username: string | null;
  password: string | null;
  mail_from: string | null;
  updated_at: string | null;
}

async function readRow(): Promise<Row | null> {
  try {
    const { data } = await createAdminClient()
      .from("smtp_settings")
      .select("host, port, username, password, mail_from, updated_at")
      .eq("only_row", true)
      .maybeSingle();
    return data ?? null;
  } catch {
    // A missing table or an unreachable database must not take mail down with
    // it; the environment fallback below still applies.
    return null;
  }
}

function fromEnvironment(): SmtpConfig | null {
  const host = process.env.SMTP_HOST;
  const username = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  if (!host || !username || !password) return null;

  return {
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    username,
    password,
    from: process.env.SMTP_FROM || username,
    source: "environment",
  };
}

/** The settings to send with, or null when mail is not set up. */
export async function getSmtpConfig(): Promise<SmtpConfig | null> {
  const row = await readRow();

  if (row?.host && row.username && row.password) {
    return {
      host: row.host,
      port: row.port ?? 587,
      username: row.username,
      password: row.password,
      from: row.mail_from || row.username,
      source: "database",
    };
  }

  return fromEnvironment();
}

/** For the admin screen: what is configured, without the secret. */
export async function getSmtpSummary(): Promise<SmtpSummary> {
  const row = await readRow();

  if (row?.host && row.username && row.password) {
    return {
      host: row.host,
      port: row.port ?? 587,
      username: row.username,
      from: row.mail_from ?? "",
      hasPassword: true,
      source: "database",
      updatedAt: row.updated_at,
    };
  }

  const env = fromEnvironment();
  if (env) {
    return {
      host: env.host,
      port: env.port,
      username: env.username,
      from: process.env.SMTP_FROM ?? "",
      hasPassword: true,
      source: "environment",
      updatedAt: null,
    };
  }

  // Nothing usable, but show whatever half-filled values are saved so an
  // admin can see what is still missing rather than an empty form.
  return {
    host: row?.host ?? "",
    port: row?.port ?? 587,
    username: row?.username ?? "",
    from: row?.mail_from ?? "",
    hasPassword: Boolean(row?.password),
    source: "unset",
    updatedAt: row?.updated_at ?? null,
  };
}
