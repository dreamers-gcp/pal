/**
 * Parse credits / CrPoints from CSV (supports decimals and comma as decimal separator).
 */
export function parseCreditsField(raw: string | undefined | null): number {
  const s = String(raw ?? "")
    .trim()
    .replace(",", ".");
  if (s === "") return 0;
  const v = parseFloat(s);
  if (Number.isNaN(v) || v < 0) return 0;
  return v;
}

/** Normalize DB/JSON values (Postgres `numeric` may arrive as string). */
export function coerceCredits(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") return parseCreditsField(value);
  return 0;
}

/** Stable display for table cells (avoids 1.5000000001 style glitches). */
export function formatCreditsDisplay(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n * 1000) / 1000;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded);
}
