import { addDays, addWeeks, format, startOfWeek, subWeeks } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  AdminResourceAvailabilityPanel,
  type AdminResourceAvailabilityMode,
} from "../../components/AdminResourceAvailabilityPanel";
import { fetchClassroomsOrdered } from "../../lib/campus-calendar-fetch";
import { getSupabase } from "../../lib/supabase";
import type { Classroom, Profile } from "../../types";
import { theme } from "../../theme";
import { RefreshableScrollView } from "../../components/RefreshableScrollView";

export function AdminResourceAvailabilityScreen({
  profile: _profile,
  mode,
}: {
  profile: Profile;
  mode: AdminResourceAvailabilityMode;
}) {
  void _profile;
  const [cursor, setCursor] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const weekStart = useMemo(() => startOfWeek(cursor, { weekStartsOn: 1 }), [cursor]);
  const rangeTitle = `${format(weekStart, "MMM d")} – ${format(addDays(weekStart, 6), "MMM d, yyyy")}`;

  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadRooms = useCallback(async () => {
    const supabase = getSupabase();
    const rooms = await fetchClassroomsOrdered(supabase);
    setClassrooms(rooms);
  }, []);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadRooms();
    } finally {
      setRefreshing(false);
    }
  }, [loadRooms]);

  return (
    <RefreshableScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <View style={styles.weekRow}>
        <Pressable onPress={() => setCursor((c) => subWeeks(c, 1))} style={styles.weekBtn} hitSlop={8}>
          <Text style={styles.weekBtnText}>←</Text>
        </Pressable>
        <Text style={styles.weekTitle} numberOfLines={2}>
          {rangeTitle}
        </Text>
        <Pressable onPress={() => setCursor((c) => addWeeks(c, 1))} style={styles.weekBtn} hitSlop={8}>
          <Text style={styles.weekBtnText}>→</Text>
        </Pressable>
      </View>

      <AdminResourceAvailabilityPanel mode={mode} weekStart={weekStart} classrooms={classrooms} />
    </RefreshableScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 32 },
  weekRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 8,
  },
  weekBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
  },
  weekBtnText: { fontSize: 16, color: theme.foreground, fontWeight: "600" },
  weekTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "700",
    color: theme.foreground,
  },
});
