import {
  ADMIN_ASSIGNABLE_SECTION_VALUES,
  SUPER_ADMIN_NAV_VALUE,
} from "./admin-request-routing";
import { ADMIN_NAV, type NavEntry } from "../navigation/nav-config";

const ROUTING_TABLE_IDS = new Set(ADMIN_ASSIGNABLE_SECTION_VALUES);

/**
 * Super admin: full admin drawer plus Admin Access.
 * Other admins: only assignable sections present in `allowedKeys` (calendar & availability hidden — not in DB).
 */
export function filterAdminNavForAccess(isSuper: boolean, allowedKeys: Set<string>): NavEntry[] {
  if (isSuper) {
    const accessLink: NavEntry = {
      type: "link",
      id: SUPER_ADMIN_NAV_VALUE,
      label: "Admin Access",
    };
    return [...ADMIN_NAV, accessLink];
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
