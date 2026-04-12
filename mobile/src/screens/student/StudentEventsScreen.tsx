import { format } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BottomSheetModal } from "../../components/BottomSheetModal";
import { RefreshableScrollView } from "../../components/RefreshableScrollView";
import { SelectModal } from "../../components/SelectModal";
import { professorCalendarLine } from "../../lib/calendar-display";
import { decodeCalendarRequestSubjects } from "../../lib/calendar-subject";
import { toTitleCase } from "../../lib/format-text";
import {
  eventEndDateTime,
  eventStartDateTime,
  formatCalendarTimeHm,
  isEventOngoing,
} from "../../lib/event-datetime";
import {
  fetchApprovedEventsForStudent,
  resolveStudentGroupIds,
} from "../../lib/student-events-fetch";
import { getSupabase } from "../../lib/supabase";
import type { CalendarRequest, Profile } from "../../types";
import { theme } from "../../theme";

export function StudentEventsScreen({ profile }: { profile: Profile }) {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<CalendarRequest[]>([]);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [groupIdToName, setGroupIdToName] = useState<Record<string, string>>({});
  const [filterSubject, setFilterSubject] = useState("all");
  const [now, setNow] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [detailEvent, setDetailEvent] = useState<CalendarRequest | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async (silent?: boolean) => {
    if (!silent) setLoading(true);
    const supabase = getSupabase();
    try {
      const { groupIds: gids, groupIdToName: map } = await resolveStudentGroupIds(
        supabase,
        profile
      );
      setGroupIds(gids);
      setGroupIdToName(map);
      const ev = await fetchApprovedEventsForStudent(supabase, gids);
      setEvents(ev);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [profile]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(true);
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered =
    filterSubject === "all"
      ? events
      : events.filter((e) => e.student_group_id === filterSubject);

  const clockMs = now?.getTime() ?? 0;
  const upcoming = filtered.filter((e) => clockMs < eventEndDateTime(e).getTime());
  const past = filtered.filter((e) => clockMs >= eventEndDateTime(e).getTime());

  const upcomingSorted = useMemo(() => {
    const list = [...upcoming];
    list.sort((a, b) => {
      const ao = isEventOngoing(now, a) ? 0 : 1;
      const bo = isEventOngoing(now, b) ? 0 : 1;
      if (ao !== bo) return ao - bo;
      return eventStartDateTime(a).getTime() - eventStartDateTime(b).getTime();
    });
    return list;
  }, [upcoming, now]);

  const pastSorted = useMemo(() => {
    return [...past].sort(
      (a, b) => eventEndDateTime(b).getTime() - eventEndDateTime(a).getTime()
    );
  }, [past]);

  const subjectFilterOptions = useMemo(
    () => [
      { value: "all", label: "All subjects" },
      ...groupIds.map((gid) => ({
        value: gid,
        label: groupIdToName[gid] ?? gid,
      })),
    ],
    [groupIds, groupIdToName]
  );

  const subjectFilterLabel =
    filterSubject === "all" ? "All subjects" : (groupIdToName[filterSubject] ?? filterSubject);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingHint}>Loading your events…</Text>
      </View>
    );
  }

  if (groupIds.length === 0) {
    return (
      <RefreshableScrollView
        style={styles.scroll}
        contentContainerStyle={styles.bannerScroll}
        refreshing={refreshing}
        onRefresh={onRefresh}
      >
        <View style={styles.banner}>
          <View style={styles.bannerIconWrap}>
            <Text style={styles.bannerIcon}>◇</Text>
          </View>
          <Text style={styles.bannerTitle}>No program assigned yet</Text>
          <Text style={styles.bannerBody}>
            When your admin adds you to a program on the enrollment roster, your classes and events
            will show up here—same as the web dashboard.
          </Text>
          <Text style={styles.bannerEmail}>{profile.email}</Text>
        </View>
      </RefreshableScrollView>
    );
  }

  return (
    <>
    <RefreshableScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      {groupIds.length > 1 && (
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Subject</Text>
          <Pressable
            onPress={() => setSubjectModalOpen(true)}
            style={styles.selectTrigger}
            accessibilityRole="button"
            accessibilityLabel="Filter by subject"
          >
            <Text style={styles.selectTriggerText} numberOfLines={2}>
              {subjectFilterLabel}
            </Text>
            <Text style={styles.selectChevron}>▾</Text>
          </Pressable>
          <SelectModal
            visible={subjectModalOpen}
            title="Subject"
            options={subjectFilterOptions}
            selectedValue={filterSubject}
            onSelect={setFilterSubject}
            onClose={() => setSubjectModalOpen(false)}
          />
        </View>
      )}

      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderLeft}>
          <View style={styles.sectionAccent} />
          <Text style={styles.sectionTitle}>Upcoming &amp; ongoing</Text>
        </View>
        <View style={styles.sectionCountPill}>
          <Text style={styles.sectionCountText}>{upcomingSorted.length}</Text>
        </View>
      </View>
      {upcomingSorted.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>You&apos;re all clear</Text>
          <Text style={styles.emptyText}>
            No upcoming or ongoing sessions right now. Pull down to refresh, or check Calendar for the
            full month view.
          </Text>
        </View>
      ) : (
        upcomingSorted.map((event) => (
          <Pressable
            key={event.id}
            onPress={() => setDetailEvent(event)}
            style={styles.cardPress}
            accessibilityRole="button"
            accessibilityLabel={`Event: ${event.title}`}
            accessibilityHint="Opens full details"
          >
            <View style={styles.cardRow}>
              <View style={styles.cardRowMain}>
                <EventCard event={event} now={now} />
              </View>
              <View style={styles.cardChevronWrap} pointerEvents="none" importantForAccessibility="no">
                <Text style={styles.cardChevron}>›</Text>
              </View>
            </View>
          </Pressable>
        ))
      )}

      <View style={[styles.sectionHeader, styles.sectionHeaderPast]}>
        <View style={styles.sectionHeaderLeft}>
          <View style={[styles.sectionAccent, styles.sectionAccentMuted]} />
          <Text style={[styles.sectionTitle, styles.sectionTitleMuted]}>Past</Text>
        </View>
        <View style={[styles.sectionCountPill, styles.sectionCountPillMuted]}>
          <Text style={styles.sectionCountTextMuted}>{pastSorted.length}</Text>
        </View>
      </View>
      {pastSorted.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No history yet</Text>
          <Text style={styles.emptyText}>Past events will appear here after they end.</Text>
        </View>
      ) : (
        pastSorted.slice(0, 40).map((event) => (
          <Pressable
            key={event.id}
            onPress={() => setDetailEvent(event)}
            style={styles.cardPress}
            accessibilityRole="button"
            accessibilityLabel={`Event: ${event.title}`}
            accessibilityHint="Opens full details"
          >
            <View style={styles.cardRow}>
              <View style={styles.cardRowMain}>
                <EventCard event={event} now={now} past />
              </View>
              <View style={styles.cardChevronWrap} pointerEvents="none" importantForAccessibility="no">
                <Text style={styles.cardChevronMuted}>›</Text>
              </View>
            </View>
          </Pressable>
        ))
      )}
    </RefreshableScrollView>

    <BottomSheetModal
      visible={detailEvent !== null}
      onClose={() => setDetailEvent(null)}
      maxHeight="88%"
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalPad}>
          {detailEvent ? (
            <>
              <Text style={styles.modalTitle}>{detailEvent.title}</Text>
              <Text style={styles.modalMeta}>
                {format(
                  new Date(String(detailEvent.event_date).split("T")[0] + "T12:00:00"),
                  "EEEE, MMMM d"
                )}
              </Text>
              <Text style={styles.modalMeta}>
                Room: {toTitleCase(detailEvent.classroom?.name ?? "—")}
              </Text>
              <Text style={styles.modalMeta}>
                Professor: {toTitleCase(professorCalendarLine(detailEvent))}
              </Text>
              <Text style={styles.modalMeta}>
                Groups:{" "}
                {toTitleCase(
                  detailEvent.student_groups?.length
                    ? detailEvent.student_groups.map((g) => g.name).join(", ")
                    : detailEvent.student_group?.name ?? "—"
                )}
              </Text>
              {decodeCalendarRequestSubjects(detailEvent.subject ?? null).length > 0 ? (
                <Text style={styles.modalMeta}>
                  Subject:{" "}
                  {decodeCalendarRequestSubjects(detailEvent.subject ?? null).join(", ")}
                </Text>
              ) : null}
              <Text style={styles.modalMeta}>
                Time: {formatCalendarTimeHm(detailEvent.start_time)} –{" "}
                {formatCalendarTimeHm(detailEvent.end_time)}
              </Text>
              {detailEvent.description ? (
                <Text style={styles.modalBody}>{detailEvent.description}</Text>
              ) : null}
            </>
          ) : null}
      </ScrollView>
    </BottomSheetModal>
    </>
  );
}

function EventCard({
  event,
  now,
  past,
}: {
  event: CalendarRequest;
  now: Date | null;
  past?: boolean;
}) {
  const dateOnly = String(event.event_date).split("T")[0];
  const timeLine = `${String(event.start_time).slice(0, 5)} - ${String(event.end_time).slice(0, 5)}`;
  const roomLine = event.classroom?.name ?? "—";
  const subjects = decodeCalendarRequestSubjects(event.subject ?? null);

  if (past) {
    return (
      <View style={[styles.card, styles.cardPast]}>
        <Text style={styles.cardTitle}>{event.title}</Text>
        <Text style={styles.metaPrimary}>
          {format(new Date(dateOnly + "T12:00:00"), "MMM d, yyyy")} · {timeLine}
        </Text>
        <Text style={styles.meta} numberOfLines={2}>
          {roomLine}
        </Text>
      </View>
    );
  }

  const ongoing = isEventOngoing(now, event);
  const subjectText =
    subjects.length > 0 ? subjects.join(", ") : event.subject?.trim() || "";

  return (
    <View style={styles.card}>
      <View style={styles.cardTitleRow}>
        <Text style={[styles.cardTitle, styles.cardTitleFlex]}>{event.title}</Text>
        <Text
          style={[
            styles.badge,
            ongoing ? styles.badgeOngoing : styles.badgeUpcoming,
          ]}
        >
          {ongoing ? "Ongoing" : "Upcoming"}
        </Text>
      </View>
      {event.description ? (
        <Text style={styles.cardDescription} numberOfLines={2}>
          {event.description}
        </Text>
      ) : null}
      <Text style={styles.metaPrimary}>
        {format(new Date(dateOnly + "T12:00:00"), "EEE, MMM d")} · {timeLine}
      </Text>
      <Text style={styles.meta} numberOfLines={2}>
        {roomLine} · Prof. {event.professor?.full_name?.trim() || "—"}
      </Text>
      {subjectText ? (
        <View style={styles.subjectPill}>
          <Text style={styles.subjectPillText}>{subjectText}</Text>
        </View>
      ) : null}
    </View>
  );
}

const cardShadow = Platform.select({
  ios: {
    shadowColor: "#1a1a2e",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  android: { elevation: 2 },
  default: {},
});

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 36, paddingTop: 4 },
  bannerScroll: { paddingBottom: 32, flexGrow: 1 },
  center: { paddingVertical: 48, alignItems: "center", paddingHorizontal: 24 },
  loadingHint: {
    marginTop: 14,
    fontSize: 14,
    color: theme.mutedForeground,
  },
  filterRow: { marginBottom: 18 },
  filterLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.mutedForeground,
    marginBottom: 8,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  selectTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderWidth: 1,
    borderColor: theme.inputBorder,
    borderRadius: 14,
    backgroundColor: theme.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  selectTriggerText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: theme.foreground,
  },
  selectChevron: {
    fontSize: 14,
    color: theme.mutedForeground,
    fontWeight: "300",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    marginTop: 4,
  },
  sectionHeaderPast: { marginTop: 28 },
  sectionHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
  sectionAccent: {
    width: 4,
    height: 22,
    borderRadius: 2,
    backgroundColor: theme.primary,
  },
  sectionAccentMuted: {
    backgroundColor: "rgba(26, 26, 46, 0.2)",
  },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: theme.foreground, letterSpacing: -0.2 },
  sectionTitleMuted: { color: theme.mutedForeground },
  sectionCountPill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: theme.accentBg,
    borderWidth: 1,
    borderColor: "rgba(79, 70, 229, 0.2)",
  },
  sectionCountPillMuted: {
    backgroundColor: theme.glyphWell,
    borderColor: theme.border,
  },
  sectionCountText: { fontSize: 13, fontWeight: "700", color: theme.primaryDeep },
  sectionCountTextMuted: { fontSize: 13, fontWeight: "700", color: theme.mutedForeground },
  cardPress: { marginBottom: 12 },
  cardRow: { flexDirection: "row", alignItems: "stretch" },
  cardRowMain: { flex: 1, minWidth: 0 },
  cardChevronWrap: {
    justifyContent: "center",
    paddingLeft: 4,
    paddingRight: 2,
  },
  cardChevron: {
    fontSize: 22,
    fontWeight: "300",
    color: "rgba(79, 70, 229, 0.45)",
    lineHeight: 24,
  },
  cardChevronMuted: {
    fontSize: 22,
    fontWeight: "300",
    color: theme.border,
    lineHeight: 24,
  },
  emptyCard: {
    padding: 22,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
    marginBottom: 10,
    alignItems: "center",
    ...cardShadow,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.foreground,
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    color: theme.mutedForeground,
    textAlign: "center",
    lineHeight: 21,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
    ...cardShadow,
  },
  cardPast: {
    backgroundColor: "rgba(250, 250, 250, 0.95)",
    borderColor: "rgba(26, 26, 46, 0.06)",
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  cardTitleFlex: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 17, fontWeight: "700", color: theme.foreground, letterSpacing: -0.2 },
  cardDescription: {
    marginTop: 8,
    fontSize: 14,
    color: theme.mutedForeground,
    lineHeight: 20,
  },
  badge: {
    marginTop: 1,
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: 1,
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  badgeOngoing: {
    color: "#1d4ed8",
    backgroundColor: "rgba(59, 130, 246, 0.14)",
    borderColor: "rgba(59, 130, 246, 0.35)",
  },
  badgeUpcoming: {
    color: theme.primaryDeep,
    backgroundColor: theme.accentBg,
    borderColor: "rgba(79, 70, 229, 0.2)",
  },
  subjectPill: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: `${theme.primary}18`,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  subjectPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.primary,
  },
  metaPrimary: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "600",
    color: theme.foreground,
    letterSpacing: -0.1,
  },
  meta: { marginTop: 4, fontSize: 13, color: theme.mutedForeground, lineHeight: 18 },
  modalPad: { paddingBottom: 24, paddingTop: 4 },
  modalTitle: { fontSize: 20, fontWeight: "700", color: theme.foreground, marginBottom: 8 },
  modalMeta: { fontSize: 14, color: theme.mutedForeground, marginTop: 8, lineHeight: 20 },
  modalBody: { fontSize: 15, color: theme.foreground, marginTop: 14, lineHeight: 22 },
  banner: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.35)",
    alignItems: "center",
    ...cardShadow,
  },
  bannerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(234, 179, 8, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  bannerIcon: { fontSize: 18, color: "#a16207", fontWeight: "700" },
  bannerTitle: { fontSize: 17, fontWeight: "700", color: "#854d0e", textAlign: "center" },
  bannerBody: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    color: "#a16207",
    textAlign: "center",
  },
  bannerEmail: {
    marginTop: 14,
    fontSize: 13,
    fontWeight: "600",
    color: "#713f12",
    opacity: 0.9,
  },
});
