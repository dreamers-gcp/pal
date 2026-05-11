/**
 * Minimal RFC-4180-style CSV parsing (quoted fields, escaped quotes).
 */

function parseCsvGrid(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let i = 0;
  let inQuotes = false;
  const s = text.replace(/^\uFEFF/, "");

  while (i < s.length) {
    const c = s[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          cur += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cur += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(cur);
      cur = "";
      i++;
      continue;
    }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(cur);
      cur = "";
      if (row.some((x) => x.length > 0)) result.push(row);
      row = [];
      i++;
      continue;
    }
    cur += c;
    i++;
  }
  row.push(cur);
  if (row.some((x) => x.length > 0)) result.push(row);
  return result;
}

function uniquifyHeaders(raw: string[]): string[] {
  const seen = new Map<string, number>();
  return raw.map((h, idx) => {
    const base = (h.trim() || `Column ${idx + 1}`).replace(/\s+/g, " ");
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base} (${n})`;
  });
}

export type CsvDataset = {
  headers: string[];
  rows: Record<string, string>[];
};

export function parseCsvDataset(text: string): CsvDataset {
  const grid = parseCsvGrid(text.trim());
  if (grid.length === 0) return { headers: [], rows: [] };
  const headers = uniquifyHeaders(grid[0]);
  const width = headers.length;
  const rows: Record<string, string>[] = [];
  for (let r = 1; r < grid.length; r++) {
    const cells = grid[r];
    if (!cells.some((c) => c.trim() !== "")) continue;
    const o: Record<string, string> = {};
    for (let c = 0; c < width; c++) {
      o[headers[c]!] = (cells[c] ?? "").trim();
    }
    rows.push(o);
  }
  return { headers, rows };
}
