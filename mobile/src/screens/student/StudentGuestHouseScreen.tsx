import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { DatePickerField } from "../../components/DatePickerField";
import { RefreshableScrollView } from "../../components/RefreshableScrollView";
import {
  formatGuestHouseAllocationSummary,
  MAX_GUESTS_PER_ROOM,
  roomsNeededForGuestCount,
} from "../../lib/guest-house";
import { BOOKING_DATE_NOT_IN_PAST_MSG, isDateOnlyBeforeToday } from "../../lib/booking-start-not-in-past";
import { parseYyyyMmDdToLocalDate, startOfLocalDay } from "../../lib/datetime-pick";
import { requestStatusLabel } from "../../lib/request-display";
import { getSupabase } from "../../lib/supabase";
import type { GuestHouseBooking, Profile } from "../../types";
import { theme } from "../../theme";

export function StudentGuestHouseScreen({ profile }: { profile: Profile }) {
  const [rows, setRows] = useState<GuestHouseBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [guestName, setGuestName] = useState("");
  const [guestPurpose, setGuestPurpose] = useState("");
  const [guestCount, setGuestCount] = useState("1");
  const [guestRoomCount, setGuestRoomCount] = useState("1");
  const [guestCheckIn, setGuestCheckIn] = useState("");
  const [guestCheckOut, setGuestCheckOut] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const guestRoomMin = useMemo(
    () => roomsNeededForGuestCount(Math.max(1, Math.floor(Number(guestCount) || 1))),
    [guestCount]
  );
  const prevGuestCountNumRef = useRef(1);
  const prevGuestRoomMinRef = useRef(guestRoomMin);

  useEffect(() => {
    const newMin = guestRoomMin;
    const oldMin = prevGuestRoomMinRef.current;
    const prevGuestsNum = prevGuestCountNumRef.current;
    const currGuestsNum = Math.max(1, Math.floor(Number(guestCount) || 1));

    setGuestRoomCount((prevStr) => {
      const raw = prevStr.trim();
      if (raw === "") {
        if (currGuestsNum !== prevGuestsNum) {
          return String(newMin);
        }
        return prevStr;
      }
      const prevRooms = Math.max(1, Math.floor(Number(prevStr) || 1));
      if (currGuestsNum !== prevGuestsNum) {
        if (currGuestsNum < prevGuestsNum && prevRooms <= oldMin) {
          return String(newMin);
        }
        return String(Math.max(newMin, prevRooms));
      }
      return String(Math.max(newMin, prevRooms));
    });

    prevGuestCountNumRef.current = currGuestsNum;
    prevGuestRoomMinRef.current = newMin;
  }, [guestRoomMin, guestCount]);

  const load = useCallback(async (silent?: boolean) => {
    if (!silent) setLoading(true);
    const supabase = getSupabase();
    const { data } = await supabase
      .from("guest_house_bookings")
      .select("*")
      .or(`requester_id.eq.${profile.id},requester_email.eq.${profile.email}`)
      .order("created_at", { ascending: false });
    setRows((data as GuestHouseBooking[]) ?? []);
    if (!silent) setLoading(false);
  }, [profile.id, profile.email]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(true);
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit() {
    if (!guestName.trim() || !guestCheckIn || !guestCheckOut) return;
    const count = Math.max(1, Math.floor(Number(guestCount) || 1));
    const minRooms = roomsNeededForGuestCount(count);
    const roomsRequested = Math.max(
      minRooms,
      Math.max(1, Math.floor(Number(guestRoomCount) || minRooms))
    );
    if (roomsRequested < minRooms) return;
    if (roomsRequested > 200) return;
    if (guestCheckOut < guestCheckIn) return;
    if (isDateOnlyBeforeToday(guestCheckIn)) {
      Alert.alert("Invalid date", BOOKING_DATE_NOT_IN_PAST_MSG);
      return;
    }

    setSubmitting(true);
    const supabase = getSupabase();
    const { error } = await supabase.from("guest_house_bookings").insert({
      requester_id: profile.id,
      requester_email: profile.email,
      guest_name: guestName.trim(),
      purpose: guestPurpose.trim() || null,
      guest_count: count,
      requested_room_count: roomsRequested,
      guest_house: null,
      room_number: null,
      allocated_rooms: null,
      check_in_date: guestCheckIn,
      check_out_date: guestCheckOut,
    });
    setSubmitting(false);
    if (error) return;
    setGuestName("");
    setGuestPurpose("");
    setGuestCount("1");
    setGuestRoomCount("1");
    setGuestCheckIn("");
    setGuestCheckOut("");
    load();
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <RefreshableScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <Text style={styles.hint}>
        An admin assigns guest houses and rooms after approval (in the Planova admin app or on the web).
      </Text>

      <Text style={styles.sectionTitle}>New request</Text>
      <View style={styles.field}>
        <Text style={styles.label}>Guest name</Text>
        <TextInput
          style={styles.input}
          value={guestName}
          onChangeText={setGuestName}
          placeholderTextColor={theme.mutedForeground}
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Purpose (optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={guestPurpose}
          onChangeText={setGuestPurpose}
          multiline
          placeholderTextColor={theme.mutedForeground}
        />
      </View>
      <View style={styles.row}>
        <View style={styles.flex1}>
          <Text style={styles.label}>Guest count</Text>
          <TextInput
            style={styles.input}
            value={guestCount}
            onChangeText={(t) => setGuestCount(t.replace(/[^\d]/g, ""))}
            onBlur={() => {
              setGuestCount((c) => {
                const n = Math.floor(Number(c));
                if (c.trim() === "" || !Number.isFinite(n) || n < 1) return "1";
                return String(Math.min(200, n));
              });
            }}
            keyboardType="number-pad"
            placeholderTextColor={theme.mutedForeground}
          />
          <Text style={styles.fieldHint}>Max {MAX_GUESTS_PER_ROOM} guests per room.</Text>
        </View>
        <View style={styles.flex1}>
          <Text style={styles.label}>Rooms requested (min {guestRoomMin})</Text>
          <TextInput
            style={styles.input}
            value={guestRoomCount}
            onChangeText={(t) => setGuestRoomCount(t.replace(/[^\d]/g, ""))}
            onBlur={() => {
              const min = roomsNeededForGuestCount(
                Math.max(1, Math.floor(Number(guestCount) || 1))
              );
              setGuestRoomCount((r) => {
                const raw = r.trim();
                if (raw === "") return String(min);
                const n = Math.floor(Number(r));
                if (!Number.isFinite(n) || n < min) return String(min);
                return String(Math.min(200, n));
              });
            }}
            keyboardType="number-pad"
            placeholderTextColor={theme.mutedForeground}
          />
        </View>
      </View>
      <Text style={styles.helperLine}>
        At least {guestRoomMin} room{guestRoomMin === 1 ? "" : "s"} for your guests. You can
        request more if needed (max 200).
      </Text>
      <DatePickerField
        label="Check-in"
        value={guestCheckIn}
        onChange={(v) => {
          setGuestCheckIn(v);
          setGuestCheckOut((co) => (co && v && co < v ? v : co));
        }}
        placeholder="Select check-in"
        minimumDate={startOfLocalDay(new Date())}
        containerStyle={styles.field}
      />
      <DatePickerField
        label="Check-out"
        value={guestCheckOut}
        onChange={setGuestCheckOut}
        placeholder="Select check-out"
        minimumDate={
          /^\d{4}-\d{2}-\d{2}$/.test(guestCheckIn)
            ? startOfLocalDay(parseYyyyMmDdToLocalDate(guestCheckIn))
            : undefined
        }
        containerStyle={styles.field}
      />
      <Pressable
        onPress={() => !submitting && submit()}
        style={[styles.submitBtn, submitting && styles.dim]}
      >
        <Text style={styles.submitBtnText}>{submitting ? "Submitting…" : "Submit request"}</Text>
      </Pressable>

      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>My requests</Text>
      {rows.length === 0 ? (
        <Text style={styles.muted}>No guest house requests yet.</Text>
      ) : (
        rows.map((b) => (
          <View key={b.id} style={styles.card}>
            <Text style={styles.cardTitle}>{b.guest_name}</Text>
            <Text style={styles.cardMeta}>
              {b.check_in_date} → {b.check_out_date} · {b.guest_count ?? 1} guest(s)
            </Text>
            <Text style={styles.cardMeta}>Status: {requestStatusLabel(b.status)}</Text>
            {formatGuestHouseAllocationSummary(b) ? (
              <Text style={styles.cardMeta}>{formatGuestHouseAllocationSummary(b)}</Text>
            ) : null}
            {b.admin_note ? (
              <Text style={styles.cardMeta}>Admin: {b.admin_note}</Text>
            ) : null}
          </View>
        ))
      )}
    </RefreshableScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 32 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  hint: { fontSize: 13, color: theme.mutedForeground, marginBottom: 16, lineHeight: 19 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 10 },
  field: { marginBottom: 12 },
  row: { flexDirection: "row", gap: 10 },
  flex1: { flex: 1 },
  label: { fontSize: 12, fontWeight: "600", color: theme.mutedForeground, marginBottom: 4 },
  fieldHint: { fontSize: 11, color: theme.mutedForeground, marginTop: 4, lineHeight: 15 },
  helperLine: {
    fontSize: 12,
    color: theme.mutedForeground,
    marginTop: -4,
    marginBottom: 8,
    lineHeight: 17,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: theme.foreground,
    backgroundColor: theme.card,
  },
  textArea: { minHeight: 64, textAlignVertical: "top" },
  submitBtn: {
    marginTop: 8,
    backgroundColor: theme.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  submitBtnText: { color: theme.primaryForeground, fontWeight: "700", fontSize: 16 },
  dim: { opacity: 0.6 },
  muted: { fontSize: 14, color: theme.mutedForeground },
  card: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
    marginBottom: 10,
  },
  cardTitle: { fontSize: 15, fontWeight: "600" },
  cardMeta: { fontSize: 13, color: theme.mutedForeground, marginTop: 4 },
});
