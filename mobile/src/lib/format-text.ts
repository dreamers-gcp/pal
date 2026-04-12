/** Capitalize a single token (words, hyphen segments, program codes like gmp / a). Mirrors web `src/lib/utils.ts`. */
function capitalizeDisplayToken(part: string): string {
  if (!part) return part;
  if (part.includes(",") && !part.includes("-")) {
    return part
      .split(",")
      .map((chunk) => capitalizeDisplayToken(chunk.trim()))
      .filter(Boolean)
      .join(", ");
  }
  if (/^\d+(\.\d+)?$/.test(part)) return part;
  // Short lowercase letter codes (e.g. gmp, bm, hrm)
  if (/^[a-z]{2,3}$/.test(part)) return part.toUpperCase();
  // Already all-caps short tokens (GMP, HRM)
  if (/^[A-Z]{2,6}$/.test(part)) return part;
  return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
}

function titleCaseHyphenated(word: string): string {
  return word.split("-").map((seg) => capitalizeDisplayToken(seg)).join("-");
}

/**
 * Title case for UI labels: each word capitalized; supports hyphens, commas between names,
 * and program codes (e.g. "gmp - a" → "GMP - A", "GMP, HRM" stays uppercase).
 */
export function toTitleCase(s: string): string {
  const t = s?.trim() ?? "";
  if (!t) return s ?? "";
  const parts = t.split(/(\s+|[\-–—]|,\s*)/);
  return parts
    .map((part) => {
      if (!part) return part;
      if (/^\s+$/.test(part)) return part;
      if (part === "-" || part === "–" || part === "—") return part;
      if (/^,\s*$/.test(part)) return part;
      if (part.includes("-") && part.length > 1) return titleCaseHyphenated(part);
      return capitalizeDisplayToken(part);
    })
    .join("");
}
