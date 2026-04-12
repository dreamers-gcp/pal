import {
  addDays,
  addMonths,
  addWeeks,
  endOfDay,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CalendarAgenda, type ScheduleScope } from "../../components/CalendarAgenda";
import { SelectModal } from "../../components/SelectModal";
import {
  buildAgendaSectionsForInterval,
  buildAgendaSectionsForMonth,
  collectAgendaDateKeysInMonth,
} from "../../lib/calendar-agenda";
import { calendarWindowBounds } from "../../lib/calendar-window";
import {
  fetchApprovedFacilityBookings,
  fetchCampusApprovedCalendarRequests,
} from "../../lib/campus-calendar-fetch";
import { fetchProfessorRequests } from "../../lib/student-events-fetch";
import { getSupabase } from "../../lib/supabase";
import type { CalendarRequest, Classroom, FacilityBooking, Profile, StudentTask } from "../../types";
import { theme } from "../../theme";

type ViewMode = "all-rooms" | "my-schedule";

function mergeProfessorCalendarBookings(
  viewMode: ViewMode,
  roomFilter: string,
  requests: CalendarRequest[],
  allApproved: CalendarRequest[]
): CalendarRequest[] {
  if (viewMode === "my-schedule") return requests;

  const approvedIds = new Set(allApproved.map((r) => r.id));
  const mineNotInAll = requests.filter((r) => !approvedIds.has(r.id));
  const byId = new Map<string, CalendarRequest>();
  allApproved.forEach((r) => byId.set(r.id, r));
  mineNotInAll.forEach((r) => byId.set(r.id, r));
  const sorted = Array.from(byId.values()).sort((a, b) => {
    const d = a.event_date.localeCompare(b.event_date);
    if (d !== 0) return d;
    return a.start_time.localeCompare(b.start_time);
  });

  if (roomFilter) {
    return sorted.filter((r) => String(r.classroom_id ?? "") === roomFilter);
  }
  return sorted;
}

export function ProfessorCalendarScreen({
  profile,
  onOpenNewRequest,
}: {
  profile: Profile;
  /** Switches drawer to My Requests (in-app new request flow). */
  onOpenNewRequest?: () => void;
}) {
  const [scheduleScope, setScheduleScope] = useState<ScheduleScope>("week");
  const [cursor, setCursor] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("all-rooms");
  const [roomFilter, setRoomFilter] = useState("");
  const [requests, setRequests] = useState<CalendarRequest[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [allApproved, setAllApproved] = useState<CalendarRequest[]>([]);
  const [facility, setFacility] = useState<FacilityBooking[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [loadingAllApproved, setLoadingAllApproved] = useState(false);
  const [loadingFacility, setLoadingFacility] = useState(true);
  const [listRefreshing, setListRefreshing] = useState(false);
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [viewModeModalOpen, setViewModeModalOpen] = useState(false);

  const loadCore = useCallback(async (silent?: boolean) => {
    const supabase = getSupabase();
    if (!silent) setLoadingRequests(true);
    const [reqRows, classRes] = await Promise.all([
      fetchProfessorRequests(supabase, profile),
      supabase.from("classrooms").select("*").order("name"),
    ]);
    setRequests(reqRows);
    if (classRes.data) setClassrooms(classRes.data as Classroom[]);
    if (!silent) setLoadingRequests(false);
  }, [profile]);

  const loadFacility = useCallback(async (silent?: boolean) => {
    const supabase = getSupabase();
    if (!silent) setLoadingFacility(true);
    const { from, to } = calendarWindowBounds();
    const f = await fetchApprovedFacilityBookings(supabase, from, to);
    setFacility(f);
    if (!silent) setLoadingFacility(false);
  }, []);

  const loadAllApproved = useCallback(async (silent?: boolean) => {
    const supabase = getSupabase();
    if (!silent) setLoadingAllApproved(true);
    const { from, to } = calendarWindowBounds();
    const rows = await fetchCampusApprovedCalendarRequests(supabase, from, to);
    setAllApproved(rows);
    if (!silent) setLoadingAllApproved(false);
  }, []);

  const onListRefresh = useCallback(async () => {
    setListRefreshing(true);
    try {
      const extra =
        viewMode === "all-rooms" ? loadAllApproved(true) : Promise.resolve();
      await Promise.all([loadCore(true), loadFacility(true), extra]);
    } finally {
      setListRefreshing(false);
    }
  }, [viewMode, loadCore, loadFacility, loadAllApproved]);

  useEffect(() => {
    loadCore();
  }, [loadCore]);

  useEffect(() => {
    loadFacility();
  }, [loadFacility]);

  useEffect(() => {
    if (viewMode === "all-rooms") {
      loadAllApproved();
    }
  }, [viewMode, loadAllApproved]);

  const calendarBookings = useMemo(
    () => mergeProfessorCalendarBookings(viewMode, roomFilter, requests, allApproved),
    [viewMode, roomFilter, requests, allApproved]
  );

  const weekStart = useMemo(() => startOfWeek(cursor, { weekStartsOn: 1 }), [cursor]);
  const weekEnd = useMemo(() => endOfWeek(cursor, { weekStartsOn: 1 }), [cursor]);
  const visibleMonth = useMemo(() => startOfMonth(cursor), [cursor]);

  const sections = useMemo(() => {
    if (scheduleScope === "week") {
      return buildAgendaSectionsForInterval(weekStart, weekEnd, calendarBookings, facility, []);
    }
    if (scheduleScope === "day") {
      const d0 = startOfDay(cursor);
      return buildAgendaSectionsForInterval(d0, endOfDay(cursor), calendarBookings, facility, []);
    }
    return buildAgendaSectionsForMonth(visibleMonth, calendarBookings, facility, []);
  }, [scheduleScope, weekStart, weekEnd, cursor, visibleMonth, calendarBookings, facility]);

  const timeGrid = useMemo(() => {
    if (scheduleScope === "month") return null;
    return {
      mode: scheduleScope === "day" ? ("day" as const) : ("week" as const),
      rangeStart: scheduleScope === "day" ? startOfDay(cursor) : weekStart,
      bookings: calendarBookings,
      facility,
      tasks: [] as StudentTask[],
    };
  }, [scheduleScope, cursor, weekStart, calendarBookings, facility]);

  const monthVisual =
    scheduleScope === "month"
      ? {
          monthAnchor: visibleMonth,
          markedDateKeys: collectAgendaDateKeysInMonth(
            visibleMonth,
            calendarBookings,
            facility,
            []
          ),
        }
      : null;

  const rangeTitle =
    scheduleScope === "week"
      ? `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`
      : scheduleScope === "day"
        ? format(cursor, "EEEE, MMM d, yyyy")
        : format(visibleMonth, "MMMM yyyy");

  function onScheduleScopeChange(s: ScheduleScope) {
    setScheduleScope(s);
    if (s === "week") setCursor((c) => startOfWeek(c, { weekStartsOn: 1 }));
    else if (s === "month") setCursor((c) => startOfMonth(c));
    else setCursor((c) => startOfDay(c));
  }

  function onNavigatePrev() {
    if (scheduleScope === "week") setCursor((c) => subWeeks(c, 1));
    else if (scheduleScope === "day") setCursor((c) => subDays(c, 1));
    else setCursor((c) => subMonths(startOfMonth(c), 1));
  }

  function onNavigateNext() {
    if (scheduleScope === "week") setCursor((c) => addWeeks(c, 1));
    else if (scheduleScope === "day") setCursor((c) => addDays(c, 1));
    else setCursor((c) => addMonths(startOfMonth(c), 1));
  }

  const loading =
    loadingRequests ||
    loadingFacility ||
    (viewMode === "all-rooms" && loadingAllApproved);

  const roomFilterOptions = useMemo(
    () => [
      { value: "all", label: "All rooms" },
      ...classrooms.map((c) => ({ value: c.id, label: c.name })),
    ],
    [classrooms]
  );

  const roomFilterLabel = useMemo(() => {
    if (!roomFilter) return "All rooms";
    return classrooms.find((c) => c.id === roomFilter)?.name ?? "All rooms";
  }, [roomFilter, classrooms]);

  const viewModeOptions = useMemo(
    () => [
      { value: "all-rooms", label: "All rooms" },
      { value: "my-schedule", label: "My schedule" },
    ],
    []
  );

  const viewModeLabel = viewMode === "all-rooms" ? "All rooms" : "My schedule";

  const headerExtra = (
    <View style={styles.controls}>
      <Text style={styles.label}>View</Text>
      <Pressable
        onPress={() => setViewModeModalOpen(true)}
        style={styles.selectTrigger}
        accessibilityRole="button"
        accessibilityLabel="Calendar view"
      >
        <Text style={styles.selectTriggerText} numberOfLines={1}>
          {viewModeLabel}
        </Text>
        <Text style={styles.selectChevron}>▼</Text>
      </Pressable>
      <SelectModal
        visible={viewModeModalOpen}
        title="View"
        options={viewModeOptions}
        selectedValue={viewMode}
        onSelect={(v) => setViewMode(v as ViewMode)}
        onClose={() => setViewModeModalOpen(false)}
      />

      {viewMode === "all-rooms" ? (
        <>
          <Text style={styles.label}>Filter by room</Text>
          <Pressable
            onPress={() => setRoomModalOpen(true)}
            style={styles.selectTrigger}
            accessibilityRole="button"
            accessibilityLabel="Filter by room"
          >
            <Text style={styles.selectTriggerText} numberOfLines={1}>
              {roomFilterLabel}
            </Text>
            <Text style={styles.selectChevron}>▼</Text>
          </Pressable>
          <SelectModal
            visible={roomModalOpen}
            title="Filter by room"
            options={roomFilterOptions}
            selectedValue={roomFilter || "all"}
            onSelect={(v) => setRoomFilter(v === "all" ? "" : v)}
            onClose={() => setRoomModalOpen(false)}
          />
        </>
      ) : null}

      <Pressable onPress={() => onOpenNewRequest?.()} style={styles.ctaBtn}>
        <Text style={styles.ctaBtnText}>New classroom / event request</Text>
      </Pressable>
      <Text style={styles.ctaHint}>
        Opens <Text style={styles.ctaHintBold}>My Requests</Text> in this app — same submit flow as
        the web dashboard.
      </Text>
    </View>
  );

  const emptyBase =
    viewMode === "my-schedule"
      ? "Nothing in this range. Tap “New classroom / event request” to add one, or switch to All rooms."
      : "No events in this range for this filter. Pick another room or add a request from My Requests.";

  return (
    <View style={styles.root}>
      <CalendarAgenda
        loading={loading}
        scheduleScope={scheduleScope}
        onScheduleScopeChange={onScheduleScopeChange}
        rangeTitle={rangeTitle}
        onNavigatePrev={onNavigatePrev}
        onNavigateNext={onNavigateNext}
        monthVisual={monthVisual}
        timeGrid={timeGrid}
        sections={sections}
        emptyMessage={emptyBase}
        headerExtra={headerExtra}
        classrooms={classrooms}
        showClassRequestStatus={viewMode === "my-schedule"}
        listHeading={scheduleScope === "month" ? "Classes & sessions" : "Agenda list"}
        facilityHelpText="Facility blocks here are read-only. To request a class or event slot, use My Requests in this app."
        listRefreshing={listRefreshing}
        onListRefresh={onListRefresh}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0, backgroundColor: theme.background },
  controls: { marginBottom: 8 },
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
    marginBottom: 12,
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
  ctaBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: theme.primary,
    alignItems: "center",
    marginBottom: 6,
  },
  ctaBtnText: { color: theme.primaryForeground, fontWeight: "600", fontSize: 14 },
  ctaHint: {
    fontSize: 12,
    color: theme.mutedForeground,
    lineHeight: 17,
    marginBottom: 8,
  },
  ctaHintBold: { fontWeight: "600", color: theme.foreground },
});
