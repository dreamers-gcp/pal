import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Session } from "@supabase/supabase-js";
import { NucleusWordmark } from "../components/NucleusWordmark";
import { filterAdminNavForAccess } from "../lib/filter-admin-nav";
import { isSuperAdminProfile, normalizeAdminEmail } from "../lib/admin-request-routing";
import { drawerNavIconName } from "../navigation/drawer-nav-icons";
import { defaultNavId, navEntriesForRole } from "../navigation/nav-config";
import type { AdminResourceAvailabilityMode } from "../components/AdminResourceAvailabilityPanel";
import { AdminGuestHouseAvailabilityScreen } from "./admin/AdminGuestHouseAvailabilityScreen";
import { AdminResourceAvailabilityScreen } from "./admin/AdminResourceAvailabilityScreen";
import { getPalApiBaseUrl } from "../lib/config";
import { getSupabase } from "../lib/supabase";
import type { Profile, UserRole } from "../types";
import { theme } from "../theme";
import { AdminCalendarScreen } from "./admin/AdminCalendarScreen";
import { AdminCampusQueueScreen } from "./admin/AdminCampusQueueScreen";
import { AdminEventRequestsScreen } from "./admin/AdminEventRequestsScreen";
import { AdminGuestHouseRequestsScreen } from "./admin/AdminGuestHouseRequestsScreen";
import { AdminAccessScreen } from "./admin/AdminAccessScreen";
import { AdminOverviewScreen } from "./admin/AdminOverviewScreen";
import { AdminParcelManagementScreen } from "./admin/AdminParcelManagementScreen";
import { AdminSportsRequestsScreen } from "./admin/AdminSportsRequestsScreen";
import { ProfessorCalendarScreen } from "./professor/ProfessorCalendarScreen";
import { ProfessorMyRequestsScreen } from "./professor/ProfessorMyRequestsScreen";
import { ProfessorScriptScreen } from "./professor/ProfessorScriptScreen";
import { ProfessorAttendanceScreen } from "./professor/ProfessorAttendanceScreen";
import { SectionPlaceholderScreen } from "./SectionPlaceholderScreen";
import { SportsRequestsScreen } from "./shared/SportsRequestsScreen";
import { UserParcelsScreen } from "./shared/UserParcelsScreen";
import { StudentCalendarScreen } from "./student/StudentCalendarScreen";
import { StudentCampusScreen } from "./student/StudentCampusScreen";
import { StudentAttendanceScreen } from "./student/StudentAttendanceScreen";
import { StudentEventsScreen } from "./student/StudentEventsScreen";
import { StudentGuestHouseScreen } from "./student/StudentGuestHouseScreen";
import { StudentTasksScreen } from "./student/StudentTasksScreen";

const ADMIN_AVAILABILITY_MODE_BY_NAV: Record<string, AdminResourceAvailabilityMode> = {
  "avail-event-venues": "event",
  "avail-sports": "sports",
  "avail-facilities": "facility",
  "avail-health": "health",
};

const SCREEN_W = Dimensions.get("window").width;
const DRAWER_WIDTH = Math.min(348, Math.round(SCREEN_W * 0.9));

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.background },
    center: { justifyContent: "center", alignItems: "center" },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.card,
      gap: 8,
    },
    menuBtn: { padding: 8 },
    menuIcon: { fontSize: 22, color: theme.foreground },
    headerCenter: { flex: 1, alignItems: "center" },
    headerSection: {
      marginTop: 2,
      fontSize: 12,
      fontWeight: "600",
      color: theme.mutedForeground,
      maxWidth: 220,
      textAlign: "center",
    },
    signOut: { fontSize: 14, fontWeight: "600", color: theme.primary, paddingHorizontal: 4 },
    greeting: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.foreground,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 4,
    },
    studentHero: {
      marginTop: 10,
      marginBottom: 10,
      borderRadius: 18,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: "rgba(79, 70, 229, 0.12)",
      ...Platform.select({
        ios: {
          shadowColor: "#312e81",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.08,
          shadowRadius: 14,
        },
        android: { elevation: 3 },
        default: {},
      }),
    },
    studentHeroGrad: {
      paddingVertical: 16,
      paddingHorizontal: 16,
    },
    studentHeroRow: { flexDirection: "row", alignItems: "center", gap: 14 },
    studentHeroAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: "rgba(79, 70, 229, 0.18)",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: "rgba(255,255,255,0.85)",
    },
    studentHeroAvatarText: {
      fontSize: 16,
      fontWeight: "800",
      color: theme.primaryDeep,
      letterSpacing: 0.3,
    },
    studentHeroTextCol: { flex: 1, minWidth: 0 },
    studentHeroHi: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.foreground,
      letterSpacing: -0.3,
    },
    studentHeroSub: {
      marginTop: 4,
      fontSize: 14,
      lineHeight: 20,
      color: theme.mutedForeground,
    },
    faceBanner: {
      marginTop: 8,
      padding: 12,
      borderRadius: 10,
      backgroundColor: theme.accentBg,
      borderWidth: 1,
      borderColor: "rgba(79, 70, 229, 0.25)",
    },
    faceTitle: { fontSize: 14, fontWeight: "700", color: theme.foreground },
    faceBody: { marginTop: 4, fontSize: 12, color: theme.mutedForeground, lineHeight: 17 },
    faceBtn: {
      marginTop: 10,
      alignSelf: "flex-start",
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.primary,
    },
    faceBtnText: { fontSize: 13, fontWeight: "600", color: theme.primary },
    content: { flex: 1, minHeight: 0, paddingHorizontal: 16, paddingTop: 8 },
    contentStudent: { paddingTop: 4 },
    drawerOverlay: {
      flex: 1,
    },
    drawerBackdropTint: {
      flex: 1,
      backgroundColor: "rgba(10, 12, 28, 0.52)",
    },
    drawerPanel: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      maxWidth: DRAWER_WIDTH,
      backgroundColor: theme.card,
      borderTopRightRadius: 20,
      borderBottomRightRadius: 20,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOffset: { width: 4, height: 0 },
      shadowOpacity: 0.18,
      shadowRadius: 16,
      elevation: 12,
    },
    drawerHero: {
      marginHorizontal: 12,
      marginBottom: 8,
      paddingVertical: 20,
      paddingHorizontal: 16,
      borderRadius: 16,
    },
    drawerAvatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: "rgba(255,255,255,0.22)",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
      borderWidth: 2,
      borderColor: "rgba(255,255,255,0.35)",
    },
    drawerAvatarText: {
      fontSize: 18,
      fontWeight: "800",
      color: "#fff",
      letterSpacing: 0.5,
    },
    drawerHeroName: {
      fontSize: 19,
      fontWeight: "700",
      color: "#fff",
    },
    drawerHeroEmail: {
      marginTop: 4,
      fontSize: 13,
      color: "rgba(255,255,255,0.82)",
    },
    drawerRolePill: {
      alignSelf: "flex-start",
      marginTop: 12,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: "rgba(255,255,255,0.2)",
    },
    drawerRolePillText: {
      fontSize: 12,
      fontWeight: "700",
      color: "#fff",
      letterSpacing: 0.3,
    },
    drawerNavCaption: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1,
      color: theme.mutedForeground,
      textTransform: "uppercase",
      paddingHorizontal: 20,
      marginBottom: 6,
    },
    drawerScroll: { flex: 1, minHeight: 120 },
    drawerScrollContent: {
      paddingHorizontal: 10,
      paddingBottom: 8,
    },
    drawerHeadingWrap: {
      marginTop: 18,
      marginBottom: 8,
      paddingHorizontal: 8,
    },
    drawerHeadingRule: {
      height: 1,
      backgroundColor: theme.border,
      marginBottom: 10,
      opacity: 0.85,
    },
    drawerHeading: {
      fontSize: 11,
      fontWeight: "800",
      color: theme.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    drawerItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 10,
      paddingLeft: 8,
      borderRadius: 12,
      marginBottom: 4,
      gap: 12,
      position: "relative",
      overflow: "hidden",
    },
    drawerItemPressed: {
      backgroundColor: theme.pressableMuted,
    },
    drawerItemActive: {
      backgroundColor: theme.activeNavBg,
    },
    drawerItemActiveBar: {
      position: "absolute",
      left: 0,
      top: 10,
      bottom: 10,
      width: 4,
      borderTopRightRadius: 4,
      borderBottomRightRadius: 4,
      backgroundColor: theme.primary,
    },
    drawerItemGlyph: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: theme.glyphWell,
      alignItems: "center",
      justifyContent: "center",
    },
    drawerItemGlyphActive: {
      backgroundColor: theme.activeGlyphBg,
    },
    drawerItemLabel: {
      flex: 1,
      fontSize: 15,
      fontWeight: "500",
      color: theme.foreground,
      lineHeight: 20,
    },
    drawerItemLabelActive: {
      fontWeight: "700",
      color: theme.primaryDeep,
    },
    drawerFooter: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 4,
      gap: 4,
      backgroundColor: theme.card,
    },
    drawerSignOutBtn: {
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: "center",
    },
    drawerFooterBtnPressed: { opacity: 0.88 },
    drawerSignOutText: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.destructive,
    },
  });

export type HomeSheetStyles = typeof styles;

function AdminNoAccessPlaceholder({
  webBase,
  onOpenWeb,
}: {
  webBase: string | null;
  onOpenWeb: (path: string) => void | Promise<void>;
}) {
  return (
    <ScrollView contentContainerStyle={{ paddingVertical: 8, paddingBottom: 32 }}>
      <View
        style={{
          padding: 16,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.card,
        }}
      >
        <Text style={{ fontSize: 17, fontWeight: "700", color: theme.foreground }}>No Admin Access</Text>
        <Text style={{ marginTop: 10, fontSize: 14, color: theme.mutedForeground, lineHeight: 21 }}>
          Your account is an admin, but no dashboard sections are assigned yet. Ask the super admin to add
          your email under Admin Access on the web or in this app.
        </Text>
        {webBase ? (
          <Pressable
            style={{
              marginTop: 16,
              alignSelf: "flex-start",
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 8,
              backgroundColor: theme.primary,
            }}
            onPress={() => void onOpenWeb("/")}
          >
            <Text style={{ color: theme.primaryForeground, fontWeight: "600" }}>Open The Nucleus on the web</Text>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}

function profileInitials(fullName: string | undefined, email: string | undefined): string {
  const n = fullName?.trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]![0]!}${parts[parts.length - 1]![0]!}`.toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  }
  const e = email?.trim();
  if (e) return e.slice(0, 2).toUpperCase();
  return "?";
}

function firstNameFromDisplay(displayName: string): string {
  const t = displayName.trim();
  if (!t) return "there";
  return t.split(/\s+/)[0] ?? t;
}

function studentHomeSubtitle(navId: string | null): string {
  switch (navId) {
    case "events":
      return "Your classes and sessions in one place.";
    case "calendar":
      return "Browse your month and agenda.";
    case "attendance":
      return "Mark attendance when you're on campus.";
    case "tasks":
      return "Stay on top of assignments and tasks.";
    case "guest-house":
      return "Request guest house stays.";
    case "sports":
      return "Book sports facilities.";
    case "campus":
      return "Campus services and requests.";
    case "parcels":
      return "Track your parcels.";
    default:
      return "Welcome back.";
  }
}

export function HomeScreen({ session }: { session: Session }) {
  const insets = useSafeAreaInsets();
  const webBase = getPalApiBaseUrl();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeNavId, setActiveNavId] = useState<string | null>(null);
  const [adminAllowedKeys, setAdminAllowedKeys] = useState<Set<string>>(new Set());
  const [adminRoutingReady, setAdminRoutingReady] = useState(false);

  /** 0 = open (flush left); -DRAWER_WIDTH = closed (off-screen left). */
  const translateDrawer = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropFade = useRef(new Animated.Value(0)).current;
  const drawerOpenRef = useRef(false);
  const drawerPanStartXRef = useRef(0);
  const drawerPanCurrentXRef = useRef(-DRAWER_WIDTH);

  useEffect(() => {
    drawerOpenRef.current = drawerOpen;
  }, [drawerOpen]);

  const closeDrawer = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateDrawer, {
        toValue: -DRAWER_WIDTH,
        duration: 260,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: true,
      }),
      Animated.timing(backdropFade, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setDrawerOpen(false);
    });
  }, [translateDrawer, backdropFade]);

  const openDrawer = useCallback(() => {
    setDrawerOpen(true);
  }, []);

  const screenPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (evt, g) => {
          // Only allow swipe-to-open when drawer is closed and swipe starts from left edge
          if (drawerOpenRef.current) return false;
          // Must be swiping right (positive dx)
          if (g.dx < 12) return false;
          // Must be more horizontal than vertical
          if (g.dx < Math.abs(g.dy) * 0.85) return false;
          // Must start from left edge (within 40px)
          const touchX = evt.nativeEvent.pageX - g.dx;
          return touchX < 40;
        },
        onPanResponderGrant: () => {
          // Open drawer when swipe gesture is detected from left edge
          openDrawer();
        },
      }),
    [openDrawer]
  );

  const drawerPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => {
          if (!drawerOpenRef.current) return false;
          return g.dx < -12 && Math.abs(g.dx) > Math.abs(g.dy) * 0.85;
        },
        onPanResponderGrant: () => {
          translateDrawer.stopAnimation((v) => {
            drawerPanStartXRef.current = v;
            drawerPanCurrentXRef.current = v;
          });
        },
        onPanResponderMove: (_, g) => {
          const next = Math.min(
            0,
            Math.max(-DRAWER_WIDTH, drawerPanStartXRef.current + g.dx)
          );
          drawerPanCurrentXRef.current = next;
          translateDrawer.setValue(next);
          backdropFade.setValue(
            Math.max(0, Math.min(1, (DRAWER_WIDTH + next) / DRAWER_WIDTH))
          );
        },
        onPanResponderRelease: (_, g) => {
          const x = drawerPanCurrentXRef.current;
          const threshold = -DRAWER_WIDTH * 0.22;
          if (x < threshold || g.vx < -0.45) {
            Animated.parallel([
              Animated.timing(translateDrawer, {
                toValue: -DRAWER_WIDTH,
                duration: 240,
                easing: Easing.bezier(0.4, 0, 0.2, 1),
                useNativeDriver: true,
              }),
              Animated.timing(backdropFade, {
                toValue: 0,
                duration: 240,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
              }),
            ]).start(({ finished }) => {
              if (finished) setDrawerOpen(false);
            });
          } else {
            Animated.parallel([
              Animated.spring(translateDrawer, {
                toValue: 0,
                useNativeDriver: true,
                damping: 26,
                stiffness: 300,
                mass: 0.88,
              }),
              Animated.timing(backdropFade, {
                toValue: 1,
                duration: 200,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
              }),
            ]).start();
          }
        },
      }),
    [translateDrawer, backdropFade]
  );

  useEffect(() => {
    if (!drawerOpen) return undefined;
    translateDrawer.setValue(-DRAWER_WIDTH);
    backdropFade.setValue(0);
    const id = requestAnimationFrame(() => {
      Animated.parallel([
        Animated.spring(translateDrawer, {
          toValue: 0,
          useNativeDriver: true,
          damping: 26,
          stiffness: 300,
          mass: 0.88,
        }),
        Animated.timing(backdropFade, {
          toValue: 1,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    });
    return () => cancelAnimationFrame(id);
  }, [drawerOpen, translateDrawer, backdropFade]);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, student_group, mobile_phone, face_registered, created_at, updated_at")
      .eq("id", session.user.id)
      .single();
    if (!error && data) {
      const p = data as Profile;
      setProfile(p);
      setActiveNavId((prev) => prev ?? defaultNavId(p.role));
    } else {
      setProfile(null);
    }
    setLoading(false);
  }, [session.user.id]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Poll face_registered after the profile loads false — handles the signup race where
  // saveStudentFacesAfterSignup finishes after HomeScreen has already fetched the profile.
  useEffect(() => {
    if (!(profile?.role === "student" && profile?.face_registered === false)) return;
    let count = 0;
    const id = setInterval(async () => {
      count++;
      const { data } = await getSupabase()
        .from("profiles")
        .select("face_registered")
        .eq("id", session.user.id)
        .single();
      if (data?.face_registered || count >= 8) {
        clearInterval(id);
        if (data?.face_registered) {
          setProfile((p) => (p ? { ...p, face_registered: true } : p));
        }
      }
    }, 2000);
    return () => clearInterval(id);
  }, [profile?.role, profile?.face_registered, session.user.id]);

  useEffect(() => {
    if (!profile) {
      setAdminRoutingReady(false);
      return;
    }
    if (profile.role !== "admin") {
      setAdminRoutingReady(true);
      return;
    }
    if (isSuperAdminProfile(profile)) {
      setAdminAllowedKeys(new Set());
      setAdminRoutingReady(true);
      return;
    }
    setAdminRoutingReady(false);
    let cancelled = false;
    (async () => {
      const supabase = getSupabase();
      const email = normalizeAdminEmail(profile.email);
      const { data, error } = await supabase
        .from("admin_request_routing")
        .select("request_type_key")
        .eq("admin_email", email);
      if (cancelled) return;
      if (error) {
        setAdminAllowedKeys(new Set());
        Alert.alert("Could not load access", error.message);
      } else {
        setAdminAllowedKeys(
          new Set((data ?? []).map((r: { request_type_key: string }) => r.request_type_key))
        );
      }
      setAdminRoutingReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [profile]);

  const navEntries = useMemo(() => {
    if (!profile) return [];
    if (profile.role !== "admin") return navEntriesForRole(profile.role);
    return filterAdminNavForAccess(isSuperAdminProfile(profile), adminAllowedKeys);
  }, [profile, adminAllowedKeys]);

  /** If drawer entries change (e.g. tab removed), avoid a stale activeNavId showing a placeholder. */
  useEffect(() => {
    if (!profile || profile.role === "admin") return;
    const linkIds = navEntries.filter((e) => e.type === "link").map((e) => e.id);
    if (linkIds.length === 0) {
      setActiveNavId(null);
      return;
    }
    setActiveNavId((prev) => {
      if (prev && linkIds.includes(prev)) return prev;
      return defaultNavId(profile.role);
    });
  }, [profile, navEntries]);

  useEffect(() => {
    if (!profile || profile.role !== "admin" || !adminRoutingReady) return;
    const linkIds = navEntries.filter((e) => e.type === "link").map((e) => e.id);
    if (linkIds.length === 0) {
      setActiveNavId(null);
      return;
    }
    setActiveNavId((prev) => {
      if (prev && linkIds.includes(prev)) return prev;
      return linkIds[0] ?? null;
    });
  }, [profile, navEntries, adminRoutingReady, activeNavId]);

  const activeLabel = useMemo(() => {
    const item = navEntries.find((e) => e.type === "link" && e.id === activeNavId);
    return item?.type === "link" ? item.label : "The Nucleus";
  }, [navEntries, activeNavId]);

  const openWeb = useCallback(async (path: string) => {
    if (!webBase) return;
    const url = `${webBase}${path.startsWith("/") ? path : `/${path}`}`;
    if (await Linking.canOpenURL(url)) await Linking.openURL(url);
  }, [webBase]);

  async function signOut() {
    setSigningOut(true);
    await getSupabase().auth.signOut();
    setSigningOut(false);
  }

  function selectNav(id: string) {
    setActiveNavId(id);
    closeDrawer();
  }

  const openProfessorMyRequests = useCallback(() => {
    setActiveNavId("my-requests");
    closeDrawer();
  }, [closeDrawer]);

  const displayName = profile?.full_name?.trim() || session.user.email || "there";
  const needsFace = profile?.role === "student" && profile.face_registered === false;

  const mainContent = useMemo(() => {
    if (!profile) return null;

    if (profile.role === "admin" && adminRoutingReady) {
      const hasNavLinks = navEntries.some((e) => e.type === "link");
      if (!hasNavLinks) {
        return <AdminNoAccessPlaceholder webBase={webBase} onOpenWeb={openWeb} />;
      }
      if (!activeNavId) {
        return (
          <View style={[styles.center, { paddingTop: 24 }]}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        );
      }
    } else if (!activeNavId) {
      return null;
    }

    if (profile.role === "student" && activeNavId === "events") {
      return <StudentEventsScreen profile={profile} />;
    }
    if (profile.role === "student" && activeNavId === "calendar") {
      return <StudentCalendarScreen profile={profile} />;
    }
    if (profile.role === "student" && activeNavId === "attendance") {
      return <StudentAttendanceScreen profile={profile} />;
    }
    if (profile.role === "student" && activeNavId === "tasks") {
      return <StudentTasksScreen profile={profile} />;
    }
    if (profile.role === "student" && activeNavId === "guest-house") {
      return <StudentGuestHouseScreen profile={profile} />;
    }
    if (profile.role === "student" && activeNavId === "sports") {
      return <SportsRequestsScreen profile={profile} requesterRole="student" />;
    }
    if (profile.role === "student" && activeNavId === "campus") {
      return <StudentCampusScreen profile={profile} />;
    }
    if (profile.role === "student" && activeNavId === "parcels") {
      return <UserParcelsScreen profile={profile} />;
    }
    if (profile.role === "professor" && activeNavId === "my-requests") {
      return <ProfessorMyRequestsScreen profile={profile} />;
    }
    if (profile.role === "professor" && activeNavId === "calendar") {
      return (
        <ProfessorCalendarScreen profile={profile} onOpenNewRequest={openProfessorMyRequests} />
      );
    }
    if (profile.role === "professor" && activeNavId === "professor-attendance") {
      return <ProfessorAttendanceScreen profile={profile} />;
    }
    if (profile.role === "professor" && activeNavId === "sports") {
      return <SportsRequestsScreen profile={profile} requesterRole="professor" />;
    }
    if (profile.role === "professor" && activeNavId === "parcels") {
      return <UserParcelsScreen profile={profile} />;
    }
    if (profile.role === "professor" && activeNavId === "script-evaluation") {
      return <ProfessorScriptScreen />;
    }
    if (profile.role === "admin" && activeNavId === "admin-request-routing") {
      if (!isSuperAdminProfile(profile)) {
        return (
          <SectionPlaceholderScreen
            title="Admin Access"
            description="Only the super admin can manage which sections other admins may open."
          />
        );
      }
      return <AdminAccessScreen profile={profile} />;
    }
    if (profile.role === "admin" && activeNavId === "request-overview") {
      return <AdminOverviewScreen />;
    }
    if (profile.role === "admin" && activeNavId === "calendar") {
      return <AdminCalendarScreen />;
    }
    if (profile.role === "admin" && activeNavId === "request-event-requests") {
      return <AdminEventRequestsScreen profile={profile} />;
    }
    if (profile.role === "admin" && activeNavId === "request-guest-house-requests") {
      return <AdminGuestHouseRequestsScreen profile={profile} />;
    }
    if (profile.role === "admin" && activeNavId === "request-sports-requests") {
      return <AdminSportsRequestsScreen profile={profile} />;
    }
    if (profile.role === "admin" && activeNavId === "request-campus-leave") {
      return <AdminCampusQueueScreen profile={profile} kind="leave" />;
    }
    if (profile.role === "admin" && activeNavId === "request-campus-facilities") {
      return <AdminCampusQueueScreen profile={profile} kind="facilities" />;
    }
    if (profile.role === "admin" && activeNavId === "request-campus-mess") {
      return <AdminCampusQueueScreen profile={profile} kind="mess" />;
    }
    if (profile.role === "admin" && activeNavId === "request-campus-health") {
      return <AdminCampusQueueScreen profile={profile} kind="health" />;
    }

    if (profile.role === "admin" && activeNavId === "parcel-management") {
      return <AdminParcelManagementScreen profile={profile} />;
    }
    if (profile.role === "admin" && activeNavId === "avail-guest-house") {
      return <AdminGuestHouseAvailabilityScreen profile={profile} />;
    }
    if (profile.role === "admin" && activeNavId) {
      const availMode = ADMIN_AVAILABILITY_MODE_BY_NAV[activeNavId];
      if (availMode) {
        return <AdminResourceAvailabilityScreen profile={profile} mode={availMode} />;
      }
    }

    const item = navEntries.find((e) => e.type === "link" && e.id === activeNavId);
    return (
      <SectionPlaceholderScreen
        title={item?.type === "link" ? item.label : "Section"}
        description="This area matches the web dashboard. Use The Nucleus in your browser for the full workflow until it is ported to the app."
      />
    );
  }, [profile, activeNavId, navEntries, openProfessorMyRequests, adminRoutingReady, openWeb]);

  const adminNavBlocking =
    profile?.role === "admin" && !isSuperAdminProfile(profile) && !adminRoutingReady;

  if (loading || !profile || adminNavBlocking) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: 8 + insets.top }]}>
        <Pressable
          onPress={() => setDrawerOpen(true)}
          style={styles.menuBtn}
          hitSlop={12}
          accessibilityLabel="Open menu"
        >
          <Text style={styles.menuIcon}>☰</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <NucleusWordmark size="sm" />
          <Text style={styles.headerSection} numberOfLines={1}>
            {activeLabel}
          </Text>
        </View>
        <Pressable onPress={signOut} disabled={signingOut} hitSlop={12} accessibilityLabel="Sign out">
          <Text style={styles.signOut}>{signingOut ? "…" : "Sign out"}</Text>
        </Pressable>
      </View>

      <View {...screenPanResponder.panHandlers} style={{ flex: 1 }}>
        {profile.role === "student" ? (
          <View style={[styles.studentHero, { marginHorizontal: 16 }]}>
            <LinearGradient
              colors={["#e8e9ff", "#f4f2ff", "#faf8ff"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.studentHeroGrad}
            >
              <View style={styles.studentHeroRow}>
                <View style={styles.studentHeroAvatar}>
                  <Text style={styles.studentHeroAvatarText}>
                    {profileInitials(profile.full_name, session.user.email ?? undefined)}
                  </Text>
                </View>
                <View style={styles.studentHeroTextCol}>
                  <Text style={styles.studentHeroHi}>Hi, {firstNameFromDisplay(displayName)}</Text>
                  <Text style={styles.studentHeroSub}>{studentHomeSubtitle(activeNavId)}</Text>
                </View>
              </View>
            </LinearGradient>
          </View>
        ) : (
          <Text style={styles.greeting}>Hello, {displayName}</Text>
        )}

        {needsFace ? (
          <View style={[styles.faceBanner, { marginHorizontal: 16 }]}>
            <Text style={styles.faceTitle}>Face registration required</Text>
            <Text style={styles.faceBody}>
              Use the menu and open Face registration to capture photos in the app (or complete on the web).
            </Text>
            {webBase ? (
              <Pressable style={styles.faceBtn} onPress={() => openWeb("/face-registration")}>
                <Text style={styles.faceBtnText}>Open on web</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={[styles.content, profile.role === "student" && styles.contentStudent]}>{mainContent}</View>
      </View>

      <Modal
        visible={drawerOpen}
        animationType="none"
        transparent
        statusBarTranslucent
        onRequestClose={closeDrawer}
      >
        <View style={styles.drawerOverlay}>
          <Animated.View
            pointerEvents="box-none"
            style={[
              StyleSheet.absoluteFill,
              {
                opacity: backdropFade.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1],
                }),
              },
            ]}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={closeDrawer}>
              <View style={[StyleSheet.absoluteFill, styles.drawerBackdropTint]} />
            </Pressable>
          </Animated.View>

          <Animated.View
            {...drawerPanResponder.panHandlers}
            accessibilityViewIsModal
            accessibilityLabel="Navigation menu. Swipe left to close."
            style={[
              styles.drawerPanel,
              {
                width: DRAWER_WIDTH,
                paddingTop: insets.top + 8,
                paddingBottom: Math.max(12, insets.bottom + 8),
                transform: [{ translateX: translateDrawer }],
              },
            ]}
          >
            <LinearGradient
              colors={[theme.primaryDeep, theme.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.drawerHero}
            >
              <View style={styles.drawerAvatar}>
                <Text style={styles.drawerAvatarText}>
                  {profileInitials(profile.full_name, session.user.email ?? undefined)}
                </Text>
              </View>
              <Text style={styles.drawerHeroName} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={styles.drawerHeroEmail} numberOfLines={1}>
                {session.user.email ?? ""}
              </Text>
              <View style={styles.drawerRolePill}>
                <Text style={styles.drawerRolePillText}>{roleTitle(profile.role)}</Text>
              </View>
            </LinearGradient>

            <Text style={styles.drawerNavCaption}>Navigate</Text>

            <ScrollView
              style={styles.drawerScroll}
              contentContainerStyle={styles.drawerScrollContent}
              showsVerticalScrollIndicator={false}
              bounces
            >
              {profile.role === "admin" &&
              adminRoutingReady &&
              !navEntries.some((e) => e.type === "link") ? (
                <View style={{ paddingHorizontal: 14, paddingVertical: 20 }}>
                  <Text style={{ fontSize: 14, color: theme.mutedForeground, lineHeight: 20 }}>
                    No sections are assigned to your account. Ask the super admin to grant access in
                    Admin Access, or use the web dashboard if you have access there.
                  </Text>
                </View>
              ) : (
                navEntries.map((entry, idx) =>
                  entry.type === "heading" ? (
                    <View key={`h-${idx}-${entry.label}`} style={styles.drawerHeadingWrap}>
                      <View style={styles.drawerHeadingRule} />
                      <Text style={styles.drawerHeading}>{entry.label}</Text>
                    </View>
                  ) : (
                    <DrawerNavRow
                      key={entry.id}
                      sheetStyles={styles}
                      label={entry.label}
                      navId={entry.id}
                      active={entry.id === activeNavId}
                      onPress={() => selectNav(entry.id)}
                    />
                  )
                )
              )}
            </ScrollView>

            <View style={styles.drawerFooter}>
              <Pressable
                onPress={() => {
                  closeDrawer();
                  void signOut();
                }}
                style={({ pressed }) => [styles.drawerSignOutBtn, pressed && styles.drawerFooterBtnPressed]}
                disabled={signingOut}
                accessibilityLabel="Sign out"
              >
                <Text style={styles.drawerSignOutText}>{signingOut ? "Signing out…" : "Sign out"}</Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

function roleTitle(role: UserRole): string {
  if (role === "admin") return "Admin";
  if (role === "professor") return "Professor";
  return "Student";
}

function DrawerNavRow({
  sheetStyles,
  label,
  navId,
  active,
  onPress,
}: {
  sheetStyles: HomeSheetStyles;
  label: string;
  navId: string;
  active: boolean;
  onPress: () => void;
}) {
  const s = sheetStyles;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.drawerItem,
        active && s.drawerItemActive,
        pressed && !active && s.drawerItemPressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      {active ? <View style={s.drawerItemActiveBar} /> : null}
      <View style={[s.drawerItemGlyph, active && s.drawerItemGlyphActive]}>
        <Ionicons
          name={drawerNavIconName(navId)}
          size={21}
          color={active ? theme.primary : theme.mutedForeground}
        />
      </View>
      <Text style={[s.drawerItemLabel, active && s.drawerItemLabelActive]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}
