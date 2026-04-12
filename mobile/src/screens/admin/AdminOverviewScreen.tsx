import { Ionicons } from "@expo/vector-icons";
import { format, parseISO } from "date-fns";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Pressable,
  View,
} from "react-native";
import { DatePickerField } from "../../components/DatePickerField";
import { RefreshableScrollView } from "../../components/RefreshableScrollView";
import { timeSlice } from "../../lib/campus-use-mobile";
import {
  fetchAdminOverviewDashboard,
  overviewFrac,
  overviewStatusLabel,
  type AdminOverviewDashboardData,
} from "../../lib/admin-overview-fetch";
import { todayYyyyMmDd } from "../../lib/datetime-pick";
import { getSupabase } from "../../lib/supabase";
import { theme } from "../../theme";

function todayIso() {
  return todayYyyyMmDd();
}

export function AdminOverviewScreen() {
  const [fromDate, setFromDate] = useState(todayIso);
  const [toDate, setToDate] = useState(todayIso);
  const [data, setData] = useState<AdminOverviewDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [guestSearch, setGuestSearch] = useState("");
  const [sportsSearch, setSportsSearch] = useState("");
  const [classroomSearch, setClassroomSearch] = useState("");
  const [healthSearch, setHealthSearch] = useState("");
  const [messSearch, setMessSearch] = useState("");

  const isSingleDay = fromDate === toDate;
  const isTodayRange = fromDate === todayIso() && toDate === todayIso();

  const load = useCallback(async (silent?: boolean) => {
    if (!silent) setLoading(true);
    setErr(null);
    try {
      const supabase = getSupabase();
      const d = await fetchAdminOverviewDashboard(supabase, fromDate, toDate);
      setData(d);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load overview");
      setData(null);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [fromDate, toDate]);

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

  const guestBlocksFiltered = useMemo(() => {
    if (!data) return [];
    const q = guestSearch.trim().toLowerCase();
    return data.guestHouse.emptyRoomsByHouse.map((block) => ({
      label: block.label,
      rooms: block.rooms.filter((r) => !q || `${block.label} ${r}`.toLowerCase().includes(q)),
    }));
  }, [data, guestSearch]);

  const sportsFreeFiltered = useMemo(() => {
    if (!data) return [];
    const q = sportsSearch.trim().toLowerCase();
    return data.sports.freeVenueLabels.filter((l) => !q || l.toLowerCase().includes(q));
  }, [data, sportsSearch]);

  const sportsBookedFiltered = useMemo(() => {
    if (!data) return [];
    const q = sportsSearch.trim().toLowerCase();
    return data.sports.venueBreakdown.filter(
      (v) => v.bookings > 0 && (!q || v.label.toLowerCase().includes(q))
    );
  }, [data, sportsSearch]);

  const classroomEmptyFiltered = useMemo(() => {
    if (!data) return [];
    const q = classroomSearch.trim().toLowerCase();
    return data.classrooms.emptyRoomNames.filter((n) => !q || n.toLowerCase().includes(q));
  }, [data, classroomSearch]);

  const classroomScheduledFiltered = useMemo(() => {
    if (!data) return [];
    const q = classroomSearch.trim().toLowerCase();
    return data.classrooms.scheduledRooms.filter((row) => !q || row.name.toLowerCase().includes(q));
  }, [data, classroomSearch]);

  const healthItemsFiltered = useMemo(() => {
    if (!data) return [];
    const q = healthSearch.trim().toLowerCase();
    if (!q) return data.health.items;
    return data.health.items.filter(
      (row) =>
        row.studentName.toLowerCase().includes(q) ||
        row.providerLabel.toLowerCase().includes(q) ||
        row.serviceType.toLowerCase().includes(q) ||
        row.booking_date.includes(q) ||
        overviewStatusLabel(row.status).toLowerCase().includes(q)
    );
  }, [data, healthSearch]);

  const messItemsFiltered = useMemo(() => {
    if (!data) return [];
    const q = messSearch.trim().toLowerCase();
    if (!q) return data.mess.items;
    return data.mess.items.filter(
      (row) =>
        row.studentName.toLowerCase().includes(q) ||
        row.mealPeriodLabel.toLowerCase().includes(q) ||
        row.meal_date.includes(q) ||
        String(row.extra_guest_count).includes(q) ||
        overviewStatusLabel(row.status).toLowerCase().includes(q)
    );
  }, [data, messSearch]);

  return (
    <RefreshableScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <View style={styles.dateGrid}>
        <DatePickerField
          label="From"
          value={fromDate}
          onChange={(v) => {
            setFromDate(v);
            if (v > toDate) setToDate(v);
          }}
          containerStyle={styles.dateField}
        />
        <DatePickerField
          label="To"
          value={toDate}
          onChange={(v) => {
            setToDate(v);
            if (v < fromDate) setFromDate(v);
          }}
          containerStyle={styles.dateField}
        />
      </View>

      {!isTodayRange ? (
        <Pressable
          style={({ pressed }) => [styles.resetToday, pressed && { opacity: 0.7 }]}
          onPress={() => {
            const t = todayIso();
            setFromDate(t);
            setToDate(t);
          }}
        >
          <Ionicons name="refresh-outline" size={16} color={theme.mutedForeground} />
          <Text style={styles.resetTodayText}>Reset to today</Text>
        </Pressable>
      ) : null}

      {err ? <Text style={styles.errBanner}>{err}</Text> : null}

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : data ? (
        <>
          <View style={styles.statGrid}>
            <StatCard
              icon="bed-outline"
              iconBg="#ede9fe"
              iconColor="#6d28d9"
              fraction={overviewFrac(
                data.guestHouse.totalRooms - data.guestHouse.occupied,
                data.guestHouse.totalRooms
              )}
              label={
                isSingleDay ? "Vacant guest rooms" : "Vacant guest rooms · peak day"
              }
              borderTint="rgba(139, 92, 246, 0.25)"
              bgTint="rgba(139, 92, 246, 0.06)"
              valueColor="#4c1d95"
            />
            <StatCard
              icon="enter-outline"
              iconBg="#e0f2fe"
              iconColor="#0369a1"
              fraction={overviewFrac(
                data.classrooms.emptyRoomNames.length,
                data.classrooms.totalRooms
              )}
              label="Vacant Classrooms"
              borderTint="rgba(14, 165, 233, 0.25)"
              bgTint="rgba(14, 165, 233, 0.06)"
              valueColor="#0c4a6e"
            />
            <StatCard
              icon="trophy-outline"
              iconBg="#d1fae5"
              iconColor="#047857"
              fraction={overviewFrac(
                data.sports.freeVenueLabels.length,
                data.sports.totalVenues
              )}
              label="Vacant sports venues"
              borderTint="rgba(16, 185, 129, 0.25)"
              bgTint="rgba(16, 185, 129, 0.06)"
              valueColor="#064e3b"
            />
            <StatCard
              icon="school-outline"
              iconBg="#e0f2fe"
              iconColor="#0369a1"
              fraction={overviewFrac(data.people.studentsOnCampus, data.people.studentsTotal)}
              label="Students on campus"
              borderTint="rgba(14, 165, 233, 0.2)"
              bgTint="rgba(14, 165, 233, 0.05)"
              valueColor="#0c4a6e"
            />
          </View>

          <OverviewCard
            icon="bed-outline"
            iconBg="#f5f3ff"
            iconColor="#6d28d9"
            title="Guest house rooms"
            subtitle={`${data.guestHouse.occupied} of ${data.guestHouse.totalRooms} occupied${
              !isSingleDay ? " (peak in range)" : ""
            }`}
          >
            <SearchField
              value={guestSearch}
              onChangeText={setGuestSearch}
              placeholder="Search building or room number…"
            />
            <ProgressBar value={data.guestHouse.occupied} max={data.guestHouse.totalRooms} color="#8b5cf6" />
            <View style={styles.inlineMetaRow}>
              {data.guestHouse.byHouse.map((h) => (
                <Text key={h.label} style={styles.inlineMeta}>
                  {h.label}:{" "}
                  <Text style={styles.inlineMetaStrong}>
                    {h.occupied}/{h.total}
                  </Text>
                </Text>
              ))}
            </View>
            <Text style={styles.emeraldLine}>
              {data.guestHouse.totalRooms - data.guestHouse.occupied} rooms available
            </Text>
            <View style={styles.divider} />
            <Text style={styles.listHeading}>
              Vacant room numbers{" "}
              <Text style={styles.listHeadingMuted}>
                —{" "}
                {isSingleDay
                  ? format(parseISO(fromDate), "MMM d, yyyy")
                  : `busiest day ${format(parseISO(data.guestHouse.peakDayIso), "MMM d, yyyy")}`}
              </Text>
            </Text>
            {guestBlocksFiltered.map((block) => (
              <View key={block.label} style={styles.blockMargin}>
                <Text style={styles.buildingLabel}>
                  {block.label}
                  {guestSearch.trim() ? (
                    <Text style={styles.buildingCount}>
                      {" "}
                      ({block.rooms.length} match{block.rooms.length === 1 ? "" : "es"})
                    </Text>
                  ) : null}
                </Text>
                {(() => {
                  const orig = data.guestHouse.emptyRoomsByHouse.find((b) => b.label === block.label);
                  const wasAllFull = orig && orig.rooms.length === 0;
                  if (wasAllFull) {
                    return <Text style={styles.amberNote}>All rooms occupied on this day.</Text>;
                  }
                  if (block.rooms.length === 0) {
                    return <Text style={styles.mutedSmall}>No vacant rooms match this search.</Text>;
                  }
                  return <RoomChips rooms={block.rooms} />;
                })()}
              </View>
            ))}
          </OverviewCard>

          <OverviewCard
            icon="enter-outline"
            iconBg="#f0f9ff"
            iconColor="#0369a1"
            title="Classrooms"
            subtitle={`${data.classrooms.classroomsWithEvents} of ${data.classrooms.totalRooms} rooms in use · ${data.classrooms.bookedEvents} event${data.classrooms.bookedEvents === 1 ? "" : "s"}`}
          >
            <SearchField
              value={classroomSearch}
              onChangeText={setClassroomSearch}
              placeholder="Search classroom name…"
            />
            {data.classrooms.totalRooms > 0 ? (
              <ProgressBar
                value={data.classrooms.classroomsWithEvents}
                max={data.classrooms.totalRooms}
                color="#0ea5e9"
              />
            ) : null}
            <View style={styles.divider} />
            <Text style={styles.listHeadingUpper}>
              No events scheduled ({data.classrooms.emptyRoomNames.length} rooms)
            </Text>
            {data.classrooms.emptyRoomNames.length === 0 ? (
              <Text style={styles.mutedSmall}>Every classroom has at least one event in this period.</Text>
            ) : classroomEmptyFiltered.length === 0 ? (
              <Text style={styles.mutedSmall}>No rooms match this search.</Text>
            ) : (
              <ScrollPanel>
                {classroomEmptyFiltered.map((name) => (
                  <View key={name} style={styles.listRow}>
                    <Text style={styles.listRowText}>{name}</Text>
                  </View>
                ))}
              </ScrollPanel>
            )}
            <View style={styles.divider} />
            <Text style={styles.listHeadingUpper}>Rooms with events</Text>
            {data.classrooms.scheduledRooms.length === 0 ? (
              <Text style={styles.mutedSmall}>No approved class events in this period.</Text>
            ) : classroomScheduledFiltered.length === 0 ? (
              <Text style={styles.mutedSmall}>No rooms match this search.</Text>
            ) : (
              <ScrollPanel>
                {classroomScheduledFiltered.map((row) => (
                  <View key={row.name} style={styles.listRow}>
                    <Text style={styles.listRowText}>
                      {row.name}
                      <Text style={styles.listRowMeta}>
                        {" "}
                        — {row.events} event{row.events === 1 ? "" : "s"}
                      </Text>
                    </Text>
                  </View>
                ))}
              </ScrollPanel>
            )}
          </OverviewCard>

          <OverviewCard
            icon="trophy-outline"
            iconBg="#ecfdf5"
            iconColor="#047857"
            title="Sports venues"
            subtitle={`${data.sports.bookedVenues} of ${data.sports.totalVenues} venues have bookings${
              !isSingleDay ? ` · ${data.sports.totalBookings} booking(s) total` : ""
            }`}
          >
            <SearchField
              value={sportsSearch}
              onChangeText={setSportsSearch}
              placeholder="Search venue name…"
            />
            <ProgressBar value={data.sports.bookedVenues} max={data.sports.totalVenues} color="#10b981" />
            <View style={styles.divider} />
            <Text style={styles.listHeadingUpper}>Free for this period</Text>
            {data.sports.freeVenueLabels.length === 0 ? (
              <Text style={styles.mutedSmall}>Every venue has at least one booking.</Text>
            ) : sportsFreeFiltered.length === 0 ? (
              <Text style={styles.mutedSmall}>No free venues match this search.</Text>
            ) : (
              <ScrollPanel short>
                {sportsFreeFiltered.map((name) => (
                  <View key={name} style={styles.listRow}>
                    <Text style={styles.listRowText}>{name}</Text>
                  </View>
                ))}
              </ScrollPanel>
            )}
            <View style={styles.divider} />
            <Text style={styles.listHeadingUpper}>Booked (sessions)</Text>
            {data.sports.bookedVenues === 0 ? (
              <Text style={styles.mutedSmall}>No bookings in this period.</Text>
            ) : sportsBookedFiltered.length === 0 ? (
              <Text style={styles.mutedSmall}>No booked venues match this search.</Text>
            ) : (
              <ScrollPanel short>
                {sportsBookedFiltered.map((v) => (
                  <View key={v.label} style={styles.listRow}>
                    <Text style={styles.listRowText}>
                      {v.label}
                      <Text style={styles.listRowMeta}>
                        {" "}
                        — {v.bookings} booking{v.bookings === 1 ? "" : "s"}
                      </Text>
                    </Text>
                  </View>
                ))}
              </ScrollPanel>
            )}
            <Text style={styles.emeraldLineSports}>
              {data.sports.freeVenueLabels.length} of {data.sports.totalVenues} venues completely free
            </Text>
          </OverviewCard>

          <OverviewCard
            icon="medkit-outline"
            iconBg="#fdf2f8"
            iconColor="#be185d"
            title="Health & counselling"
            subtitle={`${data.health.totalInRange} booking${data.health.totalInRange === 1 ? "" : "s"} · selected dates`}
          >
            <SearchField
              value={healthSearch}
              onChangeText={setHealthSearch}
              placeholder="Student, provider, role, date, status…"
            />
            {data.health.items.length === 0 ? (
              <Text style={styles.mutedSmall}>No appointments in this period.</Text>
            ) : healthItemsFiltered.length === 0 ? (
              <Text style={styles.mutedSmall}>No rows match this search.</Text>
            ) : (
              <ScrollView style={styles.detailScroll} nestedScrollEnabled showsVerticalScrollIndicator>
                {healthItemsFiltered.map((row) => (
                  <View key={row.id} style={styles.detailCard}>
                    <Text style={styles.detailTitle}>{row.studentName}</Text>
                    <Text style={styles.detailMeta}>
                      {format(parseISO(row.booking_date), "MMM d")} · {timeSlice(row.start_time)} ·{" "}
                      {row.serviceType} · {row.providerLabel} · {overviewStatusLabel(row.status)}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </OverviewCard>

          <OverviewCard
            icon="restaurant-outline"
            iconBg="#fffbeb"
            iconColor="#b45309"
            title="Mess — extra guests"
            subtitle={`${data.mess.totalInRange} extra-guest request${data.mess.totalInRange === 1 ? "" : "s"} · meal dates`}
          >
            <SearchField
              value={messSearch}
              onChangeText={setMessSearch}
              placeholder="Student, meal, date, guests, status…"
            />
            {data.mess.items.length === 0 ? (
              <Text style={styles.mutedSmall}>No mess requests in this period.</Text>
            ) : messItemsFiltered.length === 0 ? (
              <Text style={styles.mutedSmall}>No rows match this search.</Text>
            ) : (
              <ScrollView style={styles.detailScroll} nestedScrollEnabled showsVerticalScrollIndicator>
                {messItemsFiltered.map((row) => (
                  <View key={row.id} style={styles.detailCard}>
                    <Text style={styles.detailTitle}>{row.studentName}</Text>
                    <Text style={styles.detailMeta}>
                      {format(parseISO(row.meal_date), "MMM d")} · {row.mealPeriodLabel} · +
                      {row.extra_guest_count} guest{row.extra_guest_count === 1 ? "" : "s"} ·{" "}
                      {overviewStatusLabel(row.status)}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </OverviewCard>
        </>
      ) : null}
    </RefreshableScrollView>
  );
}

function SearchField({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.searchWrap}>
      <Ionicons name="search-outline" size={16} color={theme.mutedForeground} style={styles.searchIcon} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.mutedForeground}
        style={styles.searchInput}
      />
    </View>
  );
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <View style={styles.pBarTrack}>
      <View style={[styles.pBarFill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
}

function StatCard({
  icon,
  iconBg,
  iconColor,
  fraction,
  label,
  borderTint,
  bgTint,
  valueColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  fraction: string;
  label: string;
  borderTint: string;
  bgTint: string;
  valueColor: string;
}) {
  return (
    <View style={[styles.statCard, { borderColor: borderTint, backgroundColor: bgTint }]}>
      <View style={[styles.statIconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <View style={styles.statTextCol}>
        <Text style={[styles.statFraction, { color: valueColor }]}>{fraction}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
}

function OverviewCard({
  icon,
  iconBg,
  iconColor,
  title,
  subtitle,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={[styles.cardIconWrap, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={20} color={iconColor} />
        </View>
        <View style={styles.cardHeadText}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardSubtitle}>{subtitle}</Text>
        </View>
      </View>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

function ScrollPanel({ children, short }: { children: ReactNode; short?: boolean }) {
  return (
    <ScrollView
      style={[styles.scrollPanel, short && styles.scrollPanelShort]}
      nestedScrollEnabled
      showsVerticalScrollIndicator
    >
      {children}
    </ScrollView>
  );
}

function RoomChips({ rooms }: { rooms: string[] }) {
  return (
    <ScrollView style={styles.chipScroll} nestedScrollEnabled showsVerticalScrollIndicator>
      <View style={styles.chipFlow}>
        {rooms.map((r) => (
          <View key={r} style={styles.roomChip}>
            <Text style={styles.roomChipText}>{r}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const hairline = StyleSheet.hairlineWidth;

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 28, gap: 12 },
  dateGrid: { flexDirection: "row", gap: 12 },
  dateField: { flex: 1 },
  resetToday: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingVertical: 6,
  },
  resetTodayText: { fontSize: 12, fontWeight: "500", color: theme.mutedForeground },
  errBanner: {
    fontSize: 13,
    color: theme.destructive,
    lineHeight: 18,
    paddingVertical: 4,
  },
  loaderWrap: { paddingVertical: 48, alignItems: "center" },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: {
    flexBasis: "47%",
    flexGrow: 1,
    maxWidth: "100%",
    minWidth: 148,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: hairline,
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statTextCol: { flex: 1, minWidth: 0 },
  statFraction: { fontSize: 22, fontWeight: "600", fontVariant: ["tabular-nums"] },
  statLabel: { fontSize: 11, color: theme.mutedForeground, marginTop: 2 },
  card: {
    borderRadius: 12,
    borderWidth: hairline,
    borderColor: theme.border,
    backgroundColor: theme.card,
    overflow: "hidden",
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
  },
  cardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeadText: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 14, fontWeight: "600", color: theme.foreground },
  cardSubtitle: { fontSize: 12, color: theme.mutedForeground, marginTop: 2, lineHeight: 16 },
  cardBody: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: hairline,
    borderColor: theme.border,
    borderRadius: 8,
    backgroundColor: theme.background,
    paddingLeft: 10,
  },
  searchIcon: { marginRight: 4 },
  searchInput: { flex: 1, height: 36, fontSize: 12, color: theme.foreground, paddingRight: 10 },
  pBarTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: theme.glyphWell,
    overflow: "hidden",
  },
  pBarFill: { height: "100%", borderRadius: 999 },
  inlineMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  inlineMeta: { fontSize: 12, color: theme.mutedForeground },
  inlineMetaStrong: { fontWeight: "600", color: theme.foreground, fontVariant: ["tabular-nums"] },
  emeraldLine: { fontSize: 12, fontWeight: "600", color: "#047857", fontVariant: ["tabular-nums"] },
  emeraldLineSports: {
    fontSize: 12,
    fontWeight: "600",
    color: "#047857",
    fontVariant: ["tabular-nums"],
    marginTop: 4,
  },
  divider: {
    borderTopWidth: hairline,
    borderTopColor: theme.border,
    marginVertical: 4,
    opacity: 0.85,
  },
  listHeading: { fontSize: 12, fontWeight: "600", color: theme.foreground },
  listHeadingMuted: { fontWeight: "400", color: theme.mutedForeground },
  listHeadingUpper: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.4,
    color: theme.mutedForeground,
    textTransform: "uppercase",
  },
  blockMargin: { marginTop: 8 },
  buildingLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.3,
    color: theme.mutedForeground,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  buildingCount: { fontWeight: "400", textTransform: "none", color: theme.mutedForeground },
  amberNote: { fontSize: 12, color: "#b45309" },
  mutedSmall: { fontSize: 12, color: theme.mutedForeground, lineHeight: 17 },
  scrollPanel: {
    maxHeight: 160,
    borderRadius: 8,
    borderWidth: hairline,
    borderColor: theme.border,
    backgroundColor: theme.glyphWell,
  },
  scrollPanelShort: { maxHeight: 136 },
  listRow: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: hairline,
    borderBottomColor: "rgba(26,26,46,0.06)",
  },
  listRowText: { fontSize: 12, color: theme.foreground },
  listRowMeta: { fontSize: 12, color: theme.mutedForeground, fontVariant: ["tabular-nums"] },
  chipScroll: { maxHeight: 152 },
  chipFlow: { flexDirection: "row", flexWrap: "wrap", gap: 6, padding: 8 },
  roomChip: {
    borderRadius: 6,
    borderWidth: hairline,
    borderColor: "rgba(139, 92, 246, 0.35)",
    backgroundColor: "rgba(139, 92, 246, 0.08)",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  roomChipText: { fontSize: 11, color: "#5b21b6", fontVariant: ["tabular-nums"] },
  detailScroll: { maxHeight: 208, gap: 8 },
  detailCard: {
    borderRadius: 8,
    borderWidth: hairline,
    borderColor: theme.border,
    backgroundColor: theme.card,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  detailTitle: { fontSize: 13, fontWeight: "600", color: theme.foreground },
  detailMeta: { marginTop: 4, fontSize: 12, color: theme.mutedForeground, lineHeight: 17 },
});
