import { format } from "date-fns";
import { useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { BottomSheetModal } from "./BottomSheetModal";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import {
  formatLocalDateToYyyyMmDd,
  parseYyyyMmDdToLocalDate,
} from "../lib/datetime-pick";
import { theme } from "../theme";

type Props = {
  label: string;
  value: string;
  onChange: (yyyyMmDd: string) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  placeholder?: string;
  containerStyle?: StyleProp<ViewStyle>;
};

export function DatePickerField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  placeholder = "Select date",
  containerStyle,
}: Props) {
  const [iosOpen, setIosOpen] = useState(false);
  const [androidOpen, setAndroidOpen] = useState(false);
  const [iosDraft, setIosDraft] = useState(() => parseYyyyMmDdToLocalDate(value));

  const display = useMemo(() => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    try {
      return format(parseYyyyMmDdToLocalDate(value), "EEE, MMM d, yyyy");
    } catch {
      return value;
    }
  }, [value]);

  const current = useMemo(() => parseYyyyMmDdToLocalDate(value), [value]);

  if (Platform.OS === "web") {
    return (
      <View style={containerStyle}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          placeholder="yyyy-mm-dd"
          placeholderTextColor={theme.mutedForeground}
          autoCapitalize="none"
        />
      </View>
    );
  }

  function open() {
    setIosDraft(current);
    if (Platform.OS === "android") setAndroidOpen(true);
    else setIosOpen(true);
  }

  function onAndroidChange(event: DateTimePickerEvent, date?: Date) {
    setAndroidOpen(false);
    if (event.type !== "set" || !date) return;
    onChange(formatLocalDateToYyyyMmDd(date));
  }

  return (
    <View style={containerStyle}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={open} style={styles.touch}>
        <Text style={display ? styles.touchText : styles.touchPlaceholder}>
          {display ?? placeholder}
        </Text>
      </Pressable>

      {Platform.OS === "android" && androidOpen ? (
        <DateTimePicker
          value={current}
          mode="date"
          display="default"
          onChange={onAndroidChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      ) : null}

      {Platform.OS === "ios" ? (
        <BottomSheetModal visible={iosOpen} onClose={() => setIosOpen(false)} maxHeight="46%">
          <View style={styles.iosHeaderRow}>
            <Pressable
              onPress={() => {
                onChange(formatLocalDateToYyyyMmDd(iosDraft));
                setIosOpen(false);
              }}
              hitSlop={12}
            >
              <Text style={[styles.iosHeaderBtn, styles.iosHeaderDone]}>Done</Text>
            </Pressable>
          </View>
          <DateTimePicker
            value={iosDraft}
            mode="date"
            display="spinner"
            themeVariant="light"
            onChange={(_, d) => {
              if (d) setIosDraft(d);
            }}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
          />
        </BottomSheetModal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.mutedForeground,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: theme.foreground,
    backgroundColor: theme.card,
  },
  touch: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: theme.card,
  },
  touchText: { fontSize: 15, color: theme.foreground },
  touchPlaceholder: { fontSize: 15, color: theme.mutedForeground },
  iosHeaderRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 8,
  },
  iosHeaderBtn: { fontSize: 17, color: theme.mutedForeground },
  iosHeaderDone: { color: theme.primary, fontWeight: "600" },
});
