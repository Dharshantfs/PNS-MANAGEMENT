// Client-side CSV export - no backend involved, no library needed. Used by
// ReportsPage.tsx to let the owner download a report as a spreadsheet.

function csvCell(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  // Quote any cell containing a comma, quote, or newline; escape internal quotes.
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function downloadCsv(filename: string, columns: string[], rows: Array<Array<unknown>>): void {
  const lines = [columns.map(csvCell).join(','), ...rows.map((row) => row.map(csvCell).join(','))];
  // Leading BOM so Excel opens UTF-8 (e.g. ₹, tenant names with accents) correctly.
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
