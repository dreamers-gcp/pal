import { StyleSheet, Text, View } from "react-native";
import { theme } from "../theme";

type Props = { size?: "sm" | "lg"; inverse?: boolean };

/**
 * Text wordmark aligned with web `PlanovaWordmark` (bar + PLAN/OVA).
 */
export function PlanovaWordmark({ size = "lg", inverse = false }: Props) {
  const barH = size === "lg" ? 24 : 18;
  const planSize = size === "lg" ? 16 : 12;
  const fg = inverse ? "rgba(255,255,255,0.95)" : theme.foreground;
  const ovaColor = inverse ? "#ffffff" : theme.primary;

  return (
    <View style={styles.row} accessibilityLabel="Planova">
      <View
        style={[
          styles.bar,
          { height: barH },
          inverse ? styles.barInverse : styles.barDefault,
        ]}
      />
      <Text style={[styles.word, { fontSize: planSize }]}>
        <Text style={{ color: fg, fontWeight: "600", letterSpacing: 2.4 }}>PLAN</Text>
        <Text style={{ color: ovaColor, fontWeight: "600", letterSpacing: 2.4 }}>OVA</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  bar: { width: 3, borderRadius: 999 },
  barDefault: { backgroundColor: theme.primary },
  barInverse: { backgroundColor: "rgba(255,255,255,0.9)" },
  word: { flexDirection: "row", letterSpacing: 2 },
});
