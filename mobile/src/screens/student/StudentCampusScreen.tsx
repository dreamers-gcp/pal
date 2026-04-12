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
import {
  addMinutesToHHmm,
  APPOINTMENT_PROVIDER_LABELS,
  appointmentDurationMinutes,
  appointmentStartTimeOptions,
  MEAL_PERIOD_LABELS,
  normalizeTimeForDb,
  providersForService,
  timeSlice,
  tomorrowDateString,
} from "../../lib/campus-use-mobile";
import {
  BOOKING_DATE_NOT_IN_PAST_MSG,
  BOOKING_NOT_IN_PAST_MSG,
  isBookingStartBeforeNow,
  isDateOnlyBeforeToday,
} from "../../lib/booking-start-not-in-past";
import {
  parseYyyyMmDdToLocalDate,
  startOfLocalDay,
  todayYyyyMmDd,
  tomorrowStartLocal,
} from "../../lib/datetime-pick";
import { requestStatusLabel } from "../../lib/request-display";
import { getSupabase } from "../../lib/supabase";
import { isTimeOverlap } from "../../lib/sports-booking";
import type {
  AppointmentProviderCode,
  MessExtraRequest,
  MessMealPeriod,
  Profile,
  StudentLeaveRequest,
} from "../../types";
import { theme } from "../../theme";

type CampusTab = "leave" | "mess" | "health";

export function StudentCampusScreen({ profile }: { profile: Profile }) {
  const [tab, setTab] = useState<CampusTab>("leave");
  const [leaves, setLeaves] = useState<StudentLeaveRequest[]>([]);
  const [messRows, setMessRows] = useState<MessExtraRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const [lStart, setLStart] = useState("");
  const [lEnd, setLEnd] = useState("");
  const [lReason, setLReason] = useState("");
  const [lSubmit, setLSubmit] = useState(false);

  const [mDate, setMDate] = useState(tomorrowDateString());
  const [mPeriod, setMPeriod] = useState<MessMealPeriod>("lunch");
  const [mCount, setMCount] = useState("1");
  const [mNotes, setMNotes] = useState("");
  const [mSubmit, setMSubmit] = useState(false);

  const [svc, setSvc] = useState<"counsellor" | "doctor">("counsellor");
  const [prov, setProv] = useState<AppointmentProviderCode>("counsellor_1");
  const [pDate, setPDate] = useState(todayYyyyMmDd);
  const [pStart, setPStart] = useState("10:00");
  const [pNotes, setPNotes] = useState("");
  const [pBlocked, setPBlocked] = useState(false);
  const [pSubmit, setPSubmit] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [providerModalOpen, setProviderModalOpen] = useState(false);
  const [tabModalOpen, setTabModalOpen] = useState(false);
  const [mealPeriodModalOpen, setMealPeriodModalOpen] = useState(false);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [pStartModalOpen, setPStartModalOpen] = useState(false);

  const apptDuration = appointmentDurationMinutes(svc);
  const pEndComputed = useMemo(() => addMinutesToHHmm(pStart, apptDuration), [pStart, apptDuration]);

  const pStartOptionsBase = useMemo(
    () => appointmentStartTimeOptions(apptDuration),
    [apptDuration]
  );
  const pStartOptions = useMemo(() => {
    const today = todayYyyyMmDd();
    if (pDate !== today) return pStartOptionsBase;
    const now = new Date();
    const cutoff = now.getHours() * 60 + now.getMinutes();
    return pStartOptionsBase.filter((o) => {
      const [hh, mm] = o.value.split(":").map((x) => parseInt(x, 10));
      return hh * 60 + mm >= cutoff;
    });
  }, [pStartOptionsBase, pDate]);

  const providerOptions = useMemo(
    () =>
      providersForService(svc).map((c) => ({
        value: c,
        label: APPOINTMENT_PROVIDER_LABELS[c],
      })),
    [svc]
  );

  const mealPeriodSelectOptions = useMemo(
    () =>
      (Object.keys(MEAL_PERIOD_LABELS) as MessMealPeriod[]).map((p) => ({
        value: p,
        label: MEAL_PERIOD_LABELS[p],
      })),
    []
  );

  const tabSelectOptions = useMemo(
    () => [
      { value: "leave", label: "Leave request" },
      { value: "mess", label: "Mess — extra guests" },
      { value: "health", label: "Health appointments" },
    ],
    []
  );

  const tabTriggerLabel =
    tab === "leave"
      ? "Leave request"
      : tab === "mess"
        ? "Mess — extra guests"
        : "Health appointments";

  const serviceSelectOptions = useMemo(
    () => [
      { value: "counsellor", label: "Counsellor" },
      { value: "doctor", label: "Doctor" },
    ],
    []
  );
  const reload = useCallback(async (silent?: boolean) => {
    if (!silent) setLoading(true);
    const supabase = getSupabase();
    const [lr, mr] = await Promise.all([
      supabase
        .from("student_leave_requests")
        .select("*")
        .eq("student_id", profile.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("mess_extra_requests")
        .select("*")
        .eq("student_id", profile.id)
        .order("created_at", { ascending: false }),
    ]);
    setLeaves((lr.data as StudentLeaveRequest[]) ?? []);
    setMessRows((mr.data as MessExtraRequest[]) ?? []);
    if (!silent) setLoading(false);
  }, [profile.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reload(true);
    } finally {
      setRefreshing(false);
    }
  }, [reload]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const opts = providersForService(svc);
    setProv(opts[0]!);
  }, [svc]);

  useEffect(() => {
    if (pStartOptions.length === 0) return;
    if (!pStartOptions.some((o) => o.value === pStart)) {
      setPStart(pStartOptions[0]!.value);
    }
  }, [pStartOptions, pStart]);

  useEffect(() => {
    if (!pDate || !pStart) {
      setPBlocked(false);
      return;
    }
    const supabase = getSupabase();
    const st = normalizeTimeForDb(pStart);
    const et = normalizeTimeForDb(pEndComputed);
    let cancelled = false;
    supabase
      .from("appointment_bookings")
      .select("start_time, end_time")
      .eq("provider_code", prov)
      .eq("booking_date", pDate)
      .eq("status", "approved")
      .then(({ data }) => {
        if (cancelled) return;
        const clash = (data ?? []).some((row) =>
          isTimeOverlap(
            timeSlice(st),
            timeSlice(et),
            timeSlice(String(row.start_time)),
            timeSlice(String(row.end_time))
          )
        );
        setPBlocked(clash);
      });
    return () => {
      cancelled = true;
    };
  }, [pDate, pStart, pEndComputed, prov]);

  async function submitLeave() {
    if (!lStart || !lEnd || lEnd < lStart) return;
    if (isDateOnlyBeforeToday(lStart)) {
      Alert.alert("Invalid date", BOOKING_DATE_NOT_IN_PAST_MSG);
      return;
    }
    setLSubmit(true);
    const supabase = getSupabase();
    const { data: approvedLeaves } = await supabase
      .from("student_leave_requests")
      .select("id, start_date, end_date")
      .eq("student_id", profile.id)
      .eq("status", "approved");
    const overlaps = (approvedLeaves ?? []).some(
      (row: { start_date: string; end_date: string }) =>
        lStart <= row.end_date && row.start_date <= lEnd
    );
    if (overlaps) {
      setLSubmit(false);
      return;
    }
    const { error } = await supabase.from("student_leave_requests").insert({
      student_id: profile.id,
      start_date: lStart,
      end_date: lEnd,
      reason: lReason.trim() || null,
    });
    setLSubmit(false);
    if (!error) {
      setLReason("");
      reload();
    }
  }

  async function submitMess() {
    const minMess = tomorrowDateString();
    if (!mDate || mDate < minMess) return;
    setMSubmit(true);
    const supabase = getSupabase();
    const { data: approvedMess } = await supabase
      .from("mess_extra_requests")
      .select("id")
      .eq("student_id", profile.id)
      .eq("meal_date", mDate)
      .eq("meal_period", mPeriod)
      .eq("status", "approved")
      .maybeSingle();
    if (approvedMess) {
      setMSubmit(false);
      return;
    }
    const { error } = await supabase.from("mess_extra_requests").insert({
      student_id: profile.id,
      meal_date: mDate,
      meal_period: mPeriod,
      extra_guest_count: Math.max(0, Math.floor(Number(mCount) || 0)),
      notes: mNotes.trim() || null,
    });
    setMSubmit(false);
    if (!error) {
      setMNotes("");
      reload();
    }
  }

  async function submitAppt() {
    if (!pDate || pBlocked) return;
    if (isBookingStartBeforeNow(pDate, pStart)) {
      Alert.alert("Invalid date or time", BOOKING_NOT_IN_PAST_MSG);
      return;
    }
    setPSubmit(true);
    const supabase = getSupabase();
    const { error } = await supabase.from("appointment_bookings").insert({
      student_id: profile.id,
      service_type: svc,
      provider_code: prov,
      booking_date: pDate,
      start_time: normalizeTimeForDb(pStart),
      end_time: normalizeTimeForDb(pEndComputed),
      notes: pNotes.trim() || null,
    });
    setPSubmit(false);
    if (!error) {
      setPNotes("");
    }
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
      <Text style={styles.hint}>Leave, dining extras, and health appointments — same flows as the web.</Text>

      <Text style={styles.tabLabel}>Campus services</Text>
      <Pressable
        onPress={() => setTabModalOpen(true)}
        style={[styles.selectTrigger, styles.selectTriggerSpaced]}
        accessibilityRole="button"
        accessibilityLabel="Campus service"
      >
        <Text style={styles.selectTriggerText} numberOfLines={2}>
          {tabTriggerLabel}
        </Text>
        <Text style={styles.selectChevron}>▼</Text>
      </Pressable>
      <SelectModal
        visible={tabModalOpen}
        title="Campus services"
        options={tabSelectOptions}
        selectedValue={tab}
        onSelect={(v) => setTab(v as CampusTab)}
        onClose={() => setTabModalOpen(false)}
      />

      {tab === "leave" ? (
        <>
          <Text style={styles.sectionTitle}>Request leave</Text>
          <DatePickerField
            label="Start date"
            value={lStart}
            onChange={(v) => {
              setLStart(v);
              setLEnd((end) => (end && v && end < v ? v : end));
            }}
            placeholder="Select start date"
            minimumDate={startOfLocalDay(new Date())}
            containerStyle={styles.field}
          />
          <DatePickerField
            label="End date"
            value={lEnd}
            onChange={setLEnd}
            placeholder="Select end date"
            minimumDate={
              /^\d{4}-\d{2}-\d{2}$/.test(lStart)
                ? startOfLocalDay(parseYyyyMmDdToLocalDate(lStart))
                : undefined
            }
            containerStyle={styles.field}
          />
          <View style={styles.field}>
            <Text style={styles.label}>Reason (optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={lReason}
              onChangeText={setLReason}
              multiline
            />
          </View>
          <Pressable
            onPress={() => !lSubmit && submitLeave()}
            style={[styles.submitBtn, lSubmit && styles.dim]}
          >
            <Text style={styles.submitBtnText}>{lSubmit ? "…" : "Submit leave"}</Text>
          </Pressable>
          <Text style={styles.subHead}>Your leave requests</Text>
          {leaves.map((r) => (
            <View key={r.id} style={styles.card}>
              <Text style={styles.cardTitle}>
                {r.start_date} → {r.end_date}
              </Text>
              <Text style={styles.cardMeta}>{requestStatusLabel(r.status)}</Text>
              {r.reason ? <Text style={styles.cardMeta}>{r.reason}</Text> : null}
            </View>
          ))}
        </>
      ) : null}

      {tab === "mess" ? (
        <>
          <Text style={styles.sectionTitle}>Dining hall — extra guests</Text>
          <Text style={styles.mutedSmall}>Must be at least one day ahead.</Text>
          <DatePickerField
            label="Meal date"
            value={mDate}
            onChange={setMDate}
            minimumDate={tomorrowStartLocal()}
            containerStyle={styles.field}
          />
          <Text style={styles.label}>Meal period</Text>
          <Pressable
            onPress={() => setMealPeriodModalOpen(true)}
            style={[styles.selectTrigger, styles.selectTriggerSpaced]}
            accessibilityRole="button"
            accessibilityLabel="Meal period"
          >
            <Text style={styles.selectTriggerText} numberOfLines={1}>
              {MEAL_PERIOD_LABELS[mPeriod]}
            </Text>
            <Text style={styles.selectChevron}>▼</Text>
          </Pressable>
          <SelectModal
            visible={mealPeriodModalOpen}
            title="Meal period"
            options={mealPeriodSelectOptions}
            selectedValue={mPeriod}
            onSelect={(v) => setMPeriod(v as MessMealPeriod)}
            onClose={() => setMealPeriodModalOpen(false)}
          />
          <View style={styles.field}>
            <Text style={styles.label}>Extra guest count</Text>
            <TextInput style={styles.input} value={mCount} onChangeText={setMCount} keyboardType="number-pad" />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Notes</Text>
            <TextInput style={[styles.input, styles.textArea]} value={mNotes} onChangeText={setMNotes} multiline />
          </View>
          <Pressable
            onPress={() => !mSubmit && submitMess()}
            style={[styles.submitBtn, mSubmit && styles.dim]}
          >
            <Text style={styles.submitBtnText}>{mSubmit ? "…" : "Submit mess request"}</Text>
          </Pressable>
          <Text style={styles.subHead}>Your mess requests</Text>
          {messRows.map((r) => (
            <View key={r.id} style={styles.card}>
              <Text style={styles.cardTitle}>
                {r.meal_date} · {MEAL_PERIOD_LABELS[r.meal_period]}
              </Text>
              <Text style={styles.cardMeta}>
                +{r.extra_guest_count} guests · {requestStatusLabel(r.status)}
              </Text>
            </View>
          ))}
        </>
      ) : null}

      {tab === "health" ? (
        <>
          <Text style={styles.sectionTitle}>Counsellor or doctor</Text>
          <Text style={styles.label}>Service</Text>
          <Pressable
            onPress={() => setServiceModalOpen(true)}
            style={[styles.selectTrigger, styles.selectTriggerSpaced]}
            accessibilityRole="button"
            accessibilityLabel="Health service"
          >
            <Text style={styles.selectTriggerText} numberOfLines={1}>
              {svc === "counsellor" ? "Counsellor" : "Doctor"}
            </Text>
            <Text style={styles.selectChevron}>▼</Text>
          </Pressable>
          <SelectModal
            visible={serviceModalOpen}
            title="Service"
            options={serviceSelectOptions}
            selectedValue={svc}
            onSelect={(v) => setSvc(v as "counsellor" | "doctor")}
            onClose={() => setServiceModalOpen(false)}
          />
          <View style={styles.field}>
            <Text style={styles.label}>Provider</Text>
            <Pressable
              onPress={() => setProviderModalOpen(true)}
              style={styles.selectTrigger}
              accessibilityRole="button"
              accessibilityLabel="Provider"
            >
              <Text style={styles.selectTriggerText} numberOfLines={2}>
                {APPOINTMENT_PROVIDER_LABELS[prov]}
              </Text>
              <Text style={styles.selectChevron}>▼</Text>
            </Pressable>
          </View>
          <SelectModal
            visible={providerModalOpen}
            title="Provider"
            options={providerOptions}
            selectedValue={prov}
            onSelect={(v) => setProv(v as AppointmentProviderCode)}
            onClose={() => setProviderModalOpen(false)}
          />
          <DatePickerField
            label="Appointment date"
            value={pDate}
            onChange={setPDate}
            minimumDate={startOfLocalDay(new Date())}
            containerStyle={styles.field}
          />
          <Text style={styles.label}>Start time</Text>
          <Pressable
            onPress={() => setPStartModalOpen(true)}
            style={[styles.selectTrigger, styles.selectTriggerSpaced]}
            accessibilityRole="button"
            accessibilityLabel="Appointment start time"
          >
            <Text style={styles.selectTriggerText} numberOfLines={1}>
              {pStartOptions.find((o) => o.value === pStart)?.label ?? pStart}
            </Text>
            <Text style={styles.selectChevron}>▼</Text>
          </Pressable>
          <SelectModal
            visible={pStartModalOpen}
            title="Start time"
            options={pStartOptions}
            selectedValue={pStart}
            onSelect={(v) => setPStart(v)}
            onClose={() => setPStartModalOpen(false)}
          />
          <Text style={styles.mutedSmall}>
            Ends {pEndComputed} ({apptDuration} min session)
          </Text>
          {pBlocked ? <Text style={styles.warn}>Slot unavailable — pick another time.</Text> : null}
          <View style={styles.field}>
            <Text style={styles.label}>Notes</Text>
            <TextInput style={[styles.input, styles.textArea]} value={pNotes} onChangeText={setPNotes} multiline />
          </View>
          <Pressable
            onPress={() => !pSubmit && submitAppt()}
            style={[styles.submitBtn, (pSubmit || pBlocked) && styles.dim]}
          >
            <Text style={styles.submitBtnText}>{pSubmit ? "…" : "Submit appointment"}</Text>
          </Pressable>
          <Text style={styles.mutedSmall}>
            View appointment status on the web; reload this app after approval.
          </Text>
        </>
      ) : null}
    </RefreshableScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 32 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  hint: { fontSize: 13, color: theme.mutedForeground, marginBottom: 12, lineHeight: 19 },
  tabLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.mutedForeground,
    marginBottom: 6,
  },
  selectTriggerSpaced: {
    marginBottom: 14,
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
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
  subHead: { fontSize: 14, fontWeight: "700", marginTop: 20, marginBottom: 8 },
  field: { marginBottom: 10 },
  label: { fontSize: 12, fontWeight: "600", color: theme.mutedForeground, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    padding: 10,
    fontSize: 15,
    color: theme.foreground,
    backgroundColor: theme.card,
  },
  textArea: { minHeight: 64, textAlignVertical: "top" },
  submitBtn: {
    backgroundColor: theme.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
  },
  submitBtnText: { color: theme.primaryForeground, fontWeight: "700" },
  dim: { opacity: 0.55 },
  mutedSmall: { fontSize: 12, color: theme.mutedForeground, marginBottom: 8 },
  warn: { color: theme.destructive, marginBottom: 8 },
  card: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 8,
    backgroundColor: theme.card,
  },
  cardTitle: { fontWeight: "600" },
  cardMeta: { fontSize: 13, color: theme.mutedForeground, marginTop: 4 },
});
