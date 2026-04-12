import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BottomSheetModal } from "./BottomSheetModal";
import { theme } from "../theme";
import type { SelectOption } from "./SelectModal";

type Props = {
  visible: boolean;
  title: string;
  /** Short hint under the title (e.g. tap to toggle). */
  hint?: string;
  options: SelectOption[];
  selectedValues: ReadonlySet<string>;
  onToggle: (value: string) => void;
  onClose: () => void;
};

/**
 * Bottom sheet multi-select — tap rows to toggle ✓. Dismiss: swipe down, backdrop, or Android back.
 */
export function MultiSelectModal({
  visible,
  title,
  hint,
  options,
  selectedValues,
  onToggle,
  onClose,
}: Props) {
  return (
    <BottomSheetModal visible={visible} onClose={onClose} maxHeight="72%">
      <Text style={styles.sheetTitle}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
        bounces={options.length > 8}
      >
        {options.map((o) => {
          const selected = selectedValues.has(o.value);
          return (
            <Pressable
              key={o.value}
              onPress={() => onToggle(o.value)}
              style={({ pressed }) => [
                styles.optionRow,
                selected && styles.optionRowSelected,
                pressed && styles.optionRowPressed,
              ]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
            >
              <Text
                style={[styles.optionLabel, selected && styles.optionLabelSelected]}
                numberOfLines={2}
              >
                {o.label}
              </Text>
              {selected ? <Text style={styles.check}>✓</Text> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheetTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: theme.foreground,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  hint: {
    fontSize: 13,
    color: theme.mutedForeground,
    marginBottom: 10,
    paddingHorizontal: 4,
    lineHeight: 18,
  },
  list: { flexGrow: 0 },
  listContent: { paddingBottom: 4 },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 4,
    gap: 12,
    backgroundColor: theme.pressableMuted,
  },
  optionRowSelected: {
    backgroundColor: theme.activeNavBg,
  },
  optionRowPressed: {
    opacity: 0.92,
  },
  optionLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    color: theme.foreground,
    lineHeight: 22,
  },
  optionLabelSelected: {
    fontWeight: "700",
    color: theme.primaryDeep,
  },
  check: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.primary,
  },
});
