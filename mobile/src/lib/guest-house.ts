import type { GuestHouseBooking, GuestHouseCode, GuestHouseRoomAllocation } from "../types";

export const MAX_GUESTS_PER_ROOM = 4;

export const GUEST_HOUSE_LABELS: Record<GuestHouseCode, string> = {
  international_centre: "International Centre",
  mdp_building: "MDP Building",
};

export const INTERNATIONAL_CENTRE_ROOMS: string[] = Array.from(
  { length: 6 },
  (_, floorIdx) => {
    const floor = floorIdx + 1;
    return Array.from({ length: 16 }, (_, roomIdx) =>
      `${floor}${String(roomIdx + 1).padStart(2, "0")}`
    );
  }
).flat();

export const MDP_BUILDING_ROOMS: string[] = Array.from(
  { length: 6 },
  (_, floorIdx) => {
    const floor = floorIdx + 1;
    return Array.from(
      { length: 16 },
      (_, roomIdx) => `M${floor}${String(roomIdx + 1).padStart(2, "0")}`
    );
  }
).flat();

export function roomOptionsForGuestHouse(code: GuestHouseCode): string[] {
  if (code === "international_centre") return INTERNATIONAL_CENTRE_ROOMS;
  if (code === "mdp_building") return MDP_BUILDING_ROOMS;
  return [];
}

export const TOTAL_GUEST_HOUSE_ROOM_COUNT =
  INTERNATIONAL_CENTRE_ROOMS.length + MDP_BUILDING_ROOMS.length;

export const GUEST_HOUSE_CODES: GuestHouseCode[] = ["international_centre", "mdp_building"];

export function guestRoomKey(guestHouse: GuestHouseCode, roomNumber: string): string {
  return `${guestHouse}:${roomNumber}`;
}

/** Floors 1–6 with room numbers for grid layout (matches web `roomsByFloorForGuestHouse`). */
export function roomsByFloorForGuestHouse(code: GuestHouseCode): Array<{
  floor: number;
  rooms: string[];
}> {
  const allRooms =
    code === "international_centre"
      ? INTERNATIONAL_CENTRE_ROOMS
      : code === "mdp_building"
        ? MDP_BUILDING_ROOMS
        : [];

  return Array.from({ length: 6 }, (_, idx) => {
    const floor = idx + 1;
    return {
      floor,
      rooms: allRooms.filter((r) => r.replace(/^M/, "").startsWith(String(floor))),
    };
  });
}

export function roomsNeededForGuestCount(guestCount: number): number {
  const n = Math.max(1, Math.floor(Number(guestCount) || 1));
  return Math.ceil(n / MAX_GUESTS_PER_ROOM);
}

export function allocatedRoomsForBooking(b: GuestHouseBooking): { guest_house: GuestHouseCode; room_number: string }[] {
  const raw = b.allocated_rooms;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw
      .filter(
        (x): x is { guest_house: GuestHouseCode; room_number: string } =>
          Boolean(x) && typeof x === "object" && "guest_house" in x && "room_number" in x
      )
      .map((x) => ({
        guest_house: x.guest_house as GuestHouseCode,
        room_number: String(x.room_number),
      }));
  }
  if (b.guest_house && b.room_number) {
    return [{ guest_house: b.guest_house, room_number: String(b.room_number) }];
  }
  return [];
}

export function formatGuestHouseAllocationSummary(b: GuestHouseBooking): string {
  const alloc = allocatedRoomsForBooking(b);
  if (alloc.length === 0) return "";
  return alloc
    .map((a) => `${GUEST_HOUSE_LABELS[a.guest_house] ?? a.guest_house} — Room ${a.room_number}`)
    .join("; ");
}

/** Room keys unavailable for allocation for this stay (overlapping approved bookings + current booking's own rooms if already approved). Mirrors web admin dashboard. */
export function unavailableRoomKeysForGuestBooking(
  selected: GuestHouseBooking,
  allBookings: GuestHouseBooking[]
): Set<string> {
  const blocked = new Set<string>();
  const overlapsStay = (b: GuestHouseBooking) =>
    selected.check_in_date <= b.check_out_date && b.check_in_date <= selected.check_out_date;

  for (const b of allBookings) {
    if (b.id === selected.id) continue;
    if (b.status !== "approved") continue;
    if (!overlapsStay(b)) continue;
    for (const a of allocatedRoomsForBooking(b)) {
      blocked.add(guestRoomKey(a.guest_house, a.room_number));
    }
  }
  if (selected.status === "approved") {
    for (const a of allocatedRoomsForBooking(selected)) {
      blocked.add(guestRoomKey(a.guest_house, a.room_number));
    }
  }
  return blocked;
}

export function guestHouseAvailabilityForStay(unavailableKeys: Set<string>): {
  totalRooms: number;
  bookedRooms: number;
  availableRooms: number;
} {
  const totalRooms = TOTAL_GUEST_HOUSE_ROOM_COUNT;
  const bookedRooms = unavailableKeys.size;
  const availableRooms = Math.max(totalRooms - bookedRooms, 0);
  return { totalRooms, bookedRooms, availableRooms };
}

/** Approved bookings overlapping the stay window, grouped by room key (for “who booked this room?”). */
export function approvedRoomBookingMapForStayWindow(
  selected: GuestHouseBooking,
  allBookings: GuestHouseBooking[]
): Map<string, GuestHouseBooking[]> {
  const map = new Map<string, GuestHouseBooking[]>();
  for (const b of allBookings) {
    if (b.status !== "approved") continue;
    if (
      !(
        selected.check_in_date <= b.check_out_date && b.check_in_date <= selected.check_out_date
      )
    ) {
      continue;
    }
    for (const a of allocatedRoomsForBooking(b)) {
      const key = guestRoomKey(a.guest_house, a.room_number);
      const arr = map.get(key) ?? [];
      arr.push(b);
      map.set(key, arr);
    }
  }
  return map;
}

export function validateGuestHouseApprovalAllocations(
  guestCount: number,
  allocations: GuestHouseRoomAllocation[]
): { ok: true } | { ok: false; message: string } {
  const n = Math.max(1, Math.floor(Number(guestCount) || 1));
  const minRooms = roomsNeededForGuestCount(n);
  if (allocations.length < minRooms) {
    return {
      ok: false,
      message: `Select at least ${minRooms} room(s) for ${n} guest(s) (max ${MAX_GUESTS_PER_ROOM} guests per room).`,
    };
  }
  const capacity = allocations.length * MAX_GUESTS_PER_ROOM;
  if (capacity < n) {
    return {
      ok: false,
      message: `Selected rooms fit at most ${capacity} guests; this request needs capacity for ${n}.`,
    };
  }
  return { ok: true };
}
