import { useCallback, useEffect, useMemo, useState } from "react";
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
import { SelectModal } from "../../components/SelectModal";
import { TimePickerField } from "../../components/TimePickerField";
import { BOOKING_NOT_IN_PAST_MSG, isBookingStartBeforeNow } from "../../lib/booking-start-not-in-past";
import { startOfLocalDay, todayYyyyMmDd } from "../../lib/datetime-pick";
import { getSupabase } from "../../lib/supabase";
import {
  isTimeOverlap,
  SPORT_LABELS,
  SPORTS_VENUE_LABELS,
  SPORT_TYPES_ORDER,
  venuesForSport,
} from "../../lib/sports-booking";
import { requestStatusLabel } from "../../lib/request-display";
import type { Profile, SportType, SportsBooking, SportsVenueCode } from "../../types";
import { theme } from "../../theme";

export function SportsRequestsScreen({
  profile,
  requesterRole,
}: {
  profile: Profile;
  requesterRole: "student" | "professor";
}) {
  const [rows, setRows] = useState<SportsBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [sportType, setSportType] = useState<SportType>("cricket");
  const [sportVenue, setSportVenue] = useState<SportsVenueCode>("cricket_ground");
  const [sportDate, setSportDate] = useState(() => todayYyyyMmDd());
  const [sportStartTime, setSportStartTime] = useState("");
  const [sportEndTime, setSportEndTime] = useState("");
  const [sportPurpose, setSportPurpose] = useState("");
  const [unavailableVenues, setUnavailableVenues] = useState<Set<SportsVenueCode>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sportModalOpen, setSportModalOpen] = useState(false);
  const [venueModalOpen, setVenueModalOpen] = useState(false);

  const load = useCallback(async (silent?: boolean) => {
    if (!silent) setLoading(true);
    const supabase = getSupabase();
    const { data } = await supabase
      .from("sports_bookings")
      .select("*")
      .eq("requester_id", profile.id)
      .order("created_at", { ascending: false });
    setRows((data as SportsBooking[]) ?? []);
    if (!silent) setLoading(false);
  }, [profile.id]);

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

  useEffect(() => {
    setSportVenue(venuesForSport(sportType)[0]!);
  }, [sportType]);

  useEffect(() => {
    if (!sportDate || !sportStartTime || !sportEndTime) {
      setUnavailableVenues(new Set());
      return;
    }
    let cancelled = false;
    const supabase = getSupabase();
    supabase
      .from("sports_bookings")
      .select("venue_code, start_time, end_time")
      .eq("sport", sportType)
      .eq("booking_date", sportDate)
      .eq("status", "approved")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setUnavailableVenues(new Set());
          return;
        }
        const blocked = new Set<SportsVenueCode>();
        for (const row of data ?? []) {
          if (
            isTimeOverlap(
              sportStartTime,
              sportEndTime,
              String(row.start_time ?? ""),
              String(row.end_time ?? "")
            )
          ) {
            blocked.add(row.venue_code as SportsVenueCode);
          }
        }
        setUnavailableVenues(blocked);
      });
    return () => {
      cancelled = true;
    };
  }, [sportType, sportDate, sportStartTime, sportEndTime]);

  const slotBlocked = unavailableVenues.has(sportVenue);

  async function submit() {
    if (!sportDate.trim()) {
      Alert.alert("Date required", "Select a booking date.");
      return;
    }
    if (!sportStartTime.trim() || !sportEndTime.trim()) {
      Alert.alert("Time required", "Select a start time and end time.");
      return;
    }
    if (sportStartTime >= sportEndTime) {
      Alert.alert("Invalid time", "End time must be after start time.");
      return;
    }
    if (slotBlocked) {
      Alert.alert("Slot taken", "This venue is already booked for that time.");
      return;
    }
    if (isBookingStartBeforeNow(sportDate.trim(), `${sportStartTime}:00`)) {
      Alert.alert("Invalid date or time", BOOKING_NOT_IN_PAST_MSG);
      return;
    }
    setSubmitting(true);
    const supabase = getSupabase();
    const { error } = await supabase.from("sports_bookings").insert({
      requester_id: profile.id,
      requester_email: profile.email,
      requester_role: requesterRole,
      sport: sportType,
      venue_code: sportVenue,
      booking_date: sportDate.trim(),
      start_time: `${sportStartTime}:00`,
      end_time: `${sportEndTime}:00`,
      purpose: sportPurpose.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      return;
    }
    setSportPurpose("");
    load();
  }

  const venueCodes = useMemo(() => venuesForSport(sportType), [sportType]);

  const sportSelectOptions = useMemo(
    () => SPORT_TYPES_ORDER.map((s) => ({ value: s, label: SPORT_LABELS[s] })),
    []
  );

  const venueSelectOptions = useMemo(
    () => venueCodes.map((v) => ({ value: v, label: SPORTS_VENUE_LABELS[v] })),
    [venueCodes]
  );

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
      <Text style={styles.sectionTitle}>New request</Text>
      <View style={styles.field}>
        <Text style={styles.label}>Sport</Text>
        <Pressable
          onPress={() => setSportModalOpen(true)}
          style={styles.selectTrigger}
          accessibilityRole="button"
          accessibilityLabel="Sport"
        >
          <Text style={styles.selectTriggerText} numberOfLines={1}>
            {SPORT_LABELS[sportType]}
          </Text>
          <Text style={styles.selectChevron}>▼</Text>
        </Pressable>
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Venue</Text>
        <Pressable
          onPress={() => setVenueModalOpen(true)}
          style={styles.selectTrigger}
          accessibilityRole="button"
          accessibilityLabel="Venue"
        >
          <Text style={styles.selectTriggerText} numberOfLines={2}>
            {SPORTS_VENUE_LABELS[sportVenue]}
          </Text>
          <Text style={styles.selectChevron}>▼</Text>
        </Pressable>
      </View>
      <SelectModal
        visible={sportModalOpen}
        title="Sport"
        options={sportSelectOptions}
        selectedValue={sportType}
        onSelect={(v) => setSportType(v as SportType)}
        onClose={() => setSportModalOpen(false)}
      />
      <SelectModal
        visible={venueModalOpen}
        title="Venue"
        options={venueSelectOptions}
        selectedValue={sportVenue}
        onSelect={(v) => setSportVenue(v as SportsVenueCode)}
        onClose={() => setVenueModalOpen(false)}
      />
      {slotBlocked ? (
        <Text style={styles.warn}>This venue is already booked for that time slot.</Text>
      ) : null}
      <DatePickerField
        label="Date"
        value={sportDate}
        onChange={setSportDate}
        minimumDate={startOfLocalDay(new Date())}
        containerStyle={styles.field}
      />
      <View style={styles.row}>
        <TimePickerField
          label="Start time"
          value={sportStartTime}
          onChange={setSportStartTime}
          referenceDateIso={sportDate}
          minuteInterval={15}
          containerStyle={[styles.field, styles.flex1]}
        />
        <TimePickerField
          label="End time"
          value={sportEndTime}
          onChange={setSportEndTime}
          referenceDateIso={sportDate}
          minuteInterval={15}
          containerStyle={[styles.field, styles.flex1]}
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Purpose (optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={sportPurpose}
          onChangeText={setSportPurpose}
          multiline
          placeholderTextColor={theme.mutedForeground}
        />
      </View>
      <Pressable
        onPress={() => !submitting && submit()}
        style={({ pressed }) => [
          styles.submitBtn,
          submitting && styles.submitDisabled,
          pressed && styles.submitPressed,
        ]}
      >
        <Text style={styles.submitBtnText}>{submitting ? "Submitting…" : "Submit request"}</Text>
      </Pressable>

      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>My requests</Text>
      {rows.length === 0 ? (
        <Text style={styles.muted}>No sports requests yet.</Text>
      ) : (
        rows.map((b) => (
          <View key={b.id} style={styles.card}>
            <Text style={styles.cardTitle}>
              {SPORT_LABELS[b.sport]} · {SPORTS_VENUE_LABELS[b.venue_code]}
            </Text>
            <Text style={styles.cardMeta}>
              {b.booking_date} · {String(b.start_time).slice(0, 5)} – {String(b.end_time).slice(0, 5)}
            </Text>
            <Text style={styles.cardMeta}>Status: {requestStatusLabel(b.status)}</Text>
            {b.purpose ? <Text style={styles.cardMeta}>{b.purpose}</Text> : null}
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
  sectionTitle: { fontSize: 16, fontWeight: "700", color: theme.foreground, marginBottom: 10 },
  field: { marginBottom: 12 },
  flex1: { flex: 1 },
  row: { flexDirection: "row", gap: 10 },
  label: { fontSize: 12, fontWeight: "600", color: theme.mutedForeground, marginBottom: 4 },
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
  textArea: { minHeight: 72, textAlignVertical: "top" },
  warn: { color: theme.destructive, fontSize: 13, marginBottom: 8 },
  submitBtn: {
    marginTop: 8,
    backgroundColor: theme.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  submitBtnText: { color: theme.primaryForeground, fontWeight: "700", fontSize: 16 },
  submitDisabled: { opacity: 0.6 },
  submitPressed: { opacity: 0.9 },
  muted: { fontSize: 14, color: theme.mutedForeground },
  card: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
    marginBottom: 10,
  },
  cardTitle: { fontSize: 15, fontWeight: "600", color: theme.foreground },
  cardMeta: { fontSize: 13, color: theme.mutedForeground, marginTop: 4 },
});
