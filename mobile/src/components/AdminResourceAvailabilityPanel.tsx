import { addDays, format } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import {
  fetchAdminResourceAvailability,
  type AdminResourceAvailabilitySpec,
} from "../lib/admin-availability-fetch";
import { FACILITY_TYPE_LABELS, venuesForFacilityType } from "../lib/facility-labels";
import { toTitleCase } from "../lib/format-text";
import {
  PROFESSOR_VENUE_NAMES,
  resolveProfessorVenues,
  type ProfessorVenueName,
} from "../lib/professor-booking-metadata";
import { getSupabase } from "../lib/supabase";
import {
  SPORT_LABELS,
  SPORTS_VENUE_LABELS,
  SPORT_TYPES_ORDER,
  venuesForSport,
} from "../lib/sports-booking";
import {
  APPOINTMENT_PROVIDER_LABELS,
  providersForService,
} from "../lib/campus-use-mobile";
import type {
  AppointmentProviderCode,
  Classroom,
  FacilityBookingType,
  SportType,
  SportsVenueCode,
} from "../types";
import { theme } from "../theme";
import { ScheduleTimeGrid } from "./ScheduleTimeGrid";
import { SelectModal } from "./SelectModal";

const FACILITY_TYPES: FacilityBookingType[] = [
  "auditorium",
  "computer_hall",
  "board_room",
  "conference_room",
];

export type AdminResourceAvailabilityMode = "event" | "sports" | "facility" | "health";

export const ADMIN_AVAILABILITY_MODE_TITLE: Record<AdminResourceAvailabilityMode, string> = {
  event: "Event venue availability",
  sports: "Sports venue availability",
  facility: "Facility availability",
  health: "Health provider availability",
};

type Props = {
  mode: AdminResourceAvailabilityMode;
  weekStart: Date;
  classrooms: Classroom[];
};

export function AdminResourceAvailabilityPanel({ mode, weekStart, classrooms }: Props) {
  const [classroomId, setClassroomId] = useState("");
  const [sport, setSport] = useState<SportType>("cricket");
  const [sportVenue, setSportVenue] = useState<SportsVenueCode>(() => venuesForSport("cricket")[0]!);
  const [facType, setFacType] = useState<FacilityBookingType>("auditorium");
  const [facVenue, setFacVenue] = useState("");
  const [svc, setSvc] = useState<"counsellor" | "doctor">("counsellor");
  const [prov, setProv] = useState<AppointmentProviderCode>("counsellor_1");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timed, setTimed] = useState<
    { id: string; title: string; dayIndex: number; startMin: number; endMin: number }[]
  >([]);
  const [allDay, setAllDay] = useState<{ id: string; title: string; dayIndex: number }[]>([]);

  type SelectSheet =
    | null
    | "eventVenue"
    | "sport"
    | "sportVenue"
    | "facType"
    | "facVenue"
    | "healthSvc"
    | "healthProv";
  const [selectSheet, setSelectSheet] = useState<SelectSheet>(null);

  const sportVenueCodes = useMemo(() => venuesForSport(sport), [sport]);

  const facVenueOptions = useMemo(() => venuesForFacilityType(facType), [facType]);

  const healthProviderOptions = useMemo(
    () =>
      providersForService(svc).map((c) => ({
        value: c,
        label: APPOINTMENT_PROVIDER_LABELS[c],
      })),
    [svc]
  );

  const eventVenueRows = useMemo(() => {
    const byLabel = resolveProfessorVenues(classrooms);
    return PROFESSOR_VENUE_NAMES.map((label) => {
      const classroom = byLabel.get(label);
      return classroom ? { label, classroom } : null;
    }).filter(
      (row): row is { label: ProfessorVenueName; classroom: Classroom } => row != null
    );
  }, [classrooms]);

  useEffect(() => {
    if (mode !== "event") return;
    if (eventVenueRows.length === 0) {
      setClassroomId("");
      return;
    }
    setClassroomId((prev) =>
      prev && eventVenueRows.some((r) => r.classroom.id === prev)
        ? prev
        : eventVenueRows[0]!.classroom.id
    );
  }, [mode, eventVenueRows]);

  useEffect(() => {
    if (mode !== "sports") return;
    const v = venuesForSport(sport)[0];
    if (v) setSportVenue(v);
  }, [mode, sport]);

  useEffect(() => {
    if (mode !== "facility") return;
    const opts = venuesForFacilityType(facType);
    const first = opts[0]?.code ?? "";
    setFacVenue((prev) => (opts.some((o) => o.code === prev) ? prev : first));
  }, [mode, facType]);

  useEffect(() => {
    if (mode !== "health") return;
    const opts = providersForService(svc);
    setProv(opts[0]!);
  }, [mode, svc]);

  const resourceSpec = useMemo((): AdminResourceAvailabilitySpec | null => {
    switch (mode) {
      case "event":
        if (!classroomId) return null;
        return { kind: "classroom", classroomId };
      case "sports":
        return { kind: "sports", sport, venueCode: sportVenue };
      case "facility":
        if (!facVenue) return null;
        return { kind: "facility", facilityType: facType, venueCode: facVenue };
      case "health":
        return { kind: "appointment", providerCode: prov };
      default:
        return null;
    }
  }, [mode, classroomId, sport, sportVenue, facType, facVenue, prov]);

  const load = useCallback(async () => {
    if (resourceSpec == null) {
      setTimed([]);
      setAllDay([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const res = await fetchAdminResourceAvailability(supabase, resourceSpec, weekStart);
      setTimed(res.timed);
      setAllDay(res.allDay);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not load availability.";
      setError(msg);
      setTimed([]);
      setAllDay([]);
    } finally {
      setLoading(false);
    }
  }, [resourceSpec, weekStart]);

  useEffect(() => {
    load();
  }, [load]);

  const onSelectAvailability = useCallback((item: { id: string; title: string }) => {
    Alert.alert("Approved booking", item.title);
  }, []);

  const screenTitle = ADMIN_AVAILABILITY_MODE_TITLE[mode];
  const weekLabel = `${format(weekStart, "MMM d")} – ${format(addDays(weekStart, 6), "MMM d, yyyy")}`;

  const eventVenueOptions = useMemo(
    () =>
      eventVenueRows.map(({ label, classroom }) => ({
        value: classroom.id,
        label: toTitleCase(label),
      })),
    [eventVenueRows]
  );

  const eventVenueLabel =
    eventVenueRows.find((r) => r.classroom.id === classroomId)?.label ?? "Venue";

  const sportSelectOptions = useMemo(
    () => SPORT_TYPES_ORDER.map((s) => ({ value: s, label: SPORT_LABELS[s] })),
    []
  );

  const sportVenueSelectOptions = useMemo(
    () => sportVenueCodes.map((v) => ({ value: v, label: SPORTS_VENUE_LABELS[v] })),
    [sportVenueCodes]
  );

  const facVenueSelectOptions = useMemo(
    () => facVenueOptions.map((v) => ({ value: v.code, label: v.label })),
    [facVenueOptions]
  );

  const facVenueLabel =
    facVenueOptions.find((v) => v.code === facVenue)?.label ?? "Room / hall";

  const facTypeSelectOptions = useMemo(
    () => FACILITY_TYPES.map((t) => ({ value: t, label: FACILITY_TYPE_LABELS[t] })),
    []
  );

  const healthSvcSelectOptions = useMemo(
    () => [
      { value: "counsellor", label: "Counsellor" },
      { value: "doctor", label: "Doctor" },
    ],
    []
  );

  const healthSvcLabel = svc === "counsellor" ? "Counsellor" : "Doctor";

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>{screenTitle}</Text>
      <Text style={styles.sectionSub}>
        Approved bookings only (same sources as the web admin schedule). Week: {weekLabel}.
      </Text>

      {mode === "event" && (
        <>
          <Text style={styles.label}>Venue</Text>
          {eventVenueRows.length === 0 ? (
            <Text style={styles.muted}>No professor venues mapped to classrooms yet.</Text>
          ) : (
            <Pressable
              onPress={() => setSelectSheet("eventVenue")}
              style={styles.selectTrigger}
              accessibilityRole="button"
              accessibilityLabel="Venue"
            >
              <Text style={styles.selectTriggerText} numberOfLines={2}>
                {toTitleCase(eventVenueLabel)}
              </Text>
              <Text style={styles.selectChevron}>▼</Text>
            </Pressable>
          )}
        </>
      )}

      {mode === "sports" && (
        <>
          <Text style={styles.label}>Sport</Text>
          <Pressable
            onPress={() => setSelectSheet("sport")}
            style={styles.selectTrigger}
            accessibilityRole="button"
            accessibilityLabel="Sport"
          >
            <Text style={styles.selectTriggerText} numberOfLines={1}>
              {SPORT_LABELS[sport]}
            </Text>
            <Text style={styles.selectChevron}>▼</Text>
          </Pressable>
          <Text style={styles.label}>Venue</Text>
          <Pressable
            onPress={() => setSelectSheet("sportVenue")}
            style={styles.selectTrigger}
            accessibilityRole="button"
            accessibilityLabel="Sports venue"
          >
            <Text style={styles.selectTriggerText} numberOfLines={2}>
              {SPORTS_VENUE_LABELS[sportVenue]}
            </Text>
            <Text style={styles.selectChevron}>▼</Text>
          </Pressable>
        </>
      )}

      {mode === "facility" && (
        <>
          <Text style={styles.label}>Facility type</Text>
          <Pressable
            onPress={() => setSelectSheet("facType")}
            style={styles.selectTrigger}
            accessibilityRole="button"
            accessibilityLabel="Facility type"
          >
            <Text style={styles.selectTriggerText} numberOfLines={2}>
              {FACILITY_TYPE_LABELS[facType]}
            </Text>
            <Text style={styles.selectChevron}>▼</Text>
          </Pressable>
          <Text style={styles.label}>Room / hall</Text>
          <Pressable
            onPress={() => setSelectSheet("facVenue")}
            style={styles.selectTrigger}
            accessibilityRole="button"
          >
            <Text style={styles.selectTriggerText} numberOfLines={2}>
              {facVenueLabel}
            </Text>
            <Text style={styles.selectChevron}>▼</Text>
          </Pressable>
        </>
      )}

      {mode === "health" && (
        <>
          <Text style={styles.label}>Service</Text>
          <Pressable
            onPress={() => setSelectSheet("healthSvc")}
            style={styles.selectTrigger}
            accessibilityRole="button"
            accessibilityLabel="Health service"
          >
            <Text style={styles.selectTriggerText} numberOfLines={1}>
              {healthSvcLabel}
            </Text>
            <Text style={styles.selectChevron}>▼</Text>
          </Pressable>
          <Text style={styles.label}>Provider</Text>
          <Pressable
            onPress={() => setSelectSheet("healthProv")}
            style={styles.selectTrigger}
            accessibilityRole="button"
            accessibilityLabel="Provider"
          >
            <Text style={styles.selectTriggerText} numberOfLines={2}>
              {APPOINTMENT_PROVIDER_LABELS[prov]}
            </Text>
            <Text style={styles.selectChevron}>▼</Text>
          </Pressable>
        </>
      )}

      <SelectModal
        visible={selectSheet === "eventVenue"}
        title="Venue"
        options={eventVenueOptions}
        selectedValue={classroomId}
        onSelect={(v) => setClassroomId(v)}
        onClose={() => setSelectSheet(null)}
      />
      <SelectModal
        visible={selectSheet === "sport"}
        title="Sport"
        options={sportSelectOptions}
        selectedValue={sport}
        onSelect={(v) => setSport(v as SportType)}
        onClose={() => setSelectSheet(null)}
      />
      <SelectModal
        visible={selectSheet === "sportVenue"}
        title="Venue"
        options={sportVenueSelectOptions}
        selectedValue={sportVenue}
        onSelect={(v) => setSportVenue(v as SportsVenueCode)}
        onClose={() => setSelectSheet(null)}
      />
      <SelectModal
        visible={selectSheet === "facType"}
        title="Facility type"
        options={facTypeSelectOptions}
        selectedValue={facType}
        onSelect={(v) => setFacType(v as FacilityBookingType)}
        onClose={() => setSelectSheet(null)}
      />
      <SelectModal
        visible={selectSheet === "facVenue"}
        title="Room / hall"
        options={facVenueSelectOptions}
        selectedValue={facVenue}
        onSelect={(v) => setFacVenue(v)}
        onClose={() => setSelectSheet(null)}
      />
      <SelectModal
        visible={selectSheet === "healthSvc"}
        title="Service"
        options={healthSvcSelectOptions}
        selectedValue={svc}
        onSelect={(v) => setSvc(v as "counsellor" | "doctor")}
        onClose={() => setSelectSheet(null)}
      />
      <SelectModal
        visible={selectSheet === "healthProv"}
        title="Provider"
        options={healthProviderOptions}
        selectedValue={prov}
        onSelect={(v) => setProv(v as AppointmentProviderCode)}
        onClose={() => setSelectSheet(null)}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={theme.primary} />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      ) : null}

      {resourceSpec == null ? (
        <Text style={styles.muted}>Select options above to load availability.</Text>
      ) : (
        <ScheduleTimeGrid
          mode="week"
          rangeStart={weekStart}
          bookings={[]}
          facility={[]}
          tasks={[]}
          classrooms={classrooms}
          onSelectEvent={() => {}}
          availability={{ timed, allDay }}
          onSelectAvailability={onSelectAvailability}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: theme.foreground,
    marginBottom: 6,
  },
  sectionSub: {
    fontSize: 12,
    color: theme.mutedForeground,
    lineHeight: 17,
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.mutedForeground,
    marginBottom: 4,
    marginTop: 8,
  },
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
    marginBottom: 4,
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
  muted: { fontSize: 13, color: theme.mutedForeground, marginTop: 6 },
  error: { fontSize: 13, color: "#b91c1c", marginTop: 8 },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
  },
  loadingText: { fontSize: 13, color: theme.mutedForeground },
});
