import { format } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SelectModal, type SelectOption } from "../../components/SelectModal";
import { RefreshableScrollView } from "../../components/RefreshableScrollView";
import {
  decodeCalendarRequestSubjects,
  eventMatchesAttendanceSubjectFilter,
  uniqueAttendanceSubjectLabels,
} from "../../lib/calendar-subject";
import { getSupabase } from "../../lib/supabase";
import type { AttendanceRecord, CalendarRequest, Profile } from "../../types";
import { theme } from "../../theme";

type Props = { profile: Profile };

interface EventAttendanceInfo {
  event: CalendarRequest;
  records: (AttendanceRecord & { student?: Profile })[];
  enrolledStudents: Profile[];
}

type CalendarRequestWithGroups = CalendarRequest & {
  student_groups?: { student_group?: { id: string } | null }[] | null;
};

function groupIdsForCalendarEvent(e: CalendarRequestWithGroups): string[] {
  const ids = new Set<string>();
  if (e.student_group_id) ids.add(e.student_group_id);
  for (const row of e.student_groups ?? []) {
    const id = row?.student_group?.id;
    if (id) ids.add(id);
  }
  return Array.from(ids);
}

const QUICK_FILTERS = [
  { id: "all" as const, label: "All" },
  { id: "today" as const, label: "Today" },
  { id: "upcoming" as const, label: "Upcoming" },
  { id: "past" as const, label: "Past" },
  { id: "low-attendance" as const, label: "Low" },
];

export function ProfessorAttendanceScreen({ profile }: Props) {
  const [data, setData] = useState<EventAttendanceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [overridingKey, setOverridingKey] = useState<string | null>(null);
  const [quickFilter, setQuickFilter] = useState<(typeof QUICK_FILTERS)[number]["id"]>("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);

  const fetchData = useCallback(
    async (silent?: boolean) => {
      if (!silent) setLoading(true);
      const supabase = getSupabase();
      const { data: events } = await supabase
        .from("calendar_requests")
        .select(
          "*, student_group:student_groups(*), classroom:classrooms(*), student_groups:calendar_request_groups(student_group:student_groups(id))"
        )
        .eq("status", "approved")
        .or(`professor_id.eq.${profile.id},professor_email.eq.${profile.email}`)
        .order("event_date", { ascending: false })
        .limit(50);

      if (!events || events.length === 0) {
        setData([]);
        if (!silent) setLoading(false);
        return;
      }

      const eventIds = events.map((e: { id: string }) => e.id);
      const { data: records } = await supabase
        .from("attendance_records")
        .select("*, student:profiles!attendance_records_student_id_fkey(*)")
        .in("event_id", eventIds);

      const recordsByEvent: Record<string, (AttendanceRecord & { student?: Profile })[]> = {};
      for (const r of records ?? []) {
        const row = r as AttendanceRecord & { student?: Profile };
        if (!recordsByEvent[row.event_id]) recordsByEvent[row.event_id] = [];
        recordsByEvent[row.event_id]!.push(row);
      }

      const allGroupIds = [
        ...new Set(
          events.flatMap((e: CalendarRequest) =>
            groupIdsForCalendarEvent(e as CalendarRequestWithGroups)
          )
        ),
      ];

      type MemberRow = { group_id: string; student?: Profile | null };
      let members: MemberRow[] = [];
      if (allGroupIds.length > 0) {
        const { data: m } = await supabase
          .from("student_group_members")
          .select("group_id, student:profiles!student_group_members_student_id_fkey(*)")
          .in("group_id", allGroupIds);
        members = (m ?? []) as unknown as MemberRow[];
      }

      function enrolledForEvent(ev: CalendarRequestWithGroups): Profile[] {
        const gids = new Set(groupIdsForCalendarEvent(ev));
        const seen = new Set<string>();
        const out: Profile[] = [];
        for (const row of members) {
          if (!gids.has(row.group_id)) continue;
          const student = row.student;
          if (!student || seen.has(student.id)) continue;
          seen.add(student.id);
          out.push(student);
        }
        return out;
      }

      const infos: EventAttendanceInfo[] = (events as CalendarRequest[]).map((e) => ({
        event: e,
        records: recordsByEvent[e.id] ?? [],
        enrolledStudents: enrolledForEvent(e as CalendarRequestWithGroups),
      }));

      setData(infos);
      if (!silent) setLoading(false);
    },
    [profile.id, profile.email]
  );

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchData(true);
    } finally {
      setRefreshing(false);
    }
  }, [fetchData]);

  async function setStudentAttendance(ev: CalendarRequest, student: Profile, present: boolean) {
    const key = `${ev.id}:${student.id}`;
    setOverridingKey(key);
    const supabase = getSupabase();
    try {
      if (present) {
        const { error } = await supabase.from("attendance_records").upsert(
          {
            student_id: student.id,
            event_id: ev.id,
            photo_path: `manual-override/${ev.id}/${student.id}`,
            similarity_score: 1,
            verified: true,
            marked_at: new Date().toISOString(),
          },
          { onConflict: "student_id,event_id" }
        );
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("attendance_records").upsert(
          {
            student_id: student.id,
            event_id: ev.id,
            photo_path: `manual-override-absent/${ev.id}/${student.id}`,
            similarity_score: 0,
            verified: false,
            marked_at: new Date().toISOString(),
          },
          { onConflict: "student_id,event_id" }
        );
        if (error) throw new Error(error.message);
      }
      await fetchData(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update attendance";
      Alert.alert("Attendance", msg);
    } finally {
      setOverridingKey(null);
    }
  }

  const subjectOptions = useMemo(
    () => uniqueAttendanceSubjectLabels(data.map((d) => d.event)),
    [data]
  );

  const subjectSelectOptions: SelectOption[] = useMemo(
    () => [
      { value: "all", label: "All subjects" },
      ...subjectOptions.map((s) => ({ value: s, label: s })),
    ],
    [subjectOptions]
  );

  const subjectFilterLabel =
    subjectFilter === "all"
      ? "All subjects"
      : subjectOptions.includes(subjectFilter)
        ? subjectFilter
        : "All subjects";

  const filteredData = useMemo(() => {
    const now = new Date();
    const today = format(now, "yyyy-MM-dd");

    return data.filter(({ event, records, enrolledStudents }) => {
      const eventDate = event.event_date;
      const total = enrolledStudents.length;
      const attended = enrolledStudents.filter((s) =>
        records.some((r) => r.student_id === s.id && r.verified)
      ).length;
      const pct = total > 0 ? Math.round((attended / total) * 100) : 0;

      if (!eventMatchesAttendanceSubjectFilter(event, subjectFilter)) return false;
      if (quickFilter === "today") return eventDate === today;
      if (quickFilter === "upcoming") return eventDate > today;
      if (quickFilter === "past") return eventDate < today;
      if (quickFilter === "low-attendance") return total > 0 && pct < 75;
      return true;
    });
  }, [data, quickFilter, subjectFilter]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>Loading classes…</Text>
      </View>
    );
  }

  if (data.length === 0) {
    return (
      <RefreshableScrollView
        style={styles.scroll}
        contentContainerStyle={styles.emptyWrap}
        refreshing={refreshing}
        onRefresh={onRefresh}
      >
        <Text style={styles.emptyTitle}>No class events</Text>
        <Text style={styles.emptySub}>
          Approved calendar requests where you are the instructor will show here.
        </Text>
      </RefreshableScrollView>
    );
  }

  return (
    <RefreshableScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <Text style={styles.pageTitle}>Class attendance</Text>
      <Text style={styles.pageSub}>
        See who attended each class. Tap a row to expand. Use Mark Present / Mark Absent to override.
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {QUICK_FILTERS.map((f) => (
          <Pressable
            key={f.id}
            onPress={() => setQuickFilter(f.id)}
            style={[styles.chip, quickFilter === f.id && styles.chipActive]}
          >
            <Text style={[styles.chipText, quickFilter === f.id && styles.chipTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Pressable
        onPress={() => setSubjectModalOpen(true)}
        style={styles.subjectTrigger}
        accessibilityRole="button"
      >
        <Text style={styles.subjectTriggerText} numberOfLines={1}>
          {subjectFilterLabel}
        </Text>
        <Text style={styles.chevron}>▼</Text>
      </Pressable>
      <SelectModal
        visible={subjectModalOpen}
        title="Subject"
        options={subjectSelectOptions}
        selectedValue={subjectFilter}
        onSelect={setSubjectFilter}
        onClose={() => setSubjectModalOpen(false)}
      />

      {filteredData.map(({ event, records, enrolledStudents }) => {
        const isExpanded = expanded === event.id;
        const recordByStudent = new Map(records.map((r) => [r.student_id, r]));
        const attendedCount = enrolledStudents.filter(
          (s) => recordByStudent.get(s.id)?.verified === true
        ).length;
        const totalStudents = enrolledStudents.length;
        const pct = totalStudents > 0 ? Math.round((attendedCount / totalStudents) * 100) : 0;

        return (
          <View key={event.id} style={styles.card}>
            <Pressable onPress={() => setExpanded(isExpanded ? null : event.id)}>
              <View style={styles.cardHead}>
                <View style={styles.cardTitleCol}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {event.title}
                  </Text>
                  <Text style={styles.cardDate}>
                    {format(new Date(event.event_date), "MMM d, yyyy")}
                  </Text>
                </View>
                <View style={styles.cardRight}>
                  <View
                    style={[
                      styles.pctBadge,
                      pct >= 75
                        ? styles.pctOk
                        : pct >= 50
                          ? styles.pctMid
                          : styles.pctLow,
                    ]}
                  >
                    <Text style={styles.pctBadgeText}>
                      {attendedCount}/{totalStudents} ({pct}%)
                    </Text>
                  </View>
                  <Text style={styles.expandHint}>{isExpanded ? "▲" : "▼"}</Text>
                </View>
              </View>
              <Text style={styles.meta}>
                {event.start_time.slice(0, 5)} – {event.end_time.slice(0, 5)} ·{" "}
                {event.classroom?.name ?? "—"}
              </Text>
              <Text style={styles.meta}>
                {decodeCalendarRequestSubjects(event.subject).join(", ") || "—"}
              </Text>
            </Pressable>

            {isExpanded ? (
              <View style={styles.expandBody}>
                {enrolledStudents.length === 0 ? (
                  <Text style={styles.muted}>No enrolled students for this class.</Text>
                ) : (
                  [...enrolledStudents]
                    .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""))
                    .map((student) => {
                      const record = recordByStudent.get(student.id);
                      const present = record?.verified === true;
                      const key = `${event.id}:${student.id}`;
                      const busy = overridingKey === key;
                      return (
                        <View key={student.id} style={styles.studentRow}>
                          <Text style={styles.studentName} numberOfLines={1}>
                            {present ? "✓ " : "✕ "}
                            {student.full_name || student.email}
                          </Text>
                          <View style={styles.studentActions}>
                            <View
                              style={[
                                styles.statusPill,
                                present ? styles.statusPresent : styles.statusAbsent,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.statusPillText,
                                  present ? styles.statusPresentText : styles.statusAbsentText,
                                ]}
                              >
                                {present ? "Present" : "Absent"}
                              </Text>
                            </View>
                            {present ? (
                              <Pressable
                                onPress={() => void setStudentAttendance(event, student, false)}
                                disabled={busy}
                                hitSlop={6}
                              >
                                <Text style={styles.linkMuted}>Mark absent</Text>
                              </Pressable>
                            ) : (
                              <Pressable
                                onPress={() => void setStudentAttendance(event, student, true)}
                                disabled={busy}
                                hitSlop={6}
                              >
                                <Text style={styles.linkPrimary}>Mark present</Text>
                              </Pressable>
                            )}
                          </View>
                        </View>
                      );
                    })
                )}
              </View>
            ) : null}
          </View>
        );
      })}

      {filteredData.length === 0 ? (
        <Text style={styles.noMatch}>No classes match the selected filters.</Text>
      ) : null}
    </RefreshableScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 32, paddingHorizontal: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  loadingText: { marginTop: 12, fontSize: 15, color: theme.mutedForeground },
  emptyWrap: { padding: 24, paddingTop: 48 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: theme.foreground },
  emptySub: { marginTop: 8, fontSize: 14, color: theme.mutedForeground, lineHeight: 21 },
  pageTitle: { fontSize: 20, fontWeight: "800", color: theme.foreground, marginBottom: 6 },
  pageSub: { fontSize: 13, color: theme.mutedForeground, lineHeight: 19, marginBottom: 14 },
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 12, paddingRight: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
  },
  chipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  chipText: { fontSize: 13, fontWeight: "600", color: theme.mutedForeground },
  chipTextActive: { color: theme.primaryForeground },
  subjectTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
    marginBottom: 16,
  },
  subjectTriggerText: { fontSize: 15, color: theme.foreground, flex: 1 },
  chevron: { fontSize: 12, color: theme.mutedForeground, marginLeft: 8 },
  card: {
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
    overflow: "hidden",
  },
  cardHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    padding: 14,
    paddingBottom: 6,
  },
  cardTitleCol: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: theme.foreground },
  cardDate: { fontSize: 13, color: theme.mutedForeground, marginTop: 4 },
  cardRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  pctBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  pctOk: { backgroundColor: "rgba(34, 197, 94, 0.15)" },
  pctMid: { backgroundColor: "rgba(234, 179, 8, 0.2)" },
  pctLow: { backgroundColor: "rgba(220, 38, 38, 0.12)" },
  pctBadgeText: { fontSize: 12, fontWeight: "700", color: theme.foreground },
  expandHint: { fontSize: 12, color: theme.mutedForeground },
  meta: { fontSize: 13, color: theme.mutedForeground, paddingHorizontal: 14, marginBottom: 4 },
  expandBody: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  muted: { fontSize: 13, color: theme.mutedForeground },
  studentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 8,
  },
  studentName: { flex: 1, fontSize: 15, color: theme.foreground },
  studentActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusPresent: { backgroundColor: "rgba(34, 197, 94, 0.15)" },
  statusAbsent: { backgroundColor: "rgba(220, 38, 38, 0.12)" },
  statusPillText: { fontSize: 12, fontWeight: "600" },
  statusPresentText: { color: "#15803d" },
  statusAbsentText: { color: theme.destructive },
  linkMuted: { fontSize: 13, fontWeight: "600", color: theme.mutedForeground, textDecorationLine: "underline" },
  linkPrimary: { fontSize: 13, fontWeight: "600", color: theme.primary, textDecorationLine: "underline" },
  noMatch: { textAlign: "center", marginTop: 20, fontSize: 14, color: theme.mutedForeground },
});
