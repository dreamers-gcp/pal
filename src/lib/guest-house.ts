import type { GuestHouseCode } from "@/lib/types";

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
