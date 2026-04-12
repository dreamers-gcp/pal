import { Ionicons } from "@expo/vector-icons";
import { addDays, format } from "date-fns";
import { useMemo } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import type { AgendaRow } from "../lib/calendar-agenda";
import { assignTimedLanes, buildTimeGridModel } from "../lib/calendar-time-grid";
import {
  availabilityBusyColor,
  colorForClassroom,
  facilityOverlayColor,
  taskStatusColors,
} from "../lib/calendar-colors";
import { facilityVenueLabel, FACILITY_TYPE_LABELS } from "../lib/facility-labels";
import type { CalendarRequest, Classroom, FacilityBooking, StudentTask } from "../types";
import { theme } from "../theme";

const TIME_GUTTER = 44;
const HEADER_H = 40;
const ALLDAY_H = 40;
const HOUR_HEIGHT = 34;
const HOURS = 24;
const GRID_BODY_H = HOURS * HOUR_HEIGHT;
/** Horizontal gap between side-by-side overlapping events (px). */
const EVENT_LANE_GAP = 2;
const COL_INNER_PAD = 2;

/** Solid fills + white labels — parity with web `react-big-calendar` + `student-calendar.css`. */
type BlockStyleColors = {
  bg: string;
  border: string;
  fg: string;
  borderWidth?: number;
  borderStyle?: "solid" | "dashed";
};

type TimedRender = {
  key: string;
  dayIndex: number;
  startMin: number;
  endMin: number;
  lane: number;
  laneCount: number;
  title: string;
  /** Omitted for admin availability overlay blocks. */
  row?: AgendaRow;
  colors: BlockStyleColors;
  onPress: () => void;
};

type AllDayRender = {
  key: string;
  dayIndex: number;
  title: string;
  colors: BlockStyleColors;
  onPress: () => void;
};

type Props = {
  mode: "week" | "day";
  /** Monday when `mode === "week"`; the visible day when `mode === "day"`. */
  rangeStart: Date;
  bookings: CalendarRequest[];
  facility: FacilityBooking[];
  tasks: StudentTask[];
  classrooms: Classroom[];
  onSelectEvent: (row: AgendaRow) => void;
  /**
   * When set, the grid shows only these approved “busy” blocks (admin resource availability).
   * `bookings` / `facility` / `tasks` are ignored for layout.
   */
  availability?: {
    timed: { id: string; title: string; dayIndex: number; startMin: number; endMin: number }[];
    allDay: { id: string; title: string; dayIndex: number }[];
  };
  onSelectAvailability?: (item: { id: string; title: string }) => void;
  /** Taller grid viewport (full-screen calendar mode); hides caption. */
  expandVertical?: boolean;
};

function blockColor(row: AgendaRow, classrooms: Classroom[]): BlockStyleColors {
  if (row.type === "class") {
    const c = colorForClassroom(classrooms, row.req.classroom_id);
    return { bg: c, border: c, fg: "#ffffff" };
  }
  if (row.type === "facility") {
    const c = facilityOverlayColor;
    return {
      bg: c,
      border: "rgba(255,255,255,0.35)",
      fg: "#ffffff",
      borderWidth: 2,
    };
  }
  const tc = taskStatusColors[row.t.status] ?? taskStatusColors.todo;
  return {
    bg: tc,
    border: "rgba(255,255,255,0.55)",
    fg: "#ffffff",
    borderWidth: 2,
    borderStyle: "dashed",
  };
}

/** Title only in the grid — full details in the sheet (matches agenda list). */
function eventTitle(row: AgendaRow): string {
  if (row.type === "class") return row.req.title;
  if (row.type === "facility") {
    const b = row.b;
    const typeLabel = FACILITY_TYPE_LABELS[b.facility_type] ?? b.facility_type;
    return `${typeLabel} · ${facilityVenueLabel(b.facility_type, b.venue_code)}`;
  }
  return row.t.title;
}

function formatTimeRange12h(startMin: number, endMin: number): string {
  const sh = Math.floor(startMin / 60);
  const sm = Math.round(startMin % 60);
  const eh = Math.floor(endMin / 60);
  const em = Math.round(endMin % 60);
  const s = new Date(2000, 0, 1, sh, sm, 0);
  const e = new Date(2000, 0, 1, eh, em, 0);
  return `${format(s, "h:mm a")} – ${format(e, "h:mm a")}`;
}

function gridIconName(row: AgendaRow | undefined): keyof typeof Ionicons.glyphMap {
  if (!row) return "calendar-outline";
  if (row.type === "class") return "calendar-outline";
  if (row.type === "facility") return "business-outline";
  return "list-outline";
}

function hourLabel(h: number): string {
  const d = new Date(2000, 0, 1, h, 0, 0, 0);
  return format(d, "h a");
}

export function ScheduleTimeGrid({
  mode,
  rangeStart,
  bookings,
  facility,
  tasks,
  classrooms,
  onSelectEvent,
  availability,
  onSelectAvailability,
  expandVertical = false,
}: Props) {
  const { width: winW, height: winH } = useWindowDimensions();
  const dayCount = mode === "week" ? 7 : 1;

  const { timedRender, allDayRender, gridCaption } = useMemo(() => {
    if (availability !== undefined) {
      const busy = availabilityBusyColor;
      const colors: BlockStyleColors = {
        bg: busy,
        border: "rgba(255,255,255,0.25)",
        fg: "#ffffff",
        borderWidth: 1,
      };
      const timed = assignTimedLanes(availability.timed).map((ev) => ({
        key: ev.id,
        dayIndex: ev.dayIndex,
        startMin: ev.startMin,
        endMin: ev.endMin,
        lane: ev.lane,
        laneCount: ev.laneCount,
        title: ev.title,
        colors,
        onPress: () => onSelectAvailability?.({ id: ev.id, title: ev.title }),
      }));
      const allDay = availability.allDay.map((a) => ({
        key: a.id,
        dayIndex: a.dayIndex,
        title: a.title,
        colors,
        onPress: () => onSelectAvailability?.({ id: a.id, title: a.title }),
      }));
      return {
        timedRender: timed,
        allDayRender: allDay,
        gridCaption:
          "Resource week — overlapping bookings appear in columns side by side. Tap a block for details.",
      };
    }
    const { timed, allDay } = buildTimeGridModel(rangeStart, dayCount, bookings, facility, tasks);
    const timedRender: TimedRender[] = timed.map((ev, i) => ({
      key: `ag-${i}-${ev.dayIndex}-${ev.startMin}`,
      dayIndex: ev.dayIndex,
      startMin: ev.startMin,
      endMin: ev.endMin,
      lane: ev.lane,
      laneCount: ev.laneCount,
      title: eventTitle(ev.row),
      row: ev.row,
      colors: blockColor(ev.row, classrooms),
      onPress: () => onSelectEvent(ev.row),
    }));
    const allDayRender: AllDayRender[] = allDay.map((a, i) => ({
      key: `ad-${i}-${a.dayIndex}-${eventTitle(a.row)}`,
      dayIndex: a.dayIndex,
      title: eventTitle(a.row),
      colors: blockColor(a.row, classrooms),
      onPress: () => onSelectEvent(a.row),
    }));
    return {
      timedRender,
      allDayRender,
      gridCaption:
        mode === "week"
          ? "Week view — overlapping events sit in columns beside each other. Tap a block for full details."
          : "Day view — overlapping events sit in columns beside each other. Tap a block for details.",
    };
  }, [
    availability,
    rangeStart,
    dayCount,
    bookings,
    facility,
    tasks,
    classrooms,
    onSelectEvent,
    onSelectAvailability,
    mode,
  ]);

  const innerW = Math.max(280, winW - 32);
  const colW =
    mode === "day"
      ? Math.max(200, innerW - TIME_GUTTER - 6)
      : Math.max(56, Math.floor((innerW - TIME_GUTTER - 6) / 7));

  const maxGridH = expandVertical
    ? Math.min(1100, Math.max(380, winH - 168))
    : Math.min(520, Math.max(280, winH * 0.44));

  const now = new Date();
  const todayKey = format(now, "yyyy-MM-dd");

  const allDayByDay = useMemo(() => {
    const m = new Map<number, AllDayRender[]>();
    for (const a of allDayRender) {
      const list = m.get(a.dayIndex) ?? [];
      list.push(a);
      m.set(a.dayIndex, list);
    }
    return m;
  }, [allDayRender]);

  const timedByDay = useMemo(() => {
    const m = new Map<number, TimedRender[]>();
    for (const ev of timedRender) {
      const list = m.get(ev.dayIndex) ?? [];
      list.push(ev);
      m.set(ev.dayIndex, list);
    }
    return m;
  }, [timedRender]);

  const dayIndices = Array.from({ length: dayCount }, (_, i) => i);

  return (
    <View style={[styles.wrap, expandVertical && styles.wrapExpanded]}>
      {!expandVertical ? <Text style={styles.gridCaption}>{gridCaption}</Text> : null}
      <ScrollView
        style={[
          styles.vertScroll,
          expandVertical ? styles.vertScrollExpanded : { maxHeight: maxGridH },
        ]}
        nestedScrollEnabled
        showsVerticalScrollIndicator
      >
        <View style={styles.gridRow}>
          <View style={{ width: TIME_GUTTER }}>
            <View style={{ height: HEADER_H }} />
            <View style={[styles.allDayGutter, { height: ALLDAY_H }]}>
              <Text style={styles.allDayGutterText} numberOfLines={2}>
                All-day
              </Text>
            </View>
            {Array.from({ length: HOURS }, (_, h) => (
              <View key={h} style={[styles.hourCell, { height: HOUR_HEIGHT }]}>
                <Text style={styles.hourText}>{hourLabel(h)}</Text>
              </View>
            ))}
          </View>

          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={mode === "week"}
            style={styles.hScroll}
            contentContainerStyle={{ flexDirection: "row" }}
          >
            {dayIndices.map((dayIndex) => {
              const dayDate = addDays(rangeStart, dayIndex);
              const dateKey = format(dayDate, "yyyy-MM-dd");
              const isTodayCol = dateKey === todayKey;
              const nowMinutes = now.getHours() * 60 + now.getMinutes();
              const showNowLine = isTodayCol;
              const dayTimed = timedByDay.get(dayIndex) ?? [];
              const dayAll = allDayByDay.get(dayIndex) ?? [];

              return (
                <View key={dateKey} style={{ width: colW }}>
                  <View style={[styles.colHeader, { height: HEADER_H }]}>
                    <Text style={styles.colHeaderDow}>{format(dayDate, "EEE")}</Text>
                    <Text style={[styles.colHeaderDom, isTodayCol && styles.colHeaderDomToday]}>
                      {format(dayDate, "d")}
                    </Text>
                  </View>

                  <View style={[styles.allDayStrip, { height: ALLDAY_H }]}>
                    {dayAll.map((a) => {
                      return (
                        <Pressable
                          key={a.key}
                          onPress={a.onPress}
                          style={[
                            styles.allDayChip,
                            {
                              backgroundColor: a.colors.bg,
                              borderColor: a.colors.border,
                              borderWidth: a.colors.borderWidth ?? 1,
                              borderStyle: a.colors.borderStyle ?? "solid",
                            },
                          ]}
                        >
                          <Text
                            style={[styles.allDayChipTitle, { color: a.colors.fg }]}
                            numberOfLines={2}
                          >
                            {a.title}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <View style={[styles.colBody, { height: GRID_BODY_H }]}>
                    {Array.from({ length: HOURS }, (_, h) => (
                      <View
                        key={h}
                        style={[styles.hourLine, { top: h * HOUR_HEIGHT, height: HOUR_HEIGHT }]}
                      />
                    ))}

                    {dayTimed.map((ev) => {
                      const blockTop = (ev.startMin / 60) * HOUR_HEIGHT;
                      const height = Math.max(
                        ((ev.endMin - ev.startMin) / 60) * HOUR_HEIGHT,
                        28
                      );
                      const n = Math.max(1, ev.laneCount);
                      const inner = Math.max(0, colW - COL_INNER_PAD * 2);
                      const slotW =
                        n <= 1
                          ? inner
                          : Math.max(
                              16,
                              Math.floor((inner - EVENT_LANE_GAP * (n - 1)) / n)
                            );
                      const leftPx =
                        COL_INNER_PAD + ev.lane * (slotW + EVENT_LANE_GAP);
                      const fg = ev.colors.fg;
                      return (
                        <Pressable
                          key={ev.key}
                          onPress={ev.onPress}
                          style={[
                            styles.eventBlock,
                            {
                              top: blockTop,
                              height,
                              left: leftPx,
                              width: slotW,
                              zIndex: 2,
                              backgroundColor: ev.colors.bg,
                              borderColor: ev.colors.border,
                              borderWidth: ev.colors.borderWidth ?? 1,
                              borderStyle: ev.colors.borderStyle ?? "solid",
                            },
                          ]}
                        >
                          <Text style={[styles.eventTime, { color: fg }]} numberOfLines={1}>
                            {formatTimeRange12h(ev.startMin, ev.endMin)}
                          </Text>
                          <View style={styles.eventTitleRow}>
                            <Ionicons
                              name={gridIconName(ev.row)}
                              size={11}
                              color={fg}
                              style={styles.eventIcon}
                            />
                            <Text style={[styles.eventTitle, { color: fg }]} numberOfLines={1}>
                              {ev.title}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}

                    {showNowLine ? (
                      <View
                        pointerEvents="none"
                        style={[
                          styles.nowLine,
                          {
                            top: Math.min(
                              GRID_BODY_H - 1,
                              Math.max(0, (nowMinutes / 60) * HOUR_HEIGHT)
                            ),
                          },
                        ]}
                      />
                    ) : null}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    backgroundColor: theme.card,
    overflow: "hidden",
  },
  wrapExpanded: {
    flex: 1,
    marginBottom: 0,
    minHeight: 0,
  },
  gridCaption: {
    fontSize: 11,
    color: theme.mutedForeground,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 6,
    lineHeight: 15,
  },
  vertScroll: {},
  vertScrollExpanded: { flex: 1 },
  gridRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  hScroll: { flexGrow: 1 },
  allDayGutter: {
    justifyContent: "center",
    paddingLeft: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  allDayGutterText: {
    fontSize: 9,
    fontWeight: "600",
    color: theme.mutedForeground,
    textTransform: "uppercase",
  },
  hourCell: {
    justifyContent: "flex-start",
    paddingTop: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  hourText: {
    fontSize: 10,
    color: theme.mutedForeground,
    fontVariant: ["tabular-nums"],
  },
  colHeader: {
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    backgroundColor: theme.accentBg,
  },
  allDayStrip: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    backgroundColor: theme.card,
    paddingVertical: 4,
    justifyContent: "flex-start",
  },
  colHeaderDow: { fontSize: 11, fontWeight: "600", color: theme.mutedForeground },
  colHeaderDom: { fontSize: 16, fontWeight: "700", color: theme.foreground, marginTop: 2 },
  colHeaderDomToday: { color: theme.primary },
  colBody: {
    position: "relative",
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    backgroundColor: theme.background,
  },
  hourLine: {
    position: "absolute",
    left: 0,
    right: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  allDayChip: {
    marginHorizontal: 2,
    marginBottom: 3,
    paddingHorizontal: 4,
    paddingVertical: 3,
    borderRadius: 4,
  },
  allDayChipTitle: { fontSize: 11, fontWeight: "600" },
  eventBlock: {
    position: "absolute",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 3,
    overflow: "hidden",
  },
  eventTime: {
    fontSize: 9,
    fontWeight: "500",
    lineHeight: 12,
    opacity: 0.95,
  },
  eventTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 1,
    minWidth: 0,
  },
  eventIcon: { marginTop: 1 },
  eventTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 10,
    fontWeight: "600",
    lineHeight: 13,
  },
  nowLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "#ea4335",
    zIndex: 50,
  },
});
