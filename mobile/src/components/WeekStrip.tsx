import { addDays, format, isSameDay } from "date-fns";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "../theme";

type Props = {
  /** Monday of the week (matches web calendar weekStartsOn: 1). */
  weekStart: Date;
  markedDateKeys: Set<string>;
};

export function WeekStrip({ weekStart, markedDateKeys }: Props) {
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );
  const today = new Date();

  return (
    <View style={styles.wrap}>
      {days.map((day) => {
        const key = format(day, "yyyy-MM-dd");
        const marked = markedDateKeys.has(key);
        const isTodayCell = isSameDay(day, today);
        return (
          <View key={key} style={[styles.cell, isTodayCell && styles.cellToday]}>
            <Text style={styles.dow}>{format(day, "EEE")}</Text>
            <Text style={[styles.num, isTodayCell && styles.numToday]}>{format(day, "d")}</Text>
            <View style={styles.dotRow}>{marked ? <View style={styles.dot} /> : <View style={styles.spacer} />}</View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginBottom: 14,
    backgroundColor: theme.card,
  },
  cell: { flex: 1, alignItems: "center" },
  cellToday: {
    marginHorizontal: 2,
    borderRadius: 10,
    paddingVertical: 4,
    backgroundColor: theme.activeNavBg,
    borderWidth: 1,
    borderColor: theme.activeGlyphBg,
  },
  dow: { fontSize: 10, fontWeight: "600", color: theme.mutedForeground },
  num: { fontSize: 15, fontWeight: "700", color: theme.foreground, marginTop: 2 },
  numToday: { color: theme.primary },
  dotRow: { height: 8, justifyContent: "center", marginTop: 4 },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.primary,
  },
  spacer: { width: 5, height: 5 },
});
