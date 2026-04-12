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
  formatLocalDateToHHmm,
  parseHHmmToLocalDate,
  parseYyyyMmDdToLocalDate,
} from "../lib/datetime-pick";
import { theme } from "../theme";

type Props = {
  label: string;
  value: string;
  onChange: (hhMm: string) => void;
  /** Used to anchor the clock on the correct day (defaults to today). */
  referenceDateIso?: string;
  minuteInterval?: 1 | 2 | 3 | 4 | 5 | 6 | 10 | 12 | 15 | 20 | 30;
  containerStyle?: StyleProp<ViewStyle>;
};

export function TimePickerField({
  label,
  value,
  onChange,
  referenceDateIso,
  minuteInterval = 15,
  containerStyle,
}: Props) {
  const [iosOpen, setIosOpen] = useState(false);
  const [androidOpen, setAndroidOpen] = useState(false);

  const day = useMemo(() => {
    if (referenceDateIso && /^\d{4}-\d{2}-\d{2}$/.test(referenceDateIso)) {
      return parseYyyyMmDdToLocalDate(referenceDateIso);
    }
    return new Date();
  }, [referenceDateIso]);

  const current = useMemo(() => parseHHmmToLocalDate(value || "09:00", day), [value, day]);

  const [iosDraft, setIosDraft] = useState(() => current);

  if (Platform.OS === "web") {
    return (
      <View style={containerStyle}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          placeholderTextColor={theme.mutedForeground}
          autoCapitalize="none"
        />
      </View>
    );
  }

  function open() {
    setIosDraft(parseHHmmToLocalDate(value || "09:00", day));
    if (Platform.OS === "android") setAndroidOpen(true);
    else setIosOpen(true);
  }

  function onAndroidChange(event: DateTimePickerEvent, date?: Date) {
    setAndroidOpen(false);
    if (event.type !== "set" || !date) return;
    onChange(formatLocalDateToHHmm(date));
  }

  const shown = value && /^\d{1,2}:\d{2}$/.test(value.trim()) ? value.trim() : "";

  return (
    <View style={containerStyle}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={open} style={styles.touch}>
        <Text style={value ? styles.touchText : styles.touchPlaceholder}>{shown}</Text>
      </Pressable>

      {Platform.OS === "android" && androidOpen ? (
        <DateTimePicker
          value={current}
          mode="time"
          display="default"
          is24Hour
          minuteInterval={minuteInterval}
          onChange={onAndroidChange}
        />
      ) : null}

      {Platform.OS === "ios" ? (
        <BottomSheetModal visible={iosOpen} onClose={() => setIosOpen(false)} maxHeight="46%">
          <View style={styles.iosHeaderRow}>
            <Pressable
              onPress={() => {
                onChange(formatLocalDateToHHmm(iosDraft));
                setIosOpen(false);
              }}
              hitSlop={12}
            >
              <Text style={[styles.iosHeaderBtn, styles.iosHeaderDone]}>Done</Text>
            </Pressable>
          </View>
          <DateTimePicker
            value={iosDraft}
            mode="time"
            display="spinner"
            themeVariant="light"
            is24Hour
            minuteInterval={minuteInterval}
            onChange={(_, d) => {
              if (d) setIosDraft(d);
            }}
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
