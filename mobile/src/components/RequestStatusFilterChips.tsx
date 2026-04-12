import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { RequestStatus } from "../types";
import { theme } from "../theme";
import { SelectModal } from "./SelectModal";

export type RequestStatusFilter = "all" | RequestStatus;

const ITEMS: { value: RequestStatusFilter; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "clarification_needed", label: "Clarification" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

/** Request status filter — bottom sheet list (same pattern as availability dropdowns). */
export function RequestStatusFilterChips({
  value,
  onChange,
}: {
  value: RequestStatusFilter;
  onChange: (v: RequestStatusFilter) => void;
}) {
  const [open, setOpen] = useState(false);
  const options = useMemo(
    () => ITEMS.map((i) => ({ value: i.value, label: i.label })),
    []
  );
  const label = ITEMS.find((i) => i.value === value)?.label ?? "Status";

  return (
    <View style={styles.wrap}>
      <Text style={styles.fieldLabel}>Status</Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={styles.selectTrigger}
        accessibilityRole="button"
        accessibilityLabel="Filter by status"
      >
        <Text style={styles.selectTriggerText} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.selectChevron}>▼</Text>
      </Pressable>
      <SelectModal
        visible={open}
        title="Status"
        options={options}
        selectedValue={value}
        onSelect={(v) => onChange(v as RequestStatusFilter)}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.mutedForeground,
    marginBottom: 4,
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
});
