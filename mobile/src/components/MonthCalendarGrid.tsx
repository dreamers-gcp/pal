import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "../theme";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

type Props = {
  monthAnchor: Date;
  markedDateKeys: Set<string>;
  /** Larger cells + fills height (full-screen calendar only). */
  expandLayout?: boolean;
};

/** Read-only month grid (web month view); list of sessions lives below. */
export function MonthCalendarGrid({ monthAnchor, markedDateKeys, expandLayout = false }: Props) {
  const weeks = useMemo(() => {
    const start = startOfWeek(startOfMonth(monthAnchor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(monthAnchor), { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start, end });
    const rows: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      rows.push(days.slice(i, i + 7));
    }
    return rows;
  }, [monthAnchor]);

  const today = new Date();

  return (
    <View style={[styles.wrap, expandLayout && styles.wrapExpanded]}>
      <View style={styles.weekdayRow}>
        {WEEKDAYS.map((d) => (
          <Text key={d} style={[styles.weekday, expandLayout && styles.weekdayExpanded]}>
            {d}
          </Text>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={[styles.weekRow, expandLayout && styles.weekRowExpanded]}>
          {week.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const inMonth = isSameMonth(day, monthAnchor);
            const marked = markedDateKeys.has(key);
            const isTodayCell = isSameDay(day, today);
            return (
              <View
                key={key}
                style={[
                  styles.cell,
                  expandLayout && styles.cellExpanded,
                  isTodayCell && inMonth && styles.cellToday,
                ]}
              >
                <Text
                  style={[
                    styles.cellNum,
                    expandLayout && styles.cellNumExpanded,
                    !inMonth && styles.cellNumMuted,
                  ]}
                >
                  {format(day, "d")}
                </Text>
                <View style={styles.dotRow}>
                  {marked ? <View style={styles.dot} /> : <View style={styles.dotSpacer} />}
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    marginBottom: 14,
    backgroundColor: theme.card,
  },
  wrapExpanded: {
    flex: 1,
    marginBottom: 0,
    minHeight: 0,
    justifyContent: "center",
    paddingVertical: 8,
  },
  weekdayRow: { flexDirection: "row", marginBottom: 6 },
  weekday: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "600",
    color: theme.mutedForeground,
  },
  weekdayExpanded: { fontSize: 12 },
  weekRow: { flexDirection: "row" },
  weekRowExpanded: { flex: 1, minHeight: 0 },
  cell: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    margin: 1,
    paddingVertical: 4,
  },
  cellExpanded: {
    minHeight: 56,
  },
  cellToday: {
    borderWidth: 1,
    borderColor: "rgba(79, 70, 229, 0.35)",
    backgroundColor: "rgba(79, 70, 229, 0.06)",
  },
  cellNum: { fontSize: 14, fontWeight: "600", color: theme.foreground },
  cellNumExpanded: { fontSize: 17 },
  cellNumMuted: { color: theme.mutedForeground, opacity: 0.55 },
  dotRow: { height: 6, justifyContent: "center", marginTop: 2 },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.primary,
  },
  dotSpacer: { width: 5, height: 5 },
});
