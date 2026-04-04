import type {
  GuestHouseBooking,
  GuestHouseCode,
  GuestHouseRoomAllocation,
} from "@/lib/types";

/** Max guests per room (admin must assign enough rooms). */
export const MAX_GUESTS_PER_ROOM = 4;

export const GUEST_HOUSE_LABELS: Record<GuestHouseCode, string> = {
  international_centre: "International Centre",
  mdp_building: "MDP Building",
};

/**
 * International Centre inventory:
 * 96 rooms, 16 rooms per floor, room numbers 101..116, 201..216 ... 601..616.
 */
export const INTERNATIONAL_CENTRE_ROOMS: string[] = Array.from(
  { length: 6 },
  (_, floorIdx) => {
    const floor = floorIdx + 1;
    return Array.from({ length: 16 }, (_, roomIdx) =>
      `${floor}${String(roomIdx + 1).padStart(2, "0")}`
    );
  }
).flat();

/**
 * MDP Building inventory:
 * 96 rooms, 16 rooms per floor, room numbers M101..M116 ... M601..M616.
 */
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

export const TOTAL_GUEST_HOUSE_ROOM_COUNT =
  INTERNATIONAL_CENTRE_ROOMS.length + MDP_BUILDING_ROOMS.length;

export function roomOptionsForGuestHouse(code: GuestHouseCode): string[] {
  if (code === "international_centre") return INTERNATIONAL_CENTRE_ROOMS;
  if (code === "mdp_building") return MDP_BUILDING_ROOMS;
  return [];
}

export function internationalCentreRoomsByFloor(): Array<{
  floor: number;
  rooms: string[];
}> {
  return Array.from({ length: 6 }, (_, idx) => {
    const floor = idx + 1;
    return {
      floor,
      rooms: INTERNATIONAL_CENTRE_ROOMS.filter((r) => r.startsWith(String(floor))),
    };
  });
}

export const GUEST_HOUSE_CODES: GuestHouseCode[] = [
  "international_centre",
  "mdp_building",
];

export function roomsNeededForGuestCount(guestCount: number): number {
  const n = Math.max(1, Math.floor(Number(guestCount) || 1));
  return Math.ceil(n / MAX_GUESTS_PER_ROOM);
}

/** Rooms assigned on approval, or legacy single guest_house + room_number. */
export function allocatedRoomsForBooking(
  b: GuestHouseBooking
): GuestHouseRoomAllocation[] {
  const raw = b.allocated_rooms;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw
      .filter(
        (x): x is GuestHouseRoomAllocation =>
          Boolean(x) &&
          typeof x === "object" &&
          "guest_house" in x &&
          "room_number" in x
      )
      .map((x) => ({
        guest_house: x.guest_house as GuestHouseCode,
        room_number: String(x.room_number),
      }));
  }
  if (b.guest_house && b.room_number) {
    return [
      { guest_house: b.guest_house, room_number: String(b.room_number) },
    ];
  }
  return [];
}

export function guestRoomKey(
  guestHouse: GuestHouseCode,
  roomNumber: string
): string {
  return `${guestHouse}:${roomNumber}`;
}

export function formatGuestHouseAllocationSummary(b: GuestHouseBooking): string {
  const alloc = allocatedRoomsForBooking(b);
  if (alloc.length === 0) return "";
  return alloc
    .map(
      (a) =>
        `${GUEST_HOUSE_LABELS[a.guest_house]} — Room ${a.room_number}`
    )
    .join("; ");
}

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
      rooms: allRooms.filter((r) =>
        r.replace(/^M/, "").startsWith(String(floor))
      ),
    };
  });
}
