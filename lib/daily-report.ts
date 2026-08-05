import { formatCurrency } from "@/lib/format";
import type { Mail } from "@/lib/email";

/**
 * The day's numbers, as an email.
 *
 * Table layout and inline CSS for the same reason the auth templates use them:
 * mail clients strip <style> blocks and do not support flexbox or grid. This
 * is not how the app is written.
 *
 * Every figure is repeated in the plain-text part, because a good number of
 * people read mail with images and HTML off, and a report that arrives blank
 * is worse than no report.
 */

export interface ReportFigures {
  storeName: string;
  entryDate: string;
  isNew: boolean;
  tracksSprinters: boolean;
  newUnits: number;
  newFront: number;
  newBack: number;
  usedUnits: number;
  usedFront: number;
  usedBack: number;
  sprinterUnits: number;
  sprinterFront: number;
  sprinterBack: number;
  managerCalls: number;
  salesCalls: number;
  appointments: number;
  confirmedAppointments: number;
  notes: string | null;
  enteredBy: string | null;
  /** Absolute base for the images and the link back into the app. */
  appUrl: string;
}

/** Where the branding images live. They are served by the Launchpad. */
const ASSETS = "https://lapis.dealerhaven.app";

/** Pantone 296 C, the Lapis navy. Same value the apps use. */
const NAVY = "#041e42";

/**
 * The footer sits on near-white because the logo is dark navy artwork — on a
 * dark panel it all but disappears. Its text is dark enough to read there.
 */
const FOOTER_BG = "#f1f3f6";
// Slate-700 rather than the lighter grey that reads fine at normal sizes: this
// text is 11px, and a mid grey on near-white only just clears the readability
// threshold. This is comfortably past it.
const FOOTER_TEXT = "#334155";

/**
 * The footer note. These are unpublished trading figures for a private
 * business, so the footer says what the reader is holding rather than
 * explaining how they came to be on the list.
 */
const CONFIDENTIALITY =
  "Confidential — internal Lapis Automotive Group figures, not for " +
  "distribution. If this reached you in error, please delete it.";

const escape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

interface Category {
  label: string;
  units: number;
  front: number;
  back: number;
}

function categories(f: ReportFigures): Category[] {
  return [
    { label: "New", units: f.newUnits, front: f.newFront, back: f.newBack },
    { label: "Used", units: f.usedUnits, front: f.usedFront, back: f.usedBack },
    ...(f.tracksSprinters
      ? [
          {
            label: "Sprinter",
            units: f.sprinterUnits,
            front: f.sprinterFront,
            back: f.sprinterBack,
          },
        ]
      : []),
  ];
}

export function buildDailyReport(f: ReportFigures): Omit<Mail, "to"> {
  const rows = categories(f);
  const totalUnits = rows.reduce((s, r) => s + r.units, 0);
  const totalGross = rows.reduce((s, r) => s + r.front + r.back, 0);

  const subject = `${f.storeName} — ${f.entryDate}: ${totalUnits} ${
    totalUnits === 1 ? "unit" : "units"
  }, ${formatCurrency(totalGross)} gross`;

  const text = [
    `${f.storeName}`,
    `${f.isNew ? "Numbers for" : "Updated numbers for"} ${f.entryDate}`,
    "",
    ...rows.map(
      (r) =>
        `${r.label}: ${r.units} units · front ${formatCurrency(r.front)} · back ${formatCurrency(
          r.back,
        )} · gross ${formatCurrency(r.front + r.back)}`,
    ),
    "",
    `Total: ${totalUnits} units · ${formatCurrency(totalGross)} gross`,
    "",
    `Manager calls: ${f.managerCalls}`,
    `Sales calls: ${f.salesCalls}`,
    `Appointments: ${f.appointments} (${f.confirmedAppointments} confirmed)`,
    ...(f.notes ? ["", `Notes: ${f.notes}`] : []),
    ...(f.enteredBy ? ["", `Entered by ${f.enteredBy}`] : []),
    "",
    `${f.appUrl}/dealerships`,
    "",
    CONFIDENTIALITY,
  ].join("\n");

  const cell = "padding:8px 10px;border-bottom:1px solid #dbeafe;font-size:14px;";
  const head =
    "padding:8px 10px;border-bottom:1px solid #dbeafe;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;text-align:right;";

  const body = rows
    .map(
      (r) => `
        <tr>
          <td style="${cell}font-weight:bold;">${r.label}</td>
          <td style="${cell}text-align:right;">${r.units}</td>
          <td style="${cell}text-align:right;">${formatCurrency(r.front)}</td>
          <td style="${cell}text-align:right;">${formatCurrency(r.back)}</td>
          <td style="${cell}text-align:right;font-weight:bold;">${formatCurrency(
            r.front + r.back,
          )}</td>
        </tr>`,
    )
    .join("");

  const activity = [
    ["Manager calls", f.managerCalls],
    ["Sales calls", f.salesCalls],
    ["Appointments", f.appointments],
    ["Confirmed", f.confirmedAppointments],
  ]
    .map(
      ([label, value]) => `
        <td width="25%" align="center" style="padding:10px 4px;">
          <div style="font-size:20px;font-weight:bold;color:#0f172a;">${value}</div>
          <div style="font-size:11px;color:#64748b;">${label}</div>
        </td>`,
    )
    .join("");

  // A whole document rather than a fragment, so the colour-scheme hints below
  // can live in <head>. Without them a mail client in dark mode inverts the
  // card: the white body turns dark and the navy logo vanishes into the
  // footer, which is exactly the problem this palette is meant to solve.
  // Honoured by Apple Mail and Outlook; Gmail on Android still forces its own,
  // so nothing here depends on it.
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<style>
  :root { color-scheme: light only; supported-color-schemes: light only; }
</style>
</head>
<body style="margin:0;padding:0;background:#f4f7fc;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f7fc;margin:0;padding:32px 12px;font-family:Arial,Helvetica,sans-serif;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #dbeafe;">

        <tr>
          <td align="center" bgcolor="${NAVY}" style="background:${NAVY};background-color:${NAVY};padding:24px;">
            <img src="${ASSETS}/Lapis-Platinum-Emblem.png"
                 alt="Lapis Automotive Group"
                 width="48"
                 style="display:block;width:48px;max-width:48px;height:auto;border:0;outline:none;text-decoration:none;">
          </td>
        </tr>

        <tr>
          <td style="padding:28px 28px 4px;color:#0f172a;">
            <h1 style="margin:0 0 4px;font-size:20px;line-height:28px;">${escape(
              f.storeName,
            )}</h1>
            <p style="margin:0 0 20px;color:#64748b;font-size:14px;">
              ${f.isNew ? "Numbers for" : "Updated numbers for"} ${escape(f.entryDate)}
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:0 28px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
              <tr>
                <td style="${head}text-align:left;">&nbsp;</td>
                <td style="${head}">Units</td>
                <td style="${head}">Front</td>
                <td style="${head}">Back</td>
                <td style="${head}">Gross</td>
              </tr>
              ${body}
              <tr>
                <td style="${cell}font-weight:bold;border-bottom:none;">Total</td>
                <td style="${cell}text-align:right;font-weight:bold;border-bottom:none;">${totalUnits}</td>
                <td style="${cell}border-bottom:none;"></td>
                <td style="${cell}border-bottom:none;"></td>
                <td style="${cell}text-align:right;font-weight:bold;color:#1d4ed8;border-bottom:none;">${formatCurrency(
                  totalGross,
                )}</td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:16px 28px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f7fc;border-radius:10px;">
              <tr>${activity}</tr>
            </table>
          </td>
        </tr>

        ${
          f.notes
            ? `<tr>
          <td style="padding:16px 28px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;">
              <tr><td style="padding:12px 14px;">
                <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#b45309;">Notes</div>
                <div style="margin-top:4px;font-size:14px;color:#0f172a;white-space:pre-wrap;">${escape(
                  f.notes,
                )}</div>
              </td></tr>
            </table>
          </td>
        </tr>`
            : ""
        }

        <tr>
          <td align="center" style="padding:24px 28px;">
            <a href="${f.appUrl}/dealerships"
               style="background:#1d4ed8;color:#ffffff;text-decoration:none;padding:11px 24px;border-radius:6px;font-size:14px;font-weight:bold;display:inline-block;">
              Open the Sales Tracker
            </a>
          </td>
        </tr>

        <tr>
          <td align="center" bgcolor="${FOOTER_BG}" style="background:${FOOTER_BG};background-color:${FOOTER_BG};border-top:1px solid #dfe3ea;padding:20px;">
            <img src="${ASSETS}/lapis-logo.png"
                 alt="Lapis Automotive Group"
                 width="150"
                 style="display:block;width:150px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;">
            <p style="margin:12px 0 0;color:${FOOTER_TEXT};font-size:11px;line-height:17px;">
              ${f.enteredBy ? `Entered by ${escape(f.enteredBy)}.<br>` : ""}
              ${CONFIDENTIALITY}
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`.trim();

  return { subject, html, text };
}
