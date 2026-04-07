import { clsx, type ClassValue } from "clsx"
import { format, parseISO } from "date-fns"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Capitalize a single token (words, hyphen segments, program codes like gmp / a). */
function capitalizeDisplayToken(part: string): string {
  if (!part) return part
  if (/^\d+(\.\d+)?$/.test(part)) return part
  // Short lowercase letter codes (e.g. gmp, bm, hrm)
  if (/^[a-z]{2,3}$/.test(part)) return part.toUpperCase()
  // Already all-caps short tokens (GMP, HRM)
  if (/^[A-Z]{2,6}$/.test(part)) return part
  return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
}

function titleCaseHyphenated(word: string): string {
  return word.split("-").map((seg) => capitalizeDisplayToken(seg)).join("-")
}

/**
 * Title case for UI labels: each word capitalized; supports hyphens and program codes
 * (e.g. "gmp - a" → "GMP - A", "Cricket ground" → "Cricket Ground").
 */
export function toTitleCase(s: string): string {
  if (!s?.trim()) return s ?? ""
  const parts = s.trim().split(/(\s+|[\-–—])/)
  return parts
    .map((part) => {
      if (!part) return part
      if (/^\s+$/.test(part)) return part
      if (part === "-" || part === "–" || part === "—") return part
      if (part.includes("-") && part.length > 1) return titleCaseHyphenated(part)
      return capitalizeDisplayToken(part)
    })
    .join("")
}

/** Human-readable labels for DB/snake_case or mixed strings in UI. */
export function formatUiLabel(s: string): string {
  if (!s?.trim()) return s ?? ""
  const spaced = s.trim().replace(/_/g, " ").replace(/\s+/g, " ")
  return toTitleCase(spaced)
}

/** Display `created_at` (ISO) for admin request cards. */
export function formatSubmittedAt(iso: string): string {
  try {
    const d = parseISO(iso)
    if (Number.isNaN(d.getTime())) return iso
    return format(d, "MMM d, yyyy 'at' h:mm a")
  } catch {
    return iso
  }
}

/** Oldest submissions first (fair queue for admins). */
export function sortByCreatedAtAsc<T extends { created_at: string }>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
}
