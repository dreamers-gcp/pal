import type { ReactNode } from "react";
import { format } from "date-fns";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BottomSheetModal } from "./BottomSheetModal";
import { classroomDisplayName, professorCalendarLine } from "../lib/calendar-display";
import { decodeCalendarRequestSubjects } from "../lib/calendar-subject";
import type { AgendaDaySection, AgendaRow } from "../lib/calendar-agenda";
import { formatCalendarTimeHm } from "../lib/event-datetime";
import {
  colorForClassroom,
  facilityOverlayColor,
  taskStatusColors,
} from "../lib/calendar-colors";
import { facilityVenueLabel, FACILITY_TYPE_LABELS } from "../lib/facility-labels";
import { toTitleCase } from "../lib/format-text";
import { requestStatusLabel } from "../lib/request-display";
import type { CalendarRequest, Classroom, FacilityBooking, StudentTask } from "../types";
import { MonthCalendarGrid } from "./MonthCalendarGrid";
import { ScheduleTimeGrid } from "./ScheduleTimeGrid";
import { theme } from "../theme";

export type ScheduleScope = "day" | "week" | "month";

type Props = {
  loading: boolean;
  /** Default on web is week view. */
  scheduleScope: ScheduleScope;
  onScheduleScopeChange: (s: ScheduleScope) => void;
  rangeTitle: string;
  onNavigatePrev: () => void;
  onNavigateNext: () => void;
  /** Month grid dots; only used when `scheduleScope === "month"`. */
  monthVisual: { monthAnchor: Date; markedDateKeys: Set<string> } | null;
  /** Google Calendar–style time grid (web parity); omit in month view. */
  timeGrid?: {
    mode: "week" | "day";
    rangeStart: Date;
    bookings: CalendarRequest[];
    facility: FacilityBooking[];
    tasks: StudentTask[];
  } | null;
  sections: AgendaDaySection[];
  emptyMessage: string;
  /** Shown above the session list (web: events in grid + list below). */
  listHeading?: string;
  hint?: string;
  headerExtra?: ReactNode;
  footer?: ReactNode;
  classrooms: Classroom[];
  showClassRequestStatus?: boolean;
  facilityHelpText?: string;
  /** Pull-to-refresh on the main calendar scroll (optional). */
  listRefreshing?: boolean;
  onListRefresh?: () => void | Promise<void>;
};

export function CalendarAgenda({
  loading,
  scheduleScope,
  onScheduleScopeChange,
  rangeTitle,
  onNavigatePrev,
  onNavigateNext,
  monthVisual,
  timeGrid = null,
  sections,
  emptyMessage,
  listHeading = "Classes & sessions",
  hint,
  headerExtra,
  footer,
  classrooms,
  showClassRequestStatus,
  facilityHelpText,
  listRefreshing,
  onListRefresh,
}: Props) {
  const [detailRow, setDetailRow] = useState<AgendaRow | null>(null);

  const refreshControlMain = useMemo(
    () =>
      onListRefresh != null ? (
        <RefreshControl
          refreshing={Boolean(listRefreshing)}
          onRefresh={() => void onListRefresh()}
          colors={[theme.primary]}
          tintColor={theme.primary}
        />
      ) : undefined,
    [listRefreshing, onListRefresh]
  );

  function renderEmbeddedAgendaBody() {
    const k = "m";
    return (
      <>
        <View style={styles.scopeRow}>
          <Pressable
            onPress={() => onScheduleScopeChange("day")}
            style={[styles.scopeBtn, scheduleScope === "day" && styles.scopeBtnOn]}
          >
            <Text style={[styles.scopeText, scheduleScope === "day" && styles.scopeTextOn]}>
              Day
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onScheduleScopeChange("week")}
            style={[styles.scopeBtn, scheduleScope === "week" && styles.scopeBtnOn]}
          >
            <Text style={[styles.scopeText, scheduleScope === "week" && styles.scopeTextOn]}>
              Week
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onScheduleScopeChange("month")}
            style={[styles.scopeBtn, scheduleScope === "month" && styles.scopeBtnOn]}
          >
            <Text style={[styles.scopeText, scheduleScope === "month" && styles.scopeTextOn]}>
              Month
            </Text>
          </Pressable>
        </View>

        <View style={styles.monthRow}>
          <Pressable onPress={onNavigatePrev} style={styles.monthBtn} hitSlop={8}>
            <Text style={styles.monthBtnText}>←</Text>
          </Pressable>
          <Text style={styles.monthTitle} numberOfLines={2}>
            {rangeTitle}
          </Text>
          <Pressable onPress={onNavigateNext} style={styles.monthBtn} hitSlop={8}>
            <Text style={styles.monthBtnText}>→</Text>
          </Pressable>
        </View>

        {headerExtra}

        {!loading && timeGrid ? (
          <ScheduleTimeGrid
            mode={timeGrid.mode}
            rangeStart={timeGrid.rangeStart}
            bookings={timeGrid.bookings}
            facility={timeGrid.facility}
            tasks={timeGrid.tasks}
            classrooms={classrooms}
            onSelectEvent={setDetailRow}
          />
        ) : null}
        {!loading && scheduleScope === "month" && monthVisual ? (
          <MonthCalendarGrid
            monthAnchor={monthVisual.monthAnchor}
            markedDateKeys={monthVisual.markedDateKeys}
          />
        ) : null}

        {hint ? <Text style={styles.hint}>{hint}</Text> : null}

        <Text style={styles.listHeading}>{listHeading}</Text>

        {loading ? (
          <View style={styles.centerPad}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : sections.length === 0 ? (
          <Text style={styles.empty}>{emptyMessage}</Text>
        ) : (
          sections.map((day) => (
            <View key={`${k}-${day.dateKey}`} style={styles.dayBlock}>
              <Text style={styles.dayTitle}>{day.dateLabel}</Text>
              {day.rows.map((row, i) => (
                <Pressable
                  key={`${k}-${day.dateKey}-${i}`}
                  onPress={() => setDetailRow(row)}
                  style={({ pressed }) => [pressed && styles.rowPressed]}
                >
                  <SessionListRow row={row} classrooms={classrooms} />
                </Pressable>
              ))}
            </View>
          ))
        )}

        {footer}
      </>
    );
  }

  return (
    <View style={styles.outer}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
        refreshControl={refreshControlMain}
      >
        {renderEmbeddedAgendaBody()}
      </ScrollView>

      <BottomSheetModal
        visible={detailRow !== null}
        onClose={() => setDetailRow(null)}
        maxHeight="88%"
      >
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {detailRow ? (
            <DetailSheetBody
              row={detailRow}
              classrooms={classrooms}
              showClassRequestStatus={showClassRequestStatus}
              facilityHelpText={facilityHelpText}
            />
          ) : null}
        </ScrollView>
      </BottomSheetModal>
    </View>
  );
}

function SessionListRow({ row, classrooms }: { row: AgendaRow; classrooms: Classroom[] }) {
  if (row.type === "class") {
    const r = row.req;
    const color = colorForClassroom(classrooms, r.classroom_id);
    return (
      <View style={[styles.card, styles.cardClass, { borderLeftColor: color, borderLeftWidth: 4 }]}>
        <Text style={styles.cardTitle}>{r.title}</Text>
        <Text style={styles.cardTap}>Tap for details</Text>
      </View>
    );
  }

  if (row.type === "facility") {
    const b = row.b;
    const typeLabel = FACILITY_TYPE_LABELS[b.facility_type] ?? b.facility_type;
    const venue = facilityVenueLabel(b.facility_type, b.venue_code);
    return (
      <View
        style={[
          styles.card,
          styles.cardFacility,
          { borderLeftColor: facilityOverlayColor, borderLeftWidth: 4 },
        ]}
      >
        <Text style={styles.cardTitle}>
          {typeLabel} · {venue}
        </Text>
        <Text style={styles.cardTap}>Tap for details</Text>
      </View>
    );
  }

  const t = row.t;
  const tc = taskStatusColors[t.status] ?? taskStatusColors.todo;
  return (
    <View style={[styles.card, styles.cardTask, { borderLeftColor: tc, borderLeftWidth: 4 }]}>
      <Text style={styles.cardTitle}>{t.title}</Text>
      <Text style={styles.cardTap}>Tap for details</Text>
    </View>
  );
}

function DetailSheetBody({
  row,
  classrooms,
  showClassRequestStatus,
  facilityHelpText,
}: {
  row: AgendaRow;
  classrooms: Classroom[];
  showClassRequestStatus?: boolean;
  facilityHelpText?: string;
}) {
  if (row.type === "class") {
    const r = row.req;
    const color = colorForClassroom(classrooms, r.classroom_id);
    const subjects = decodeCalendarRequestSubjects(r.subject ?? null);
    const groupNames =
      r.student_groups && r.student_groups.length > 0
        ? r.student_groups.map((g) => g.name).join(", ")
        : r.student_group?.name ?? "—";
    const professorDisplay = professorCalendarLine(r);
    const roomLabel = toTitleCase(classroomDisplayName(r, classrooms));
    const dateOnly = String(r.event_date).split("T")[0];
    return (
      <View style={styles.detailInner}>
        <View style={[styles.detailSwatch, { backgroundColor: color }]} />
        <Text style={styles.detailTitle}>{r.title}</Text>
        <Text style={styles.detailSub}>
          {format(new Date(dateOnly + "T12:00:00"), "EEEE, MMMM d")}
        </Text>
        <View style={styles.detailBlock}>
          <Text style={styles.detailLabel}>Room</Text>
          <Text style={styles.detailValue}>{roomLabel}</Text>
          <Text style={styles.detailLabel}>Professor</Text>
          <Text style={styles.detailValue}>{toTitleCase(professorDisplay)}</Text>
          <Text style={styles.detailLabel}>Groups</Text>
          <Text style={styles.detailValue}>{toTitleCase(groupNames)}</Text>
          {subjects.length > 0 ? (
            <>
              <Text style={styles.detailLabel}>Subject</Text>
              <Text style={styles.detailValue}>{subjects.join(", ")}</Text>
            </>
          ) : null}
          <Text style={styles.detailLabel}>Time</Text>
          <Text style={styles.detailValue}>
            {formatCalendarTimeHm(r.start_time)} – {formatCalendarTimeHm(r.end_time)}
          </Text>
          {showClassRequestStatus ? (
            <>
              <Text style={styles.detailLabel}>Status</Text>
              <Text style={styles.detailValue}>{requestStatusLabel(r.status)}</Text>
            </>
          ) : null}
          {r.description ? (
            <>
              <Text style={styles.detailLabel}>Description</Text>
              <Text style={styles.detailValue}>{r.description}</Text>
            </>
          ) : null}
        </View>
      </View>
    );
  }

  if (row.type === "facility") {
    const b = row.b;
    const typeLabel = FACILITY_TYPE_LABELS[b.facility_type] ?? b.facility_type;
    const venue = facilityVenueLabel(b.facility_type, b.venue_code);
    const who = b.requester?.full_name ?? b.requester_email ?? "—";
    return (
      <View style={styles.detailInner}>
        <View style={[styles.detailSwatch, { backgroundColor: facilityOverlayColor }]} />
        <Text style={styles.detailKicker}>Campus facility</Text>
        <Text style={styles.detailTitle}>{typeLabel}</Text>
        <Text style={styles.detailSub}>
          {format(new Date(`${String(b.booking_date).split("T")[0]}T12:00:00`), "EEEE, MMMM d")}
        </Text>
        <View style={styles.detailBlock}>
          <Text style={styles.detailLabel}>Venue</Text>
          <Text style={styles.detailValue}>{venue}</Text>
          <Text style={styles.detailLabel}>Time</Text>
          <Text style={styles.detailValue}>
            {formatCalendarTimeHm(b.start_time)} – {formatCalendarTimeHm(b.end_time)}
          </Text>
          <Text style={styles.detailLabel}>Booked by</Text>
          <Text style={styles.detailValue}>
            {who.includes("@") ? who : toTitleCase(who)}
          </Text>
          {b.purpose ? (
            <>
              <Text style={styles.detailLabel}>Purpose</Text>
              <Text style={styles.detailValue}>{b.purpose}</Text>
            </>
          ) : null}
          <Text style={styles.detailHint}>
            {facilityHelpText ??
              "Book a facility from Campus facilities on the web when available."}
          </Text>
        </View>
      </View>
    );
  }

  const t = row.t;
  const tc = taskStatusColors[t.status] ?? taskStatusColors.todo;
  const due = String(t.due_date).split("T")[0];
  return (
    <View style={styles.detailInner}>
      <View style={[styles.detailSwatch, { backgroundColor: tc }]} />
      <Text style={styles.detailKicker}>My task</Text>
      <Text style={styles.detailTitle}>{t.title}</Text>
      <Text style={styles.detailSub}>
        Due {format(new Date(due + "T12:00:00"), "EEEE, MMMM d, yyyy")}
      </Text>
      <View style={styles.detailBlock}>
        <Text style={styles.detailLabel}>Status</Text>
        <Text style={styles.detailValue}>
          {t.status === "in_progress"
            ? "In progress"
            : t.status === "completed"
              ? "Completed"
              : "To do"}
        </Text>
        {t.description ? (
          <>
            <Text style={styles.detailLabel}>Notes</Text>
            <Text style={styles.detailValue}>{t.description}</Text>
          </>
        ) : null}
        <Text style={styles.detailHint}>Manage tasks in Task Tracker on the web.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, minHeight: 0, minWidth: 0 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 40 },
  scopeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
    minWidth: 0,
  },
  scopeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    flex: 1,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
  },
  scopeBtnOn: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  scopeText: { fontSize: 14, fontWeight: "600", color: theme.foreground },
  scopeTextOn: { color: theme.primaryForeground },
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  monthBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: theme.accentBg,
  },
  monthBtnText: { fontSize: 16, color: theme.foreground, fontWeight: "600" },
  monthTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: theme.foreground,
    paddingHorizontal: 8,
  },
  hint: {
    fontSize: 12,
    color: theme.mutedForeground,
    lineHeight: 17,
    marginBottom: 12,
  },
  listHeading: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.foreground,
    marginBottom: 10,
  },
  centerPad: { paddingVertical: 24, alignItems: "center" },
  empty: { fontSize: 14, color: theme.mutedForeground, textAlign: "center", marginTop: 8 },
  dayBlock: { marginBottom: 18 },
  dayTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.mutedForeground,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  rowPressed: { opacity: 0.92 },
  card: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    paddingLeft: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
    backgroundColor: theme.card,
    borderColor: theme.border,
  },
  cardClass: {},
  cardFacility: {
    backgroundColor: "rgba(13, 148, 136, 0.06)",
    borderColor: "rgba(13, 148, 136, 0.25)",
  },
  cardTask: {
    backgroundColor: "rgba(234, 179, 8, 0.06)",
    borderColor: "rgba(234, 179, 8, 0.3)",
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: theme.foreground },
  cardTap: { fontSize: 12, color: theme.mutedForeground, marginTop: 6, fontWeight: "500" },
  detailInner: { paddingBottom: 16 },
  detailSwatch: { width: 36, height: 6, borderRadius: 3, marginBottom: 10 },
  detailKicker: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  detailTitle: { fontSize: 20, fontWeight: "700", color: theme.foreground, marginTop: 4 },
  detailSub: { fontSize: 14, color: theme.mutedForeground, marginTop: 6 },
  detailBlock: { marginTop: 16, gap: 0 },
  detailLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.mutedForeground,
    marginTop: 12,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  detailValue: { fontSize: 15, color: theme.foreground, marginTop: 4, lineHeight: 22 },
  detailHint: { fontSize: 12, color: theme.mutedForeground, marginTop: 16, lineHeight: 18 },
});
