export type FieldKind = "categorical" | "numerical" | "date";

function isLikelyDateToken(t: string): boolean {
  const s = t.trim();
  if (s.length < 6) return false;
  if (/^\d{1,6}$/.test(s)) return false;
  const d = Date.parse(s);
  if (Number.isNaN(d)) return false;
  return true;
}

function isLikelyNumberToken(t: string): boolean {
  const s = t.trim();
  if (s === "") return false;
  const n = Number.parseFloat(s.replace(/,/g, ""));
  return Number.isFinite(n);
}

function classifyCell(s: string): "date" | "num" | "text" {
  const t = s.trim();
  if (t === "") return "text";
  if (isLikelyDateToken(t)) return "date";
  if (isLikelyNumberToken(t)) return "num";
  return "text";
}

/**
 * Infer column semantics from a sample of stringified cell values (CSV / JSON ingest).
 */
export function inferFieldTypes(
  headers: string[],
  rows: Record<string, string>[],
  sampleSize = 400
): Record<string, FieldKind> {
  const sample = rows.slice(0, sampleSize);
  const out: Record<string, FieldKind> = {};

  for (const h of headers) {
    const vals = sample.map((r) => (r[h] ?? "").trim()).filter(Boolean);
    if (vals.length === 0) {
      out[h] = "categorical";
      continue;
    }
    let dates = 0;
    let nums = 0;
    for (const v of vals) {
      const c = classifyCell(v);
      if (c === "date") dates++;
      else if (c === "num") nums++;
    }
    const ratio = (n: number) => n / vals.length;
    if (ratio(dates) >= 0.65) out[h] = "date";
    else if (ratio(nums) >= 0.65) out[h] = "numerical";
    else out[h] = "categorical";
  }
  return out;
}

/** X-axis accepts category, time, or numeric dimensions (numeric buckets use raw values). */
export function fieldAcceptsCategoryAxis(kind: FieldKind): boolean {
  return kind === "categorical" || kind === "date" || kind === "numerical";
}

/** Y-axis: count allows any field as the series label; sum/avg require a numeric column. */
export function fieldAcceptsMeasure(kind: FieldKind, aggregate: "count" | "sum" | "avg"): boolean {
  if (aggregate === "count") return true;
  return kind === "numerical";
}

/** @deprecated Prefer fieldAcceptsCategoryAxis / fieldAcceptsMeasure */
export function fieldAcceptsAxis(kind: FieldKind, axis: "x" | "measure"): boolean {
  if (axis === "x") return fieldAcceptsCategoryAxis(kind);
  return kind === "numerical";
}
