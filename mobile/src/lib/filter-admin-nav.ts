import { ADMIN_ASSIGNABLE_SECTION_VALUES } from "./admin-request-routing";
import { ADMIN_NAV, type NavEntry } from "../navigation/nav-config";

const ROUTING_TABLE_IDS = new Set(ADMIN_ASSIGNABLE_SECTION_VALUES);

/**
 * Super admin: full admin drawer (Admin Access lives under the “More” section in `ADMIN_NAV`).
 * Other admins: only assignable sections present in `allowedKeys` (calendar & availability hidden — not in DB).
 */
export function filterAdminNavForAccess(isSuper: boolean, allowedKeys: Set<string>): NavEntry[] {
  if (isSuper) {
    return ADMIN_NAV;
  }

  const out: NavEntry[] = [];
  let pendingHeading: NavEntry | null = null;

  for (const entry of ADMIN_NAV) {
    if (entry.type === "heading") {
      pendingHeading = entry;
      continue;
    }
    const id = entry.id;
    const inTable = ROUTING_TABLE_IDS.has(id);
    const allowed = inTable && allowedKeys.has(id);
    if (!allowed) continue;
    if (pendingHeading) {
      out.push(pendingHeading);
      pendingHeading = null;
    }
    out.push(entry);
  }

  return out;
}

export function firstAdminNavLinkId(entries: NavEntry[]): string | null {
  const link = entries.find((e): e is NavEntry & { type: "link" } => e.type === "link");
  return link?.id ?? null;
}
