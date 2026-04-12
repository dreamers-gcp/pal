import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { BottomSheetModal } from "../../components/BottomSheetModal";
import {
  ADMIN_DASHBOARD_SECTIONS,
  ADMIN_REQUEST_SUBTABS,
  normalizeAdminEmail,
  sectionLabelForValue,
  type DashboardNavGroup,
} from "../../lib/admin-request-routing";
import { getSupabase } from "../../lib/supabase";
import { theme } from "../../theme";
import type { AdminRequestRouting, Profile } from "../../types";

export function AdminAccessScreen({ profile: _profile }: { profile: Profile }) {
  const [rows, setRows] = useState<AdminRequestRouting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
  const [draftEmail, setDraftEmail] = useState("");
  const [draftKeys, setDraftKeys] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("admin_request_routing")
      .select("*")
      .order("admin_email", { ascending: true })
      .order("request_type_key", { ascending: true });
    if (error) {
      Alert.alert("Could not load", error.message);
      setRows([]);
    } else {
      setRows((data ?? []) as AdminRequestRouting[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const byEmail = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const r of rows) {
      const list = m.get(r.admin_email) ?? [];
      list.push(r.request_type_key);
      m.set(r.admin_email, list);
    }
    return m;
  }, [rows]);

  const filteredEntries = useMemo(() => {
    const entries = [...byEmail.entries()].sort(([a], [b]) => a.localeCompare(b));
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(([email]) => email.toLowerCase().includes(q));
  }, [byEmail, search]);

  function openAddDialog() {
    setDialogMode("add");
    setDraftEmail("");
    setDraftKeys(new Set());
    setDialogOpen(true);
  }

  function openEditDialog(email: string) {
    const norm = normalizeAdminEmail(email);
    setDialogMode("edit");
    setDraftEmail(norm);
    setDraftKeys(new Set(byEmail.get(norm) ?? []));
    setDialogOpen(true);
  }

  function toggleKey(key: string) {
    setDraftKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectGroupAll(group: DashboardNavGroup) {
    const keys = ADMIN_DASHBOARD_SECTIONS.filter((s) => s.navGroup === group).map((s) => s.value);
    setDraftKeys((prev) => {
      const next = new Set(prev);
      for (const k of keys) next.add(k);
      return next;
    });
  }

  function clearGroup(group: DashboardNavGroup) {
    const keys = ADMIN_DASHBOARD_SECTIONS.filter((s) => s.navGroup === group).map((s) => s.value);
    setDraftKeys((prev) => {
      const next = new Set(prev);
      for (const k of keys) next.delete(k);
      return next;
    });
  }

  async function saveDraft() {
    const norm = normalizeAdminEmail(draftEmail);
    if (!norm || !norm.includes("@")) {
      Alert.alert("Invalid email", "Enter a valid admin email.");
      return;
    }
    if (dialogMode === "add" && byEmail.has(norm)) {
      Alert.alert("Already exists", "This email already has access. Use Edit on the row below.");
      return;
    }

    setSaving(true);
    const supabase = getSupabase();
    const { error: delErr } = await supabase.from("admin_request_routing").delete().eq("admin_email", norm);
    if (delErr) {
      Alert.alert("Update failed", delErr.message);
      setSaving(false);
      return;
    }
    const keys = [...draftKeys];
    if (keys.length > 0) {
      const insertRows = keys.map((request_type_key) => ({
        admin_email: norm,
        request_type_key,
      }));
      const { error: insErr } = await supabase.from("admin_request_routing").insert(insertRows);
      if (insErr) {
        Alert.alert("Save failed", insErr.message);
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    setDialogOpen(false);
    Alert.alert(
      "Saved",
      keys.length
        ? `Access for ${norm} (${keys.length} section${keys.length === 1 ? "" : "s"}).`
        : `Removed all access for ${norm}.`
    );
    await load();
  }

  function removeAdmin(email: string) {
    const norm = normalizeAdminEmail(email);
    Alert.alert(
      "Remove access",
      `Remove all access for ${norm}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => void removeAdminConfirmed(norm),
        },
      ]
    );
  }

  async function removeAdminConfirmed(norm: string) {
    const supabase = getSupabase();
    const { error } = await supabase.from("admin_request_routing").delete().eq("admin_email", norm);
    if (error) {
      Alert.alert("Remove failed", error.message);
      return;
    }
    if (dialogOpen && normalizeAdminEmail(draftEmail) === norm) {
      setDialogOpen(false);
    }
    Alert.alert("Removed", `Access removed for ${norm}.`);
    await load();
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>Loading Admin Access…</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Text style={styles.intro}>
        Same as web <Text style={styles.introBold}>Admin → Admin Access</Text>. Choose which drawer sections
        each admin email may use. Until you assign at least one section, they see no admin pages in the app.
      </Text>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Admins</Text>
          <Pressable style={styles.addBtn} onPress={openAddDialog}>
            <Text style={styles.addBtnText}>+ Add admin</Text>
          </Pressable>
        </View>
        <Text style={styles.cardDesc}>
          Tick the pages this admin can use. Until you save, they see nothing.
        </Text>

        <TextInput
          style={styles.search}
          placeholder="Search by email…"
          placeholderTextColor={theme.mutedForeground}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />

        {byEmail.size === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No admins configured yet</Text>
            <Text style={styles.emptyBody}>
              Other admins won't see any sidebar pages until you add them here.
            </Text>
            <Pressable style={styles.addBtnWide} onPress={openAddDialog}>
              <Text style={styles.addBtnText}>+ Add admin</Text>
            </Pressable>
          </View>
        ) : filteredEntries.length === 0 ? (
          <Text style={styles.noMatch}>No emails match your search.</Text>
        ) : (
          <ScrollView style={styles.list} nestedScrollEnabled showsVerticalScrollIndicator={false}>
            {filteredEntries.map(([email, keys]) => (
              <View key={email} style={styles.row}>
                <View style={styles.rowMain}>
                  <Text style={styles.email}>{email}</Text>
                  <Text style={styles.badge}>
                    {keys.length} section{keys.length === 1 ? "" : "s"}
                  </Text>
                  <Text style={styles.keyPreview} numberOfLines={2}>
                    {keys
                      .slice(0, 4)
                      .map((k) => sectionLabelForValue(k))
                      .join(" · ")}
                    {keys.length > 4 ? ` · +${keys.length - 4} more` : ""}
                  </Text>
                </View>
                <View style={styles.rowActions}>
                  <Pressable style={styles.secondaryBtn} onPress={() => openEditDialog(email)}>
                    <Text style={styles.secondaryBtnText}>Edit</Text>
                  </Pressable>
                  <Pressable style={styles.dangerBtn} onPress={() => removeAdmin(email)}>
                    <Text style={styles.dangerBtnText}>Remove</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      <BottomSheetModal
        visible={dialogOpen}
        onClose={() => setDialogOpen(false)}
        dismissDisabled={saving}
        maxHeight="92%"
      >
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>{dialogMode === "add" ? "Add admin" : "Edit access"}</Text>
            <Text style={styles.modalDesc}>
              {dialogMode === "edit"
                ? "Update which sidebar pages this person can open."
                : "Enter their email and choose which pages they can use."}
            </Text>

            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput
              style={[styles.input, dialogMode === "edit" && styles.inputDisabled]}
              placeholder="name@school.edu"
              placeholderTextColor={theme.mutedForeground}
              value={draftEmail}
              onChangeText={setDraftEmail}
              editable={dialogMode === "add" && !saving}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
            {dialogMode === "edit" ? (
              <Text style={styles.hint}>Email can't be changed here.</Text>
            ) : null}

            <View style={styles.groupHeader}>
              <Text style={styles.groupTitle}>Requests</Text>
              <View style={styles.groupBtns}>
                <Pressable onPress={() => selectGroupAll("requests")} disabled={saving}>
                  <Text style={styles.groupLink}>All</Text>
                </Pressable>
                <Pressable onPress={() => clearGroup("requests")} disabled={saving}>
                  <Text style={styles.groupLink}>Clear</Text>
                </Pressable>
              </View>
            </View>
            {ADMIN_REQUEST_SUBTABS.map((tab) => (
              <CheckboxRow
                key={tab.value}
                label={tab.label}
                checked={draftKeys.has(tab.value)}
                onToggle={() => toggleKey(tab.value)}
                disabled={saving}
              />
            ))}

            <View style={[styles.groupHeader, { marginTop: 16 }]}>
              <Text style={styles.groupTitle}>Management</Text>
              <View style={styles.groupBtns}>
                <Pressable onPress={() => selectGroupAll("main")} disabled={saving}>
                  <Text style={styles.groupLink}>All</Text>
                </Pressable>
                <Pressable onPress={() => clearGroup("main")} disabled={saving}>
                  <Text style={styles.groupLink}>Clear</Text>
                </Pressable>
              </View>
            </View>
            {ADMIN_DASHBOARD_SECTIONS.filter((s) => s.navGroup === "main").map((tab) => (
              <CheckboxRow
                key={tab.value}
                label={tab.label}
                checked={draftKeys.has(tab.value)}
                onToggle={() => toggleKey(tab.value)}
                disabled={saving}
              />
            ))}

            <View style={styles.modalFooter}>
              <Pressable style={styles.saveFooterBtnFull} onPress={() => void saveDraft()} disabled={saving}>
                <Text style={styles.saveFooterBtnText}>{saving ? "Saving…" : "Save"}</Text>
              </Pressable>
            </View>
        </ScrollView>
      </BottomSheetModal>
    </View>
  );
}

function CheckboxRow({
  label,
  checked,
  onToggle,
  disabled,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[styles.checkRow, checked && styles.checkRowOn, disabled && styles.checkRowDisabled]}
      onPress={onToggle}
      disabled={disabled}
    >
      <View style={[styles.box, checked && styles.boxOn]}>
        {checked ? <Text style={styles.checkMark}>✓</Text> : null}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14, color: theme.mutedForeground },
  intro: {
    fontSize: 13,
    color: theme.mutedForeground,
    lineHeight: 19,
    marginBottom: 14,
  },
  introBold: { fontWeight: "600", color: theme.foreground },
  card: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 14,
    backgroundColor: theme.card,
    flex: 1,
    minHeight: 120,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  cardTitle: { fontSize: 17, fontWeight: "700", color: theme.foreground },
  cardDesc: { marginTop: 6, fontSize: 13, color: theme.mutedForeground, lineHeight: 18 },
  addBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: theme.primary,
  },
  addBtnText: { fontSize: 13, fontWeight: "600", color: theme.primaryForeground },
  addBtnWide: {
    marginTop: 16,
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: theme.primary,
  },
  search: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: theme.foreground,
    backgroundColor: theme.background,
  },
  emptyBox: {
    marginTop: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: theme.border,
    alignItems: "center",
  },
  emptyTitle: { fontSize: 15, fontWeight: "600", color: theme.foreground },
  emptyBody: {
    marginTop: 8,
    fontSize: 13,
    color: theme.mutedForeground,
    textAlign: "center",
    lineHeight: 19,
  },
  noMatch: { marginTop: 20, textAlign: "center", fontSize: 14, color: theme.mutedForeground },
  list: { marginTop: 12, maxHeight: 400 },
  row: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    gap: 10,
  },
  rowMain: { gap: 6 },
  email: { fontSize: 15, fontWeight: "600", color: theme.foreground },
  badge: { fontSize: 12, color: theme.mutedForeground },
  keyPreview: { fontSize: 12, color: theme.mutedForeground, lineHeight: 17 },
  rowActions: { flexDirection: "row", gap: 8 },
  secondaryBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
  },
  secondaryBtnText: { fontSize: 13, fontWeight: "600", color: theme.foreground },
  dangerBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.destructive,
    backgroundColor: theme.card,
  },
  dangerBtnText: { fontSize: 13, fontWeight: "600", color: theme.destructive },
  modalTitle: { fontSize: 18, fontWeight: "700", color: theme.foreground },
  modalDesc: { marginTop: 8, fontSize: 13, color: theme.mutedForeground, lineHeight: 19 },
  fieldLabel: { marginTop: 16, fontSize: 13, fontWeight: "600", color: theme.foreground },
  input: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: theme.foreground,
    backgroundColor: theme.background,
  },
  inputDisabled: { opacity: 0.65 },
  hint: { marginTop: 6, fontSize: 11, color: theme.mutedForeground },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 20,
    marginBottom: 8,
  },
  groupTitle: { fontSize: 14, fontWeight: "700", color: theme.foreground },
  groupBtns: { flexDirection: "row", gap: 14 },
  groupLink: { fontSize: 13, fontWeight: "600", color: theme.primary },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 8,
    backgroundColor: theme.background,
  },
  checkRowOn: { borderColor: theme.primary, backgroundColor: theme.accentBg },
  checkRowDisabled: { opacity: 0.5 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.card,
  },
  boxOn: { borderColor: theme.primary, backgroundColor: theme.primary },
  checkMark: { fontSize: 13, fontWeight: "800", color: theme.primaryForeground },
  checkLabel: { flex: 1, fontSize: 14, color: theme.foreground, lineHeight: 20 },
  modalFooter: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  saveFooterBtnFull: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: theme.primary,
    alignItems: "center",
  },
  saveFooterBtnText: { fontSize: 15, fontWeight: "600", color: theme.primaryForeground },
});
