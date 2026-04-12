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
import { StyleSheet, View } from "react-native";
import { CalendarAgenda, type ScheduleScope } from "../../components/CalendarAgenda";
import {
  buildAgendaSectionsForInterval,
  buildAgendaSectionsForMonth,
  collectAgendaDateKeysInMonth,
} from "../../lib/calendar-agenda";
import { calendarWindowBounds } from "../../lib/calendar-window";
import {
  fetchApprovedFacilityBookings,
  fetchCampusApprovedCalendarRequests,
  fetchClassroomsOrdered,
  fetchStudentTasksForCalendar,
} from "../../lib/campus-calendar-fetch";
import { getSupabase } from "../../lib/supabase";
import type { CalendarRequest, Classroom, FacilityBooking, Profile, StudentTask } from "../../types";
import { theme } from "../../theme";

export function StudentCalendarScreen({ profile }: { profile: Profile }) {
  const [scheduleScope, setScheduleScope] = useState<ScheduleScope>("week");
  const [cursor, setCursor] = useState(() => new Date());
  const [bookings, setBookings] = useState<CalendarRequest[]>([]);
  const [facility, setFacility] = useState<FacilityBooking[]>([]);
  const [tasks, setTasks] = useState<StudentTask[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [loadingFacility, setLoadingFacility] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingClassrooms, setLoadingClassrooms] = useState(true);
  const [listRefreshing, setListRefreshing] = useState(false);

  const load = useCallback(async (silent?: boolean) => {
    const supabase = getSupabase();
    const { from, to } = calendarWindowBounds();
    if (!silent) {
      setLoadingBookings(true);
      setLoadingFacility(true);
      setLoadingTasks(true);
      setLoadingClassrooms(true);
    }

    const [b, f, t, rooms] = await Promise.all([
      fetchCampusApprovedCalendarRequests(supabase, from, to),
      fetchApprovedFacilityBookings(supabase, from, to),
      fetchStudentTasksForCalendar(supabase, profile.id),
      fetchClassroomsOrdered(supabase),
    ]);

    setBookings(b);
    setFacility(f);
    setTasks(t);
    setClassrooms(rooms);
    if (!silent) {
      setLoadingBookings(false);
      setLoadingFacility(false);
      setLoadingTasks(false);
      setLoadingClassrooms(false);
    }
  }, [profile.id]);

  const onListRefresh = useCallback(async () => {
    setListRefreshing(true);
    try {
      await load(true);
    } finally {
      setListRefreshing(false);
    }
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  const weekStart = useMemo(() => startOfWeek(cursor, { weekStartsOn: 1 }), [cursor]);
  const weekEnd = useMemo(() => endOfWeek(cursor, { weekStartsOn: 1 }), [cursor]);
  const visibleMonth = useMemo(() => startOfMonth(cursor), [cursor]);

  const sections = useMemo(() => {
    if (scheduleScope === "week") {
      return buildAgendaSectionsForInterval(weekStart, weekEnd, bookings, facility, tasks);
    }
    if (scheduleScope === "day") {
      const d0 = startOfDay(cursor);
      return buildAgendaSectionsForInterval(d0, endOfDay(cursor), bookings, facility, tasks);
    }
    return buildAgendaSectionsForMonth(visibleMonth, bookings, facility, tasks);
  }, [scheduleScope, weekStart, weekEnd, cursor, visibleMonth, bookings, facility, tasks]);

  const timeGrid = useMemo(() => {
    if (scheduleScope === "month") return null;
    return {
      mode: scheduleScope === "day" ? ("day" as const) : ("week" as const),
      rangeStart: scheduleScope === "day" ? startOfDay(cursor) : weekStart,
      bookings,
      facility,
      tasks,
    };
  }, [scheduleScope, cursor, weekStart, bookings, facility, tasks]);

  const monthVisual =
    scheduleScope === "month"
      ? {
          monthAnchor: visibleMonth,
          markedDateKeys: collectAgendaDateKeysInMonth(
            visibleMonth,
            bookings,
            facility,
            tasks
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
    loadingBookings || loadingFacility || loadingTasks || loadingClassrooms;

  const empty =
    scheduleScope === "week"
      ? "No classes or bookings this week in the loaded range. Try another week or switch views."
      : scheduleScope === "day"
        ? "Nothing scheduled this day in the loaded range."
        : "Nothing scheduled this month in the loaded range.";

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
        emptyMessage={empty}
        classrooms={classrooms}
        showClassRequestStatus={false}
        listHeading={scheduleScope === "month" ? "Classes & sessions" : "Agenda list"}
        listRefreshing={listRefreshing}
        onListRefresh={onListRefresh}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0, backgroundColor: theme.background },
});
