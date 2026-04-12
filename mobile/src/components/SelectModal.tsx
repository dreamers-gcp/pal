import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { BottomSheetModal } from "./BottomSheetModal";
import { theme } from "../theme";

export type SelectOption = { value: string; label: string };

type Props = {
  visible: boolean;
  title: string;
  options: SelectOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  onClose: () => void;
};

/**
 * Bottom sheet list picker — avoids nesting scrollable `Picker` wheels inside page `ScrollView`.
 * Dismiss: swipe down on the handle, backdrop tap, or Android back.
 */
export function SelectModal({
  visible,
  title,
  options,
  selectedValue,
  onSelect,
  onClose,
}: Props) {
  return (
    <BottomSheetModal visible={visible} onClose={onClose} maxHeight="72%">
      <Text style={styles.sheetTitle}>{title}</Text>
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
        bounces={options.length > 8}
      >
        {options.map((o) => {
          const selected = o.value === selectedValue;
          return (
            <Pressable
              key={o.value}
              onPress={() => {
                onSelect(o.value);
                onClose();
              }}
              style={({ pressed }) => [
                styles.optionRow,
                selected && styles.optionRowSelected,
                pressed && !selected && styles.optionRowPressed,
              ]}
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
    marginBottom: 12,
    paddingHorizontal: 4,
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
