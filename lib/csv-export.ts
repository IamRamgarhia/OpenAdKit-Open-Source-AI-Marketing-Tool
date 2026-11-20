import type { GeneratedAd } from "./storage";

/**
 * CSV helpers for the History export.
 *
 * Two problems with the old inline exporter:
 *  - It dropped `output_text`, i.e. the generated copy — the one column
 *    anyone exporting history actually wants.
 *  - Cells were written verbatim, so a title or note starting with `=`, `+`,
 *    `-`, `@`, tab or CR became a live formula when the file was opened in
 *    Excel / Sheets (CSV / formula injection, OWASP). Such cells are now
 *    prefixed with a single quote, which spreadsheets render as text.
 */

const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

/** Escape one CSV cell: neutralise formula triggers, quote, double inner quotes. */
export function csvCell(value: unknown): string {
  let s = value == null ? "" : String(value);
  if (FORMULA_TRIGGER.test(s)) s = "'" + s;
  // Normalise line endings; embedded newlines are legal inside a quoted cell.
  s = s.replace(/\r\n?/g, "\n");
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\r\n");
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export const HISTORY_CSV_HEADERS = [
  "id",
  "platform",
  "campaign_type",
  "status",
  "starred",
  "title",
  "model",
  "input_tokens",
  "output_tokens",
  "cost_usd",
  "created_at",
  "notes",
  "output_text",
];

export function historyToCsv(ads: GeneratedAd[]): string {
  const rows = ads.map((a) => [
    a.id,
    a.platform,
    a.campaign_type,
    a.status,
    a.starred,
    a.title,
    a.model_id,
    num(a.usage_input_tokens),
    num(a.usage_output_tokens),
    num(a.cost_usd).toFixed(6),
    new Date(num(a.created_at)).toISOString(),
    a.notes,
    a.output_text,
  ]);
  return toCsv(HISTORY_CSV_HEADERS, rows);
}
