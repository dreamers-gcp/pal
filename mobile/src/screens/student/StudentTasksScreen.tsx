import { addDays, format, isBefore, isSameDay, parseISO, startOfDay } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { BottomSheetModal } from "../../components/BottomSheetModal";
import { DatePickerField } from "../../components/DatePickerField";
import { RefreshableScrollView } from "../../components/RefreshableScrollView";
import { SelectModal } from "../../components/SelectModal";
import { getSupabase } from "../../lib/supabase";
import { todayYyyyMmDd } from "../../lib/datetime-pick";
import type { Profile, StudentTask, TaskKanbanStatus } from "../../types";
import { theme } from "../../theme";

const STATUSES: TaskKanbanStatus[] = ["todo", "in_progress", "completed"];
const STATUS_LABEL: Record<TaskKanbanStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  completed: "Completed",
};

const STATUS_PILL: Record<
  TaskKanbanStatus,
  { bg: string; text: string; border: string }
> = {
  todo: {
    bg: "rgba(26, 26, 46, 0.06)",
    text: theme.foreground,
    border: theme.border,
  },
  in_progress: {
    bg: "rgba(79, 70, 229, 0.12)",
    text: theme.primaryDeep,
    border: "rgba(79, 70, 229, 0.25)",
  },
  completed: {
    bg: "rgba(16, 185, 129, 0.12)",
    text: "#047857",
    border: "rgba(16, 185, 129, 0.28)",
  },
};

function parseDueLocal(ymd: string): Date {
  return startOfDay(parseISO(ymd.split("T")[0] + "T12:00:00"));
}

function dueDisplay(task: StudentTask): { line: string; tone: "overdue" | "today" | "soon" | "done" | "normal" } {
  const raw = task.due_date?.split("T")[0] ?? "";
  if (!raw) return { line: "No due date", tone: "normal" };
  const d = parseDueLocal(raw);
  const today = startOfDay(new Date());
  const pretty = format(d, "EEE, MMM d");

  if (task.status === "completed") {
    return { line: `Completed · was due ${pretty}`, tone: "done" };
  }
  if (isBefore(d, today)) {
    return { line: `Overdue · ${pretty}`, tone: "overdue" };
  }
  if (isSameDay(d, today)) {
    return { line: "Due today", tone: "today" };
  }
  if (isBefore(d, addDays(today, 7))) {
    return { line: `Due ${pretty}`, tone: "soon" };
  }
  return { line: `Due ${pretty}`, tone: "normal" };
}

function sortTasksForColumn(status: TaskKanbanStatus, list: StudentTask[]): StudentTask[] {
  const copy = [...list];
  if (status === "completed") {
    copy.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    return copy;
  }
  copy.sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    const ad = a.due_date?.split("T")[0] ?? "";
    const bd = b.due_date?.split("T")[0] ?? "";
    if (ad !== bd) return ad.localeCompare(bd);
    return (a.title || "").localeCompare(b.title || "");
  });
  return copy;
}

function TaskCard({
  task,
  onEdit,
  onDelete,
}: {
  task: StudentTask;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const due = dueDisplay(task);
  const pill = STATUS_PILL[task.status];

  const dueStyle =
    due.tone === "overdue"
      ? styles.dueOverdue
      : due.tone === "today"
        ? styles.dueToday
        : due.tone === "soon"
          ? styles.dueSoon
          : due.tone === "done"
            ? styles.dueDone
            : styles.dueNormal;

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Pressable
          onPress={onEdit}
          style={styles.cardMain}
          accessibilityRole="button"
          accessibilityLabel={`Edit task ${task.title}`}
        >
          <Text style={styles.cardTitle} numberOfLines={3}>
            {task.title}
          </Text>
          <View style={styles.cardMetaRow}>
            <View style={[styles.statusPill, { backgroundColor: pill.bg, borderColor: pill.border }]}>
              <Text style={[styles.statusPillText, { color: pill.text }]}>{STATUS_LABEL[task.status]}</Text>
            </View>
            <Text style={[styles.dueLine, dueStyle]} numberOfLines={1}>
              {due.line}
            </Text>
          </View>
          {task.description ? (
            <Text style={styles.cardDesc} numberOfLines={3}>
              {task.description}
            </Text>
          ) : null}
          <Text style={styles.tapHint}>Tap to edit</Text>
        </Pressable>
        <Pressable
          onPress={onDelete}
          style={styles.dismissBtn}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={`Delete task ${task.title}`}
        >
          <Text style={styles.dismissBtnText}>✕</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function StudentTasksScreen({ profile }: { profile: Profile }) {
  const [tasks, setTasks] = useState<StudentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StudentTask | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskKanbanStatus>("todo");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);

  const statusSelectOptions = useMemo(
    () => STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
    []
  );

  const byStatus = useMemo(() => {
    const map: Record<TaskKanbanStatus, StudentTask[]> = {
      todo: [],
      in_progress: [],
      completed: [],
    };
    for (const t of tasks) {
      map[t.status].push(t);
    }
    return map;
  }, [tasks]);

  const load = useCallback(async (silent?: boolean) => {
    if (!silent) setLoading(true);
    const supabase = getSupabase();
    const { data } = await supabase
      .from("student_tasks")
      .select("*")
      .eq("student_id", profile.id)
      .order("sort_order", { ascending: true });
    setTasks((data as StudentTask[]) ?? []);
    if (!silent) setLoading(false);
  }, [profile.id]);

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

  function openNew() {
    setEditing(null);
    setTitle("");
    setDescription("");
    setStatus("todo");
    setDueDate(todayYyyyMmDd());
    setModalOpen(true);
  }

  function openEdit(t: StudentTask) {
    setEditing(t);
    setTitle(t.title);
    setDescription(t.description ?? "");
    setStatus(t.status);
    setDueDate(t.due_date?.split("T")[0] ?? todayYyyyMmDd());
    setModalOpen(true);
  }

  async function save() {
    if (!title.trim()) {
      Alert.alert("Title required", "Add a short title for this task.");
      return;
    }
    setSaving(true);
    const supabase = getSupabase();
    const due = dueDate.trim() || todayYyyyMmDd();

    try {
      if (editing) {
        const { error } = await supabase
          .from("student_tasks")
          .update({
            title: title.trim(),
            description: description.trim() || null,
            status,
            due_date: due,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const colTasks = tasks.filter((t) => t.status === status);
        const maxOrder = colTasks.reduce((m, t) => Math.max(m, t.sort_order), -1);
        const { error } = await supabase.from("student_tasks").insert({
          student_id: profile.id,
          title: title.trim(),
          description: description.trim() || null,
          status,
          sort_order: maxOrder + 1,
          due_date: due,
          updated_at: new Date().toISOString(),
        });
        if (error) throw error;
      }
      setModalOpen(false);
      await load(true);
    } catch {
      Alert.alert("Could not save", "Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(t: StudentTask) {
    Alert.alert("Delete task", `Remove “${t.title}”?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await getSupabase().from("student_tasks").delete().eq("id", t.id).eq("student_id", profile.id);
          load();
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <RefreshableScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshing={refreshing}
        onRefresh={onRefresh}
      >
        <Text style={styles.lead}>
          Keep coursework and deadlines in one place. Pull down to refresh.
        </Text>

        <Pressable onPress={openNew} style={styles.addBtn} accessibilityRole="button">
          <Text style={styles.addBtnText}>+ New task</Text>
        </Pressable>

        {tasks.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No tasks yet</Text>
            <Text style={styles.emptyBody}>
              Add tasks for readings, assignments, or exams. You can set a due date and move items
              across To do → In progress → Completed.
            </Text>
            <Pressable onPress={openNew} style={styles.emptyCta}>
              <Text style={styles.emptyCtaText}>Create your first task</Text>
            </Pressable>
          </View>
        ) : (
          STATUSES.map((st) => {
            const column = sortTasksForColumn(st, byStatus[st]);
            return (
              <View key={st} style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {STATUS_LABEL[st]} ({column.length})
                </Text>
                {column.length === 0 ? (
                  <Text style={styles.columnEmpty}>
                    Nothing here — add a task or change its status when you edit.
                  </Text>
                ) : (
                  column.map((t) => (
                    <TaskCard key={t.id} task={t} onEdit={() => openEdit(t)} onDelete={() => confirmDelete(t)} />
                  ))
                )}
              </View>
            );
          })
        )}
      </RefreshableScrollView>

      <BottomSheetModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        dismissDisabled={saving}
        maxHeight="88%"
        sheetStyle={{ paddingHorizontal: 20 }}
      >
        <KeyboardAvoidingView
          style={{ minHeight: 0 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.sheetTitle}>{editing ? "Edit task" : "New task"}</Text>

              <Text style={styles.label}>Title</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="What do you need to do?"
                placeholderTextColor={theme.mutedForeground}
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Optional notes, links, or checklist items"
                placeholderTextColor={theme.mutedForeground}
                multiline
              />

              <Text style={styles.label}>Status</Text>
              <Pressable
                onPress={() => setStatusModalOpen(true)}
                style={styles.selectTrigger}
                accessibilityRole="button"
                accessibilityLabel="Task status"
              >
                <Text style={styles.selectTriggerText} numberOfLines={1}>
                  {STATUS_LABEL[status]}
                </Text>
                <Text style={styles.selectChevron}>▼</Text>
              </Pressable>
              <SelectModal
                visible={statusModalOpen}
                title="Status"
                options={statusSelectOptions}
                selectedValue={status}
                onSelect={(v) => setStatus(v as TaskKanbanStatus)}
                onClose={() => setStatusModalOpen(false)}
              />

              <DatePickerField label="Due date" value={dueDate} onChange={setDueDate} containerStyle={styles.fieldGap} />

              <View style={styles.sheetActions}>
                <Pressable
                  onPress={() => void save()}
                  style={[styles.saveBtn, saving && styles.dim]}
                  disabled={saving}
                >
                  <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Save"}</Text>
                </Pressable>
              </View>
            </ScrollView>
        </KeyboardAvoidingView>
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { flex: 1 },
  content: { paddingBottom: 32 },
  lead: {
    fontSize: 13,
    color: theme.mutedForeground,
    lineHeight: 19,
    marginBottom: 14,
  },
  addBtn: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.primary,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  addBtnText: { color: theme.primaryForeground, fontWeight: "700", fontSize: 16 },
  section: { marginBottom: 8 },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: theme.foreground, marginBottom: 10 },
  columnEmpty: {
    fontSize: 13,
    color: theme.mutedForeground,
    fontStyle: "italic",
    marginBottom: 12,
    lineHeight: 18,
  },
  emptyCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.accentBg,
    alignItems: "center",
  },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: theme.foreground, marginBottom: 8 },
  emptyBody: {
    fontSize: 14,
    color: theme.mutedForeground,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 16,
  },
  emptyCta: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: theme.primary,
  },
  emptyCtaText: { color: theme.primaryForeground, fontWeight: "700", fontSize: 15 },
  card: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
    marginBottom: 10,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  cardMain: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 16, fontWeight: "600", color: theme.foreground, lineHeight: 22 },
  cardMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusPillText: { fontSize: 12, fontWeight: "700" },
  dueLine: { fontSize: 13, fontWeight: "600", flex: 1, minWidth: 120 },
  dueOverdue: { color: theme.destructive },
  dueToday: { color: "#b45309" },
  dueSoon: { color: theme.primaryDeep },
  dueDone: { color: theme.mutedForeground, fontWeight: "500" },
  dueNormal: { color: theme.mutedForeground, fontWeight: "500" },
  cardDesc: { fontSize: 14, color: theme.foreground, marginTop: 8, lineHeight: 20, opacity: 0.85 },
  tapHint: { marginTop: 8, fontSize: 12, fontWeight: "600", color: theme.primary },
  dismissBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(26, 26, 46, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  dismissBtnText: { fontSize: 16, color: theme.mutedForeground, fontWeight: "600" },
  sheetTitle: { fontSize: 20, fontWeight: "700", color: theme.foreground, marginBottom: 8 },
  fieldGap: { marginTop: 4 },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.mutedForeground,
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.foreground,
    backgroundColor: theme.card,
  },
  textArea: { minHeight: 88, textAlignVertical: "top" },
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
  sheetActions: {
    marginTop: 22,
    marginBottom: 8,
  },
  saveBtn: {
    backgroundColor: theme.primary,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 10,
    alignItems: "center",
  },
  saveBtnText: { color: theme.primaryForeground, fontWeight: "700", fontSize: 16 },
  dim: { opacity: 0.5 },
});
