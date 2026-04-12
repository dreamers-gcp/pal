import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  approvedRoomBookingMapForStayWindow,
  GUEST_HOUSE_CODES,
  GUEST_HOUSE_LABELS,
  guestHouseAvailabilityForStay,
  guestRoomKey,
  roomsByFloorForGuestHouse,
  unavailableRoomKeysForGuestBooking,
} from "../lib/guest-house";
import type { GuestHouseBooking, GuestHouseCode, GuestHouseRoomAllocation } from "../types";
import { theme } from "../theme";

const CHIP_W = 40;

type Props = {
  allBookings: GuestHouseBooking[];
  selectedBooking: GuestHouseBooking;
  selectedAllocations: GuestHouseRoomAllocation[];
  onAllocationsChange: (next: GuestHouseRoomAllocation[]) => void;
};

export function GuestHouseAllocationPicker({
  allBookings,
  selectedBooking,
  selectedAllocations,
  onAllocationsChange,
}: Props) {
  const [focusKey, setFocusKey] = useState<string | null>(null);

  useEffect(() => {
    setFocusKey(null);
  }, [selectedBooking.id]);

  const unavailable = useMemo(
    () => unavailableRoomKeysForGuestBooking(selectedBooking, allBookings),
    [selectedBooking, allBookings]
  );

  const stats = useMemo(() => guestHouseAvailabilityForStay(unavailable), [unavailable]);

  const roomBookingMap = useMemo(
    () => approvedRoomBookingMapForStayWindow(selectedBooking, allBookings),
    [selectedBooking, allBookings]
  );

  const focusBookings = focusKey ? (roomBookingMap.get(focusKey) ?? []) : [];

  function toggleRoom(house: GuestHouseCode, room: string) {
    const key = guestRoomKey(house, room);
    const isSelected = selectedAllocations.some(
      (a) => guestRoomKey(a.guest_house, a.room_number) === key
    );
    const blocked = unavailable.has(key) && !isSelected;
    if (blocked) {
      setFocusKey(key);
      return;
    }
    if (isSelected) {
      onAllocationsChange(
        selectedAllocations.filter((a) => guestRoomKey(a.guest_house, a.room_number) !== key)
      );
    } else {
      onAllocationsChange([...selectedAllocations, { guest_house: house, room_number: room }]);
    }
    setFocusKey(null);
  }

  return (
    <View>
      <Text style={styles.sectionLabel}>Availability overview</Text>
      <View style={styles.statsRow}>
        <View style={[styles.statCard, styles.statAvail]}>
          <Text style={styles.statLabel}>Available</Text>
          <Text style={[styles.statValue, styles.statAvailText]}>{stats.availableRooms}</Text>
        </View>
        <View style={[styles.statCard, styles.statBooked]}>
          <Text style={styles.statLabel}>Booked</Text>
          <Text style={[styles.statValue, styles.statBookedText]}>{stats.bookedRooms}</Text>
        </View>
        <View style={[styles.statCard, styles.statNeutral]}>
          <Text style={styles.statLabel}>Total rooms</Text>
          <Text style={styles.statValue}>{stats.totalRooms}</Text>
        </View>
      </View>

      <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Allocate rooms (required to approve)</Text>
      <Text style={styles.hint}>
        Select rooms across both guest houses. Tap an unavailable room to see overlapping bookings.
      </Text>

      <View style={styles.gridCard}>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.dotSelected]} />
            <Text style={styles.legendText}>Selected</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.dotBooked]} />
            <Text style={styles.legendText}>Unavailable</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.dotFree]} />
            <Text style={styles.legendText}>Free</Text>
          </View>
        </View>

        {GUEST_HOUSE_CODES.map((house) => (
          <View key={house} style={styles.houseBlock}>
            <Text style={styles.houseTitle}>{GUEST_HOUSE_LABELS[house]}</Text>
            {roomsByFloorForGuestHouse(house).map((section) => (
              <View key={`${house}-${section.floor}`} style={styles.floorBlock}>
                <Text style={styles.floorLabel}>Floor {section.floor}</Text>
                <View style={styles.roomRow}>
                  {section.rooms.map((room) => {
                    const key = guestRoomKey(house, room);
                    const isSelected = selectedAllocations.some(
                      (a) => guestRoomKey(a.guest_house, a.room_number) === key
                    );
                    const blocked = unavailable.has(key) && !isSelected;
                    const focused = focusKey === key;
                    return (
                      <Pressable
                        key={key}
                        onPress={() => toggleRoom(house, room)}
                        style={[
                          styles.roomChip,
                          blocked ? styles.roomUnavailable : isSelected ? styles.roomSelectedChip : styles.roomFree,
                          focused && styles.roomFocused,
                        ]}
                      >
                        <Text
                          style={[
                            styles.roomChipText,
                            blocked && styles.roomChipTextUnavailable,
                            isSelected && styles.roomChipTextSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {room}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        ))}
      </View>

      {focusKey ? (
        <View style={styles.focusCard}>
          <Text style={styles.focusTitle}>Bookings for {focusKey.replace(":", " · ")}</Text>
          {focusBookings.length === 0 ? (
            <Text style={styles.mutedSmall}>No overlapping approved bookings for this stay window.</Text>
          ) : (
            focusBookings.map((b) => (
              <View key={b.id} style={styles.bookingRow}>
                <Text style={styles.bookingGuest}>{b.guest_name}</Text>
                <Text style={styles.bookingMeta}>
                  {b.check_in_date} to {b.check_out_date}
                  {" • "}
                  {b.requester?.full_name ?? b.requester_email ?? "Unknown requester"}
                </Text>
              </View>
            ))
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { fontSize: 12, fontWeight: "600", color: theme.mutedForeground },
  hint: {
    fontSize: 12,
    color: theme.mutedForeground,
    marginTop: 6,
    lineHeight: 17,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  statAvail: { backgroundColor: "rgba(16, 185, 129, 0.12)", borderColor: "rgba(16, 185, 129, 0.35)" },
  statBooked: { backgroundColor: "rgba(245, 158, 11, 0.12)", borderColor: "rgba(245, 158, 11, 0.35)" },
  statNeutral: { backgroundColor: theme.accentBg, borderColor: theme.border },
  statLabel: { fontSize: 10, color: theme.mutedForeground, fontWeight: "600" },
  statValue: { fontSize: 15, fontWeight: "700", color: theme.foreground, marginTop: 2 },
  statAvailText: { color: "#047857" },
  statBookedText: { color: "#b45309" },
  gridCard: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: theme.card,
  },
  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  dotSelected: { backgroundColor: theme.primary },
  dotBooked: { backgroundColor: "rgba(217, 119, 6, 0.85)" },
  dotFree: { backgroundColor: "rgba(5, 150, 105, 0.85)" },
  legendText: { fontSize: 11, color: theme.mutedForeground },
  houseBlock: { marginTop: 12 },
  houseTitle: { fontSize: 13, fontWeight: "700", color: theme.foreground, marginBottom: 8 },
  floorBlock: { marginBottom: 10 },
  floorLabel: { fontSize: 12, fontWeight: "600", color: theme.mutedForeground, marginBottom: 6 },
  roomRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  roomChip: {
    width: CHIP_W,
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  roomFree: {
    borderColor: "rgba(4, 120, 87, 0.45)",
    backgroundColor: "rgba(5, 150, 105, 0.12)",
  },
  roomUnavailable: {
    borderColor: "rgba(217, 119, 6, 0.45)",
    backgroundColor: "rgba(245, 158, 11, 0.15)",
  },
  roomSelectedChip: {
    borderColor: "rgba(79, 70, 229, 0.65)",
    backgroundColor: theme.accentBg,
  },
  roomFocused: {
    borderWidth: 2,
    borderColor: theme.primary,
  },
  roomChipText: { fontSize: 9, fontWeight: "700", color: "#065f46" },
  roomChipTextUnavailable: { color: "#92400e", textDecorationLine: "line-through" },
  roomChipTextSelected: { color: theme.primary },
  focusCard: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: theme.accentBg,
  },
  focusTitle: { fontSize: 13, fontWeight: "700", color: theme.foreground, marginBottom: 8 },
  mutedSmall: { fontSize: 12, color: theme.mutedForeground },
  bookingRow: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    backgroundColor: theme.card,
  },
  bookingGuest: { fontSize: 13, fontWeight: "600", color: theme.foreground },
  bookingMeta: { fontSize: 11, color: theme.mutedForeground, marginTop: 4, lineHeight: 15 },
});
