import { parseCsvDataset } from "@/lib/csv-parse";
import { inferFieldTypes, type FieldKind } from "@/lib/dataset-field-inference";

export type { FieldKind };
export type TabularDataset = {
  headers: string[];
  rows: Record<string, string>[];
  kinds: Record<string, FieldKind>;
};

function stringifyCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "string") return v;
  if (typeof v === "bigint") return v.toString();
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/**
 * Parse a JSON array of objects (or a single object) into a uniform tabular shape.
 */
export function parseJsonTabular(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  if (!trimmed) return { headers: [], rows: [] };
  const parsed: unknown = JSON.parse(trimmed);
  const arr: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
  const keySet = new Set<string>();
  for (const item of arr) {
    if (item !== null && typeof item === "object" && !Array.isArray(item)) {
      for (const k of Object.keys(item as Record<string, unknown>)) {
        if (k) keySet.add(k);
      }
    }
  }
  const headers = [...keySet].sort((a, b) => a.localeCompare(b));
  const rows: Record<string, string>[] = [];
  for (const item of arr) {
    const o: Record<string, string> = {};
    if (item !== null && typeof item === "object" && !Array.isArray(item)) {
      const rec = item as Record<string, unknown>;
      for (const h of headers) {
        o[h] = stringifyCell(rec[h]);
      }
    } else {
      for (const h of headers) o[h] = "";
    }
    rows.push(o);
  }
  return { headers, rows };
}

export function tabularFromCsv(text: string): TabularDataset {
  const { headers, rows } = parseCsvDataset(text);
  const kinds = inferFieldTypes(headers, rows);
  return { headers, rows, kinds };
}

export function tabularFromJson(text: string): TabularDataset {
  const { headers, rows } = parseJsonTabular(text);
  const kinds = inferFieldTypes(headers, rows);
  return { headers, rows, kinds };
}

/**
 * Load tabular data from file contents using name and/or content heuristics.
 */
export function ingestTabularFile(text: string, fileName: string): TabularDataset {
  const name = fileName.toLowerCase();
  const start = text.replace(/^\uFEFF/, "").trimStart();
  if (name.endsWith(".json") || start.startsWith("[") || start.startsWith("{")) {
    return tabularFromJson(text);
  }
  return tabularFromCsv(text);
}
