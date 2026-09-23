/** Minimal RFC 4046-ish CSV writer — no dependency needed for this size of
 *  export. Every cell is quoted if it contains a comma, quote, or newline;
 *  embedded quotes are doubled per the CSV spec. */
function cell(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [header, ...rows].map((row) => row.map(cell).join(","));
  // Leading BOM so Excel opens UTF-8 (names/notes may have non-ASCII text)
  // without mangling it.
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export function csvResponse(filename: string, header: string[], rows: (string | number | null | undefined)[][]) {
  return new Response(toCsv(header, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
