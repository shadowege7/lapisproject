import { formatCurrency } from "@/lib/format";
import { APP_NAME } from "@/app/brand";
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

/**
 * The month-to-date context that mirrors the dashboard tile's This month /
 * Budget / Projected columns. Computed at send time (see send-daily-report).
 * Gross figures lead Today and This month; Budget and Projected are unit counts,
 * exactly as on the dashboard.
 */
export interface MonthlyFigures {
  mtdGross: number;
  mtdNewUnits: number;
  mtdUsedUnits: number;
  mtdSprinterUnits: number;
  /** Budgeted unit counts for the month, or null when no budget is set. */
  budget: { newUnits: number; usedUnits: number; sprinterUnits: number } | null;
  /** Month-end projection of each unit count at the current pace. */
  projNewUnits: number;
  projUsedUnits: number;
  projSprinterUnits: number;
}

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
  salesCalls: number;
  appointments: number;
  notes: string | null;
  enteredBy: string | null;
  /** This-month context mirroring the dashboard tile. Null when it could not be
   *  computed, so the email still sends with just the day's numbers. */
  monthly: MonthlyFigures | null;
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

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * "2026-08-05" as "August 5, 2026", or "Aug 5, 2026" for the subject line.
 *
 * Split by hand rather than through `new Date`. An entry date is a calendar
 * day, not an instant: `new Date("2026-08-05")` is midnight *UTC*, which
 * formats as the 4th anywhere west of Greenwich — so every report would name
 * the wrong day for the people reading it.
 */
function formatEntryDate(iso: string, style: "long" | "short"): string {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!parts) return iso;

  const [, year, month, day] = parts;
  const name = MONTHS[Number(month) - 1] ?? month;
  return `${style === "short" ? name.slice(0, 3) : name} ${Number(day)}, ${year}`;
}

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

  // The dashboard, not this store's reports: most readers are on more than
  // one store's list, and the dashboard shows all of them at once.
  //
  // Not "/dealerships" — that path has no page behind it, only
  // /dealerships/[id], and linking there sent everyone to a 404.
  // Signed-out readers are sent to /login and returned here afterwards.
  const link = `${f.appUrl}/dashboard`;
  const day = formatEntryDate(f.entryDate, "long");
  const shortDay = formatEntryDate(f.entryDate, "short");
  const totalUnits = rows.reduce((s, r) => s + r.units, 0);
  const totalGross = rows.reduce((s, r) => s + r.front + r.back, 0);

  const subject = `${f.storeName} — ${shortDay}: ${totalUnits} ${
    totalUnits === 1 ? "unit" : "units"
  }, ${formatCurrency(totalGross)} gross`;

  // The dashboard tile's This month / Budget / Projected context. Gross leads
  // Today and This month; Budget and Projected are unit counts — same as the
  // tile. Rendered only when it could be computed (f.monthly non-null).
  const m = f.monthly;
  const unitsLine = (n: number, used: number, sprinter: number) =>
    [`${n} new`, `${used} used`, ...(f.tracksSprinters ? [`${sprinter} Sprinter`] : [])].join(
      " · ",
    );
  const budgetUnits = m?.budget
    ? m.budget.newUnits +
      m.budget.usedUnits +
      (f.tracksSprinters ? m.budget.sprinterUnits : 0)
    : 0;
  const projUnits = m
    ? m.projNewUnits + m.projUsedUnits + (f.tracksSprinters ? m.projSprinterUnits : 0)
    : 0;
  const monthLabel = `${MONTHS[Number(f.entryDate.slice(5, 7)) - 1] ?? ""} ${f.entryDate.slice(
    0,
    4,
  )}`.trim();

  const text = [
    `${f.storeName}`,
    `${f.isNew ? "Numbers for" : "Updated numbers for"} ${day}`,
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
    `Sales calls: ${f.salesCalls}`,
    `Appointments: ${f.appointments}`,
    ...(m
      ? [
          "",
          `This month (${monthLabel})`,
          `This month: ${
            m.mtdNewUnits + m.mtdUsedUnits + m.mtdSprinterUnits
          } units · ${formatCurrency(m.mtdGross)} gross · ${unitsLine(
            m.mtdNewUnits,
            m.mtdUsedUnits,
            m.mtdSprinterUnits,
          )}`,
          m.budget
            ? `Budget: ${budgetUnits} units · ${unitsLine(
                m.budget.newUnits,
                m.budget.usedUnits,
                m.budget.sprinterUnits,
              )}`
            : "Budget: not set",
          `Projected: ${projUnits} units · ${unitsLine(
            m.projNewUnits,
            m.projUsedUnits,
            m.projSprinterUnits,
          )}`,
        ]
      : []),
    ...(f.notes ? ["", `Notes: ${f.notes}`] : []),
    ...(f.enteredBy ? ["", `Entered by ${f.enteredBy}`] : []),
    "",
    link,
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
    ["Sales calls", f.salesCalls],
    ["Appointments", f.appointments],
  ]
    .map(
      ([label, value]) => `
        <td width="50%" align="center" style="padding:10px 4px;">
          <div style="font-size:20px;font-weight:bold;color:#0f172a;">${value}</div>
          <div style="font-size:11px;color:#64748b;">${label}</div>
        </td>`,
    )
    .join("");

  const statCell = (label: string, value: string, sub: string) => `
        <td width="50%" valign="top" style="padding:12px 14px;border:1px solid #e2e8f0;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;">${label}</div>
          <div style="margin-top:2px;font-size:18px;font-weight:bold;color:#0f172a;">${value}</div>
          <div style="margin-top:2px;font-size:12px;color:#64748b;">${sub || "&nbsp;"}</div>
        </td>`;

  // Colour each projected count against its budget, exactly as the dashboard's
  // PaceUnits does: green when it's on pace to meet or beat the budget, red when
  // it's behind, neutral when that category has no budget. Inline colour so it
  // survives every mail client. Only the projected breakdown is coloured; the
  // big total stays neutral, matching the tile.
  const paceColor = (projected: number, budget: number) =>
    budget > 0
      ? projected >= budget
        ? "color:#047857;font-weight:bold;"
        : "color:#dc2626;font-weight:bold;"
      : "";
  const pacedCount = (projected: number, budget: number, name: string) =>
    `<span style="white-space:nowrap;${paceColor(projected, budget)}">${projected} ${name}</span>`;
  const pacedProjLine = m
    ? [
        pacedCount(m.projNewUnits, m.budget?.newUnits ?? 0, "new"),
        pacedCount(m.projUsedUnits, m.budget?.usedUnits ?? 0, "used"),
        ...(f.tracksSprinters
          ? [pacedCount(m.projSprinterUnits, m.budget?.sprinterUnits ?? 0, "Sprinter")]
          : []),
      ].join(" · ")
    : "";

  const monthlyHtml = m
    ? `
        <tr>
          <td style="padding:20px 28px 0;">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin:0 0 8px;">This month · ${escape(
              monthLabel,
            )}</div>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
              <tr>
                ${statCell(
                  "Today",
                  formatCurrency(totalGross),
                  unitsLine(f.newUnits, f.usedUnits, f.sprinterUnits),
                )}
                ${statCell(
                  "This month",
                  formatCurrency(m.mtdGross),
                  unitsLine(m.mtdNewUnits, m.mtdUsedUnits, m.mtdSprinterUnits),
                )}
              </tr>
              <tr>
                ${statCell(
                  "Budget",
                  m.budget ? `${budgetUnits} units` : "Not set",
                  m.budget
                    ? unitsLine(
                        m.budget.newUnits,
                        m.budget.usedUnits,
                        m.budget.sprinterUnits,
                      )
                    : "",
                )}
                ${statCell("Projected", `${projUnits} units`, pacedProjLine)}
              </tr>
            </table>
          </td>
        </tr>`
    : "";

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
              ${f.isNew ? "Numbers for" : "Updated numbers for"} ${escape(day)}
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

        ${monthlyHtml}

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
            <a href="${link}"
               style="background:#1d4ed8;color:#ffffff;text-decoration:none;padding:11px 24px;border-radius:6px;font-size:14px;font-weight:bold;display:inline-block;">
              Open the ${APP_NAME}
            </a>
          </td>
        </tr>

        <tr>
          <td align="center" bgcolor="${FOOTER_BG}" style="background:${FOOTER_BG};background-color:${FOOTER_BG};border-top:1px solid #dfe3ea;padding:20px;">
            <img src="${ASSETS}/lapis-wordmark.png"
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
