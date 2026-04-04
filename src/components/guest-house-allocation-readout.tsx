"use client";

import { Building2 } from "lucide-react";
import type { GuestHouseBooking, GuestHouseCode } from "@/lib/types";
import {
  allocatedRoomsForBooking,
  GUEST_HOUSE_CODES,
  GUEST_HOUSE_LABELS,
} from "@/lib/guest-house";
import { cn } from "@/lib/utils";

function roomsGroupedByHouse(
  booking: GuestHouseBooking
): Map<GuestHouseCode, string[]> {
  const map = new Map<GuestHouseCode, string[]>();
  for (const a of allocatedRoomsForBooking(booking)) {
    const list = map.get(a.guest_house) ?? [];
    list.push(String(a.room_number));
    map.set(a.guest_house, list);
  }
  for (const [, rooms] of map) {
    rooms.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }
  return map;
}

/**
 * Readable allocation display: grouped by building, room numbers as chips.
 */
export function GuestHouseAllocationReadout({
  booking,
  compact = false,
  className,
}: {
  booking: GuestHouseBooking;
  compact?: boolean;
  className?: string;
}) {
  const byHouse = roomsGroupedByHouse(booking);
  const houses = GUEST_HOUSE_CODES.filter((code) => byHouse.has(code));
  if (houses.length === 0) return null;

  return (
    <div
      className={cn(
        compact
          ? "space-y-2"
          : "rounded-lg border border-border/70 bg-muted/25 p-3 shadow-sm",
        className
      )}
      role="region"
      aria-label="Allocated rooms"
    >
      <div className="flex items-center gap-2">
        <Building2
          className={cn(
            "shrink-0 text-muted-foreground",
            compact ? "h-3.5 w-3.5" : "h-4 w-4"
          )}
          aria-hidden
        />
        <span
          className={cn(
            "font-semibold text-foreground",
            compact ? "text-xs" : "text-sm"
          )}
        >
          Allocated rooms
        </span>
      </div>
      <ul className={cn("space-y-2.5", compact && "space-y-2")}>
        {houses.map((code) => (
          <li key={code}>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
              {GUEST_HOUSE_LABELS[code]}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {byHouse.get(code)!.map((room) => (
                <span
                  key={`${code}-${room}`}
                  className="inline-flex min-h-7 items-center rounded-md border border-border/90 bg-background px-2.5 py-0.5 text-xs font-semibold tabular-nums text-foreground"
                >
                  Room {room}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
