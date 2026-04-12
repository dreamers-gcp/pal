import { format } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { BottomSheetModal } from "../../components/BottomSheetModal";
import { DatePickerField } from "../../components/DatePickerField";
import { MultiSelectModal } from "../../components/MultiSelectModal";
import { RefreshableScrollView } from "../../components/RefreshableScrollView";
import { SelectModal } from "../../components/SelectModal";
import { TimePickerField } from "../../components/TimePickerField";
import { encodeCalendarRequestInfra } from "../../lib/calendar-request-infra";
import { encodeCalendarRequestSubjects, decodeCalendarRequestSubjects } from "../../lib/calendar-subject";
import {
  CALENDAR_REQUEST_KINDS,
  CALENDAR_REQUEST_KIND_LABELS,
  groupsForProfessorBookingForm,
  professorVenueNamesForRequestKind,
  PROFESSOR_VENUE_NAMES,
  resolveProfessorVenues,
} from "../../lib/professor-booking-metadata";
import { startOfLocalDay, todayYyyyMmDd } from "../../lib/datetime-pick";
import { BOOKING_NOT_IN_PAST_MSG, isBookingStartBeforeNow } from "../../lib/booking-start-not-in-past";
import { fetchProfessorRequests } from "../../lib/student-events-fetch";
import { getSupabase } from "../../lib/supabase";
import { requestKindLabel, requestStatusLabel } from "../../lib/request-display";
import { toTitleCase } from "../../lib/format-text";
import type {
  CalendarRequest,
  CalendarRequestKind,
  Classroom,
  Profile,
  StudentGroup,
} from "../../types";
import { theme } from "../../theme";

function timeToMins(t: string): number {
  const s = t.trim().slice(0, 8);
  const [h, m] = s.split(":").map((x) => parseInt(x, 10));
  if (Number.isNaN(h)) return 0;
  return h * 60 + (Number.isNaN(m) ? 0 : m);
}

function normalizeTimeForDb(t: string): string {
  const s = t.trim();
  if (s.length === 5) return `${s}:00`;
  return s;
}

function parseOptionalCount(raw: string): number | undefined | "bad" {
  const t = raw.trim();
  if (t === "") return undefined;
  if (!/^\d+$/.test(t)) return "bad";
  return Number.parseInt(t, 10);
}

export function ProfessorMyRequestsScreen({ profile }: { profile: Profile }) {
  const [loading, setLoading] = useState(true);
  const [metaLoading, setMetaLoading] = useState(true);
  const [requests, setRequests] = useState<CalendarRequest[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [studentGroups, setStudentGroups] = useState<StudentGroup[]>([]);
  const [subjectOptions, setSubjectOptions] = useState<string[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requestKind, setRequestKind] = useState<CalendarRequestKind>("extra_class");
  const [classroomId, setClassroomId] = useState("");
  const [eventDate, setEventDate] = useState(todayYyyyMmDd());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set());
  const [infraMic, setInfraMic] = useState("");
  const [infraSofa, setInfraSofa] = useState("");
  const [infraMomento, setInfraMomento] = useState("");
  const [infraBouquet, setInfraBouquet] = useState("");
  const [infraVideoRecording, setInfraVideoRecording] = useState(false);
  const [infraPhotography, setInfraPhotography] = useState(false);
  const [infraStage, setInfraStage] = useState(false);
  const [infraOpen, setInfraOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [conflictWarning, setConflictWarning] = useState("");
  const [detailReq, setDetailReq] = useState<CalendarRequest | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [kindModalOpen, setKindModalOpen] = useState(false);
  const [venueModalOpen, setVenueModalOpen] = useState(false);
  const [programsModalOpen, setProgramsModalOpen] = useState(false);
  const [subjectsModalOpen, setSubjectsModalOpen] = useState(false);

  const loadRequests = useCallback(async (silent?: boolean) => {
    if (!silent) setLoading(true);
    const supabase = getSupabase();
    const rows = await fetchProfessorRequests(supabase, profile);
    setRequests(rows);
    if (!silent) setLoading(false);
  }, [profile]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadRequests(true);
    } finally {
      setRefreshing(false);
    }
  }, [loadRequests]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = getSupabase();
      const [cRes, gRes, subRes] = await Promise.all([
        supabase.from("classrooms").select("*").order("name"),
        supabase.from("student_groups").select("id, name").order("name"),
        supabase.from("student_enrollments").select("subject"),
      ]);
      if (cancelled) return;
      setClassrooms((cRes.data as Classroom[]) ?? []);
      setStudentGroups((gRes.data as StudentGroup[]) ?? []);
      const seen = new Set<string>();
      const list: string[] = [];
      for (const row of subRes.data ?? []) {
        const s = String((row as { subject?: string | null }).subject ?? "").trim();
        if (s && !seen.has(s)) {
          seen.add(s);
          list.push(s);
        }
      }
      list.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
      setSubjectOptions(list);
      setMetaLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const venueByLabel = useMemo(() => resolveProfessorVenues(classrooms), [classrooms]);
  const allowedVenueNames = useMemo(
    () => professorVenueNamesForRequestKind(requestKind),
    [requestKind]
  );
  const groupsForBooking = useMemo(
    () => groupsForProfessorBookingForm(studentGroups),
    [studentGroups]
  );
  const missingVenueSeeds = useMemo(
    () => allowedVenueNames.filter((name) => !venueByLabel.get(name)),
    [allowedVenueNames, venueByLabel]
  );

  const kindSelectOptions = useMemo(
    () =>
      CALENDAR_REQUEST_KINDS.map((k) => ({
        value: k,
        label: CALENDAR_REQUEST_KIND_LABELS[k],
      })),
    []
  );

  const venueSelectOptions = useMemo(() => {
    const rows: { value: string; label: string }[] = [
      { value: "__none__", label: "Select venue" },
    ];
    for (const name of allowedVenueNames) {
      const row = venueByLabel.get(name);
      if (row) rows.push({ value: row.id, label: toTitleCase(name) });
    }
    return rows;
  }, [allowedVenueNames, venueByLabel]);

  const venueTriggerLabel = useMemo(() => {
    if (!classroomId.trim()) return "Select venue";
    const c = classrooms.find((x) => x.id === classroomId);
    return c ? toTitleCase(c.name) : "Select venue";
  }, [classroomId, classrooms]);

  const programSelectOptions = useMemo(
    () => groupsForBooking.map((g) => ({ value: g.id, label: g.name })),
    [groupsForBooking]
  );

  const programTriggerLabel = useMemo(() => {
    if (selectedGroupIds.size === 0) return "Select programs";
    const names = groupsForBooking.filter((g) => selectedGroupIds.has(g.id)).map((g) => g.name);
    if (names.length <= 2) return names.join(", ");
    return `${names.length} programs selected`;
  }, [selectedGroupIds, groupsForBooking]);

  const subjectSelectOptions = useMemo(
    () => subjectOptions.map((s) => ({ value: s, label: s })),
    [subjectOptions]
  );

  const subjectTriggerLabel = useMemo(() => {
    if (selectedSubjects.size === 0) return "Optional — tap to add subjects";
    const list = [...selectedSubjects].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    if (list.length <= 2) return list.join(", ");
    return `${list.length} subjects selected`;
  }, [selectedSubjects]);

  useEffect(() => {
    if (!classroomId) return;
    const row = classrooms.find((c) => c.id === classroomId);
    if (!row) return;
    const nameNorm = row.name.trim().toLowerCase();
    const matchesCanonical = PROFESSOR_VENUE_NAMES.some(
      (label) => label.trim().toLowerCase() === nameNorm
    );
    if (!matchesCanonical) return;
    const allowed = professorVenueNamesForRequestKind(requestKind);
    const ok = allowed.some((label) => label.trim().toLowerCase() === nameNorm);
    if (!ok) setClassroomId("");
  }, [requestKind, classroomId, classrooms]);

  useEffect(() => {
    if (!classroomId || !eventDate || !startTime || !endTime) {
      setConflictWarning("");
      return;
    }
    let cancelled = false;
    const supabase = getSupabase();
    supabase
      .from("calendar_requests")
      .select("id, start_time, end_time")
      .eq("status", "approved")
      .eq("classroom_id", classroomId)
      .eq("event_date", eventDate)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const sM = timeToMins(startTime);
        const eM = timeToMins(endTime);
        const conflict = data.some((b) => {
          const bs = timeToMins(String(b.start_time));
          const be = timeToMins(String(b.end_time));
          return sM < be && bs < eM;
        });
        setConflictWarning(
          conflict
            ? "This venue is already booked for that time (approved). Pick another slot or room."
            : ""
        );
      });
    return () => {
      cancelled = true;
    };
  }, [classroomId, eventDate, startTime, endTime]);

  function toggleGroup(id: string) {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSubject(s: string) {
    setSelectedSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  function resetForm() {
    setTitle("");
    setDescription("");
    setRequestKind("extra_class");
    setClassroomId("");
    setEventDate(todayYyyyMmDd());
    setStartTime("09:00");
    setEndTime("10:00");
    setSelectedGroupIds(new Set());
    setSelectedSubjects(new Set());
    setInfraMic("");
    setInfraSofa("");
    setInfraMomento("");
    setInfraBouquet("");
    setInfraVideoRecording(false);
    setInfraPhotography(false);
    setInfraStage(false);
  }

  async function submit() {
    if (selectedGroupIds.size === 0) {
      Alert.alert("Programs required", "Select at least one program (student group).");
      return;
    }
    if (!classroomId.trim()) {
      Alert.alert("Venue required", "Select a venue.");
      return;
    }
    if (!title.trim()) {
      Alert.alert("Title required", "Enter a title for this request.");
      return;
    }
    if (timeToMins(startTime) >= timeToMins(endTime)) {
      Alert.alert("Invalid time", "End time must be after start time.");
      return;
    }
    if (conflictWarning) {
      Alert.alert("Slot taken", "Choose a different time or venue.");
      return;
    }
    if (isBookingStartBeforeNow(eventDate, startTime)) {
      Alert.alert("Invalid date or time", BOOKING_NOT_IN_PAST_MSG);
      return;
    }

    const micN = parseOptionalCount(infraMic);
    const sofaN = parseOptionalCount(infraSofa);
    const momentoN = parseOptionalCount(infraMomento);
    const bouquetN = parseOptionalCount(infraBouquet);
    if (micN === "bad" || sofaN === "bad" || momentoN === "bad" || bouquetN === "bad") {
      Alert.alert("Invalid counts", "Infrastructure counts must be whole numbers (0 or more).");
      return;
    }

    const infraPayload = encodeCalendarRequestInfra({
      mic_count: micN,
      sofa_count: sofaN,
      momento_count: momentoN,
      bouquet_count: bouquetN,
      video_recording: infraVideoRecording,
      photography: infraPhotography,
      stage: infraStage,
    });

    const groupIds = [...selectedGroupIds];
    setSubmitting(true);
    const supabase = getSupabase();
    const { data: requestData, error: insertError } = await supabase
      .from("calendar_requests")
      .insert({
        professor_id: profile.id,
        title: title.trim(),
        subject: encodeCalendarRequestSubjects([...selectedSubjects]),
        description: description.trim() || null,
        student_group_id: groupIds[0]!,
        classroom_id: classroomId,
        event_date: eventDate,
        start_time: normalizeTimeForDb(startTime),
        end_time: normalizeTimeForDb(endTime),
        request_kind: requestKind === "class" ? "extra_class" : requestKind,
        infra_requirements: infraPayload,
      })
      .select()
      .single();

    if (insertError || !requestData) {
      setSubmitting(false);
      Alert.alert("Could not submit", insertError?.message ?? "Unknown error");
      return;
    }

    const groupLinks = groupIds.map((gid) => ({
      calendar_request_id: requestData.id as string,
      student_group_id: gid,
    }));
    const { error: groupError } = await supabase.from("calendar_request_groups").insert(groupLinks);

    if (groupError) {
      setSubmitting(false);
      Alert.alert("Could not link programs", groupError.message);
      return;
    }

    setSubmitting(false);
    resetForm();
    Alert.alert(
      "Submitted",
      groupIds.length === 1
        ? "Your request was sent for admin review."
        : `Your request was sent for ${groupIds.length} programs.`
    );
    loadRequests();
  }

  const ready = !metaLoading && !loading;

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <RefreshableScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshing={refreshing}
        onRefresh={onRefresh}
      >
        <Text style={styles.lead}>
          Create event block requests here — same flow as the web dashboard. Admins review and
          approve slots.
        </Text>

        {missingVenueSeeds.length > 0 ? (
          <Text style={styles.warn}>
            Some venue types are missing in the database ({missingVenueSeeds.join(", ")}). Ask an
            admin to seed classrooms if a venue stays unavailable.
          </Text>
        ) : null}

        <Text style={styles.sectionTitle}>New request</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Request type</Text>
          <Pressable
            onPress={() => setKindModalOpen(true)}
            style={styles.selectTrigger}
            accessibilityRole="button"
            accessibilityLabel="Request type"
          >
            <Text style={styles.selectTriggerText} numberOfLines={1}>
              {CALENDAR_REQUEST_KIND_LABELS[requestKind]}
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
            <Text
              style={[
                styles.selectTriggerText,
                !classroomId.trim() && styles.selectTriggerPlaceholder,
              ]}
              numberOfLines={1}
            >
              {venueTriggerLabel}
            </Text>
            <Text style={styles.selectChevron}>▼</Text>
          </Pressable>
        </View>

        <SelectModal
          visible={kindModalOpen}
          title="Request type"
          options={kindSelectOptions}
          selectedValue={requestKind}
          onSelect={(v) => setRequestKind(v as CalendarRequestKind)}
          onClose={() => setKindModalOpen(false)}
        />
        <SelectModal
          visible={venueModalOpen}
          title="Venue"
          options={venueSelectOptions}
          selectedValue={classroomId.trim() ? classroomId : "__none__"}
          onSelect={(v) => setClassroomId(v === "__none__" ? "" : v)}
          onClose={() => setVenueModalOpen(false)}
        />
        <MultiSelectModal
          visible={programsModalOpen}
          title="Programs"
          hint="Tap rows to select or clear. At least one is required."
          options={programSelectOptions}
          selectedValues={selectedGroupIds}
          onToggle={toggleGroup}
          onClose={() => setProgramsModalOpen(false)}
        />
        <MultiSelectModal
          visible={subjectsModalOpen}
          title="Subjects"
          hint="Optional. Tap rows to toggle."
          options={subjectSelectOptions}
          selectedValues={selectedSubjects}
          onToggle={toggleSubject}
          onClose={() => setSubjectsModalOpen(false)}
        />

        <View style={styles.field}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Marketing guest lecture"
            placeholderTextColor={theme.mutedForeground}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Description (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            multiline
            placeholderTextColor={theme.mutedForeground}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Programs</Text>
          {groupsForBooking.length === 0 ? (
            <Text style={styles.mutedSmall}>No programs in the system yet.</Text>
          ) : (
            <Pressable
              onPress={() => setProgramsModalOpen(true)}
              style={styles.selectTrigger}
              accessibilityRole="button"
              accessibilityLabel="Choose programs"
            >
              <Text
                style={[
                  styles.selectTriggerText,
                  selectedGroupIds.size === 0 && styles.selectTriggerPlaceholder,
                ]}
                numberOfLines={2}
              >
                {programTriggerLabel}
              </Text>
              <Text style={styles.selectChevron}>▼</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Subjects (optional)</Text>
          {subjectOptions.length === 0 ? (
            <Text style={styles.mutedSmall}>No subjects from enrollments yet.</Text>
          ) : (
            <Pressable
              onPress={() => setSubjectsModalOpen(true)}
              style={styles.selectTrigger}
              accessibilityRole="button"
              accessibilityLabel="Choose subjects"
            >
              <Text
                style={[
                  styles.selectTriggerText,
                  selectedSubjects.size === 0 && styles.selectTriggerPlaceholder,
                ]}
                numberOfLines={2}
              >
                {subjectTriggerLabel}
              </Text>
              <Text style={styles.selectChevron}>▼</Text>
            </Pressable>
          )}
        </View>

        <DatePickerField
          label="Event date"
          value={eventDate}
          onChange={setEventDate}
          minimumDate={startOfLocalDay(new Date())}
          containerStyle={styles.field}
        />

        <View style={styles.row}>
          <TimePickerField
            label="Start"
            value={startTime}
            onChange={setStartTime}
            referenceDateIso={eventDate}
            minuteInterval={15}
            containerStyle={[styles.field, styles.flex1]}
          />
          <TimePickerField
            label="End"
            value={endTime}
            onChange={setEndTime}
            referenceDateIso={eventDate}
            minuteInterval={15}
            containerStyle={[styles.field, styles.flex1]}
          />
        </View>

        {conflictWarning ? <Text style={styles.warn}>{conflictWarning}</Text> : null}

        <Pressable onPress={() => setInfraOpen((o) => !o)} style={styles.infraToggle}>
          <Text style={styles.infraToggleText}>
            {infraOpen ? "▼" : "▶"} Infrastructure (optional)
          </Text>
        </Pressable>

        {infraOpen ? (
          <View style={styles.infraBox}>
            <View style={styles.row}>
              <View style={styles.flex1}>
                <Text style={styles.label}>Mics</Text>
                <TextInput
                  style={styles.input}
                  value={infraMic}
                  onChangeText={setInfraMic}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={theme.mutedForeground}
                />
              </View>
              <View style={styles.flex1}>
                <Text style={styles.label}>Sofas</Text>
                <TextInput
                  style={styles.input}
                  value={infraSofa}
                  onChangeText={setInfraSofa}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={theme.mutedForeground}
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.flex1}>
                <Text style={styles.label}>Momento</Text>
                <TextInput
                  style={styles.input}
                  value={infraMomento}
                  onChangeText={setInfraMomento}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={theme.mutedForeground}
                />
              </View>
              <View style={styles.flex1}>
                <Text style={styles.label}>Bouquets</Text>
                <TextInput
                  style={styles.input}
                  value={infraBouquet}
                  onChangeText={setInfraBouquet}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={theme.mutedForeground}
                />
              </View>
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Video recording</Text>
              <Switch value={infraVideoRecording} onValueChange={setInfraVideoRecording} />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Photography</Text>
              <Switch value={infraPhotography} onValueChange={setInfraPhotography} />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Stage</Text>
              <Switch value={infraStage} onValueChange={setInfraStage} />
            </View>
          </View>
        ) : null}

        <Pressable
          onPress={() => !submitting && submit()}
          style={[styles.submitBtn, submitting && styles.dim]}
        >
          <Text style={styles.submitBtnText}>{submitting ? "Submitting…" : "Submit request"}</Text>
        </Pressable>

        <Text style={[styles.sectionTitle, { marginTop: 28 }]}>My requests</Text>
        {requests.length === 0 ? (
          <Text style={styles.muted}>No requests yet. Submit one above.</Text>
        ) : (
          requests.map((req) => (
            <Pressable key={req.id} onPress={() => setDetailReq(req)} style={styles.cardPress}>
              <RequestCard req={req} />
            </Pressable>
          ))
        )}
      </RefreshableScrollView>

      <BottomSheetModal
        visible={detailReq !== null}
        onClose={() => setDetailReq(null)}
        maxHeight="88%"
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalPad}>
            {detailReq ? (
              <>
                <Text style={styles.modalTitle}>{detailReq.title}</Text>
                <Text style={styles.modalMeta}>
                  {requestKindLabel(detailReq.request_kind)} ·{" "}
                  {requestStatusLabel(detailReq.status)}
                </Text>
                <Text style={styles.modalMeta}>
                  {format(
                    new Date(String(detailReq.event_date).split("T")[0] + "T12:00:00"),
                    "EEEE, MMM d, yyyy"
                  )}{" "}
                  · {String(detailReq.start_time).slice(0, 5)} –{" "}
                  {String(detailReq.end_time).slice(0, 5)}
                </Text>
                <Text style={styles.modalMeta}>
                  Room: {toTitleCase(detailReq.classroom?.name ?? "—")}
                </Text>
                <Text style={styles.modalMeta}>
                  Programs:{" "}
                  {detailReq.student_groups?.length
                    ? detailReq.student_groups.map((g) => g.name).join(", ")
                    : detailReq.student_group?.name ?? "—"}
                </Text>
                {decodeCalendarRequestSubjects(detailReq.subject ?? null).length > 0 ? (
                  <Text style={styles.modalMeta}>
                    Subjects: {decodeCalendarRequestSubjects(detailReq.subject ?? null).join(", ")}
                  </Text>
                ) : null}
                {detailReq.description ? (
                  <Text style={styles.modalBody}>{detailReq.description}</Text>
                ) : null}
                {detailReq.admin_note ? (
                  <Text style={styles.modalNote}>Admin note: {detailReq.admin_note}</Text>
                ) : null}
              </>
            ) : null}
        </ScrollView>
      </BottomSheetModal>
    </View>
  );
}

function RequestCard({ req }: { req: CalendarRequest }) {
  const subjects = decodeCalendarRequestSubjects(req.subject ?? null);
  const subjectLine =
    subjects.length > 0 ? subjects.join(", ") : req.student_group?.name ?? "—";
  const dateOnly = String(req.event_date).split("T")[0];
  const kind = requestKindLabel(req.request_kind);
  const status = requestStatusLabel(req.status);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{req.title}</Text>
      <Text style={styles.badge}>
        {kind} · {status}
      </Text>
      <Text style={styles.meta}>
        {format(new Date(dateOnly + "T12:00:00"), "MMM d, yyyy")} ·{" "}
        {String(req.start_time).slice(0, 5)} – {String(req.end_time).slice(0, 5)}
      </Text>
      <Text style={styles.meta}>Programs: {subjectLine}</Text>
      <Text style={styles.meta}>{req.classroom?.name ?? "Room TBD"}</Text>
      <Text style={styles.tapHint}>Tap for details</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0, backgroundColor: theme.background },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  lead: {
    fontSize: 13,
    color: theme.mutedForeground,
    lineHeight: 19,
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: theme.foreground, marginBottom: 12 },
  field: { marginBottom: 12 },
  label: { fontSize: 12, fontWeight: "600", color: theme.mutedForeground, marginBottom: 6 },
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
  selectTriggerPlaceholder: {
    color: theme.mutedForeground,
    fontWeight: "400",
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
  textArea: { minHeight: 80, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 10 },
  flex1: { flex: 1 },
  warn: { color: theme.destructive, fontSize: 13, marginBottom: 10, lineHeight: 18 },
  muted: { fontSize: 14, color: theme.mutedForeground },
  mutedSmall: { fontSize: 12, color: theme.mutedForeground, marginBottom: 8 },
  infraToggle: { paddingVertical: 10, marginBottom: 8 },
  infraToggleText: { fontSize: 14, fontWeight: "600", color: theme.primary },
  infraBox: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    backgroundColor: theme.accentBg,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  switchLabel: { fontSize: 14, color: theme.foreground },
  submitBtn: {
    backgroundColor: theme.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
  },
  submitBtnText: { color: theme.primaryForeground, fontWeight: "700", fontSize: 16 },
  dim: { opacity: 0.55 },
  cardPress: { marginBottom: 10 },
  card: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
  },
  cardTitle: { fontSize: 16, fontWeight: "600", color: theme.foreground },
  badge: { marginTop: 6, fontSize: 13, fontWeight: "500", color: theme.primary },
  meta: { marginTop: 4, fontSize: 13, color: theme.mutedForeground },
  tapHint: { marginTop: 8, fontSize: 12, fontWeight: "600", color: theme.primary },
  modalPad: { paddingBottom: 24, paddingTop: 4 },
  modalTitle: { fontSize: 20, fontWeight: "700", color: theme.foreground, marginBottom: 8 },
  modalMeta: { fontSize: 14, color: theme.mutedForeground, marginTop: 8, lineHeight: 20 },
  modalBody: { fontSize: 15, color: theme.foreground, marginTop: 14, lineHeight: 22 },
  modalNote: {
    fontSize: 14,
    color: theme.mutedForeground,
    marginTop: 14,
    fontStyle: "italic",
  },
});
