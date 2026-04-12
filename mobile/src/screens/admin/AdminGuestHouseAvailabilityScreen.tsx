import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { DatePickerField } from "../../components/DatePickerField";
import { SelectModal } from "../../components/SelectModal";
import { getSupabase } from "../../lib/supabase";
import {
  allocatedRoomsForBooking,
  GUEST_HOUSE_CODES,
  GUEST_HOUSE_LABELS,
  guestRoomKey,
  roomOptionsForGuestHouse,
  roomsByFloorForGuestHouse,
  TOTAL_GUEST_HOUSE_ROOM_COUNT,
} from "../../lib/guest-house";
import type { GuestHouseBooking, GuestHouseCode, Profile } from "../../types";
import { theme } from "../../theme";

type GuestHouseScope = GuestHouseCode | "all";

export function AdminGuestHouseAvailabilityScreen({ profile: _profile }: { profile: Profile }) {
  void _profile;
  const [guestHouseScope, setGuestHouseScope] = useState<GuestHouseScope>("all");
  const [guestAvailStart, setGuestAvailStart] = useState("");
  const [guestAvailEnd, setGuestAvailEnd] = useState("");
  const [rows, setRows] = useState<GuestHouseBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [guestHouseModalOpen, setGuestHouseModalOpen] = useState(false);

  const houses: GuestHouseCode[] =
    guestHouseScope === "all" ? GUEST_HOUSE_CODES : [guestHouseScope];

  const guestHouseSelectOptions = useMemo(
    () => [
      { value: "all", label: "All guest houses" },
      ...(Object.keys(GUEST_HOUSE_LABELS) as GuestHouseCode[]).map((gh) => ({
        value: gh,
        label: GUEST_HOUSE_LABELS[gh],
      })),
    ],
    []
  );

  const guestHouseTriggerLabel =
    guestHouseScope === "all" ? "All guest houses" : GUEST_HOUSE_LABELS[guestHouseScope];

  useEffect(() => {
    setFocusKey(null);
  }, [guestAvailStart, guestAvailEnd, guestHouseScope]);

  useEffect(() => {
    const start = guestAvailStart.trim();
    const end = guestAvailEnd.trim();
    if (!start || !end) {
      setRows([]);
      setError(null);
      setLoading(false);
      return;
    }
    if (start > end) {
      setRows([]);
      setError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const supabase = getSupabase();
      const { data, error: qErr } = await supabase
        .from("guest_house_bookings")
        .select(
          "id, check_in_date, check_out_date, guest_name, room_number, guest_house, allocated_rooms, requester_email, requester:profiles!guest_house_bookings_requester_id_fkey(full_name)"
        )
        .eq("status", "approved")
        .lte("check_in_date", end)
        .gte("check_out_date", start);
      if (cancelled) return;
      if (qErr) {
        setError(qErr.message);
        setRows([]);
      } else {
        setRows((data ?? []) as unknown as GuestHouseBooking[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [guestAvailStart, guestAvailEnd]);

  const roomBookingMap = useMemo(() => {
    const map = new Map<string, GuestHouseBooking[]>();
    const start = guestAvailStart.trim();
    const end = guestAvailEnd.trim();
    if (!start || !end || start > end) return map;
    for (const b of rows) {
      if (!(start <= b.check_out_date && b.check_in_date <= end)) continue;
      for (const a of allocatedRoomsForBooking(b)) {
        const key = guestRoomKey(a.guest_house, a.room_number);
        const arr = map.get(key) ?? [];
        arr.push(b);
        map.set(key, arr);
      }
    }
    return map;
  }, [rows, guestAvailStart, guestAvailEnd]);

  const { totalRooms, bookedRooms, availableRooms } = useMemo(() => {
    const totalRooms =
      guestHouseScope === "all"
        ? TOTAL_GUEST_HOUSE_ROOM_COUNT
        : roomOptionsForGuestHouse(guestHouseScope).length;
    let booked = 0;
    for (const key of roomBookingMap.keys()) {
      const house = key.split(":")[0] as GuestHouseCode;
      if (houses.includes(house)) booked += 1;
    }
    return {
      totalRooms,
      bookedRooms: booked,
      availableRooms: Math.max(totalRooms - booked, 0),
    };
  }, [roomBookingMap, guestHouseScope, houses]);

  const focusBookings = focusKey ? (roomBookingMap.get(focusKey) ?? []) : [];

  const start = guestAvailStart.trim();
  const end = guestAvailEnd.trim();

  const onRoomPress = useCallback(
    (key: string, blocked: boolean) => {
      if (!blocked) {
        setFocusKey(null);
        return;
      }
      setFocusKey((k) => (k === key ? null : key));
    },
    []
  );

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator
    >
      <Text style={styles.title}>Guest house availability</Text>
      <Text style={styles.sub}>
        Choose a stay window and which building(s) to inspect. Room tiles match the web admin: booked
        rooms are highlighted; tap a booked room for details.
      </Text>

      <Text style={styles.label}>Guest house</Text>
      <Pressable
        onPress={() => setGuestHouseModalOpen(true)}
        style={styles.selectTrigger}
        accessibilityRole="button"
        accessibilityLabel="Guest house"
      >
        <Text style={styles.selectTriggerText} numberOfLines={2}>
          {guestHouseTriggerLabel}
        </Text>
        <Text style={styles.selectChevron}>▼</Text>
      </Pressable>
      <SelectModal
        visible={guestHouseModalOpen}
        title="Guest house"
        options={guestHouseSelectOptions}
        selectedValue={guestHouseScope}
        onSelect={(v) => setGuestHouseScope(v as GuestHouseScope)}
        onClose={() => setGuestHouseModalOpen(false)}
      />

      <DatePickerField
        label="Start date"
        value={guestAvailStart}
        onChange={setGuestAvailStart}
        placeholder="Pick date"
        containerStyle={styles.dateField}
      />
      <DatePickerField
        label="End date"
        value={guestAvailEnd}
        onChange={setGuestAvailEnd}
        placeholder="Pick date"
        minimumDate={
          /^\d{4}-\d{2}-\d{2}$/.test(guestAvailStart)
            ? new Date(guestAvailStart + "T12:00:00")
            : undefined
        }
        containerStyle={styles.dateField}
      />

      {!start || !end ? (
        <Text style={styles.muted}>Select a start date and end date to load room availability.</Text>
      ) : start > end ? (
        <Text style={styles.error}>End date must be on or after start date.</Text>
      ) : (
        <>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, styles.statAvail]}>
              <Text style={styles.statLabel}>Available</Text>
              <Text style={[styles.statValue, styles.statAvailText]}>{availableRooms}</Text>
            </View>
            <View style={[styles.statCard, styles.statBooked]}>
              <Text style={styles.statLabel}>Booked</Text>
              <Text style={[styles.statValue, styles.statBookedText]}>{bookedRooms}</Text>
            </View>
            <View style={[styles.statCard, styles.statNeutral]}>
              <Text style={styles.statLabel}>Rooms in view</Text>
              <Text style={styles.statValue}>{totalRooms}</Text>
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={theme.primary} />
              <Text style={styles.muted}>Loading bookings…</Text>
            </View>
          ) : (
            <View style={styles.gridCard}>
              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, styles.dotBooked]} />
                  <Text style={styles.legendText}>Booked</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, styles.dotFree]} />
                  <Text style={styles.legendText}>Free</Text>
                </View>
              </View>

              {houses.map((house) => (
                <View key={house} style={styles.houseBlock}>
                  <Text style={styles.houseTitle}>{GUEST_HOUSE_LABELS[house]}</Text>
                  {roomsByFloorForGuestHouse(house).map((section) => (
                    <View key={`${house}-${section.floor}`} style={styles.floorBlock}>
                      <Text style={styles.floorLabel}>Floor {section.floor}</Text>
                      <View style={styles.roomRow}>
                        {section.rooms.map((room) => {
                          const key = guestRoomKey(house, room);
                          const roomBookings = roomBookingMap.get(key) ?? [];
                          const blocked = roomBookings.length > 0;
                          const selected = focusKey === key;
                          return (
                            <Pressable
                              key={key}
                              onPress={() => onRoomPress(key, blocked)}
                              style={[
                                styles.roomChip,
                                blocked ? styles.roomBooked : styles.roomFree,
                                selected && styles.roomSelected,
                              ]}
                            >
                              <Text
                                style={[styles.roomChipText, blocked && styles.roomChipTextBooked]}
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
          )}

          {focusKey ? (
            <View style={styles.focusCard}>
              <Text style={styles.focusTitle}>
                Bookings for {focusKey.replace(":", " · ")}
              </Text>
              {focusBookings.length === 0 ? (
                <Text style={styles.muted}>No bookings for this room.</Text>
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
        </>
      )}
    </ScrollView>
  );
}

const CHIP_W = 40;

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 32 },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: theme.foreground,
    marginBottom: 6,
  },
  sub: {
    fontSize: 12,
    color: theme.mutedForeground,
    lineHeight: 17,
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.mutedForeground,
    marginBottom: 4,
    marginTop: 8,
  },
  selectTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    backgroundColor: theme.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 4,
  },
  selectTriggerText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: theme.foreground,
  },
  selectChevron: {
    fontSize: 11,
    color: theme.mutedForeground,
    marginTop: 2,
  },
  dateField: { marginTop: 4 },
  muted: { fontSize: 13, color: theme.mutedForeground, marginTop: 10 },
  error: { fontSize: 13, color: "#b91c1c", marginTop: 10 },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
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
  loadingBox: {
    marginTop: 16,
    paddingVertical: 24,
    alignItems: "center",
    gap: 8,
  },
  gridCard: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: theme.card,
  },
  legendRow: { flexDirection: "row", gap: 16, marginBottom: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
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
  roomBooked: {
    borderColor: "rgba(217, 119, 6, 0.45)",
    backgroundColor: "rgba(245, 158, 11, 0.15)",
  },
  roomSelected: {
    borderWidth: 2,
    borderColor: theme.primary,
  },
  roomChipText: { fontSize: 9, fontWeight: "700", color: "#065f46" },
  roomChipTextBooked: { color: "#92400e", textDecorationLine: "line-through" },
  focusCard: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: theme.accentBg,
  },
  focusTitle: { fontSize: 13, fontWeight: "700", color: theme.foreground, marginBottom: 8 },
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
