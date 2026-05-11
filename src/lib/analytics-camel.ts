/**
 * Turn raw column / labels (snake_case, camelCase, spaces) into Title Case for display.
 * e.g. `age_bucket` → "Age Bucket", `orderRepairId` → "Order Repair Id"
 */
export function toTitleCaseLabel(str: string): string {
  const s = str.trim();
  if (!s) return str;
  if (s === "(empty)") return "Empty";
  const parts = s
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[\s_\-./]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return str;
  return parts
    .map((p) => (p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : ""))
    .join(" ");
}

/** @deprecated Prefer toTitleCaseLabel for UI */
export function toCamelCaseLabel(str: string): string {
  const s = str.trim();
  if (!s) return str;
  const parts = s
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[\s_\-./]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return str;
  const first = parts[0]!.toLowerCase();
  const rest = parts
    .slice(1)
    .map((p) => (p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : ""));
  return first + rest.join("");
}
