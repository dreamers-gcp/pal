import { clsx, type ClassValue } from "clsx"
import { format, parseISO } from "date-fns"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function toTitleCase(s: string): string {
  if (!s?.trim()) return s ?? ""
  return s
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
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
