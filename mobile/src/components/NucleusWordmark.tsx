import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../theme";

type Props = { size?: "sm" | "lg"; inverse?: boolean };

/**
 * Hub mark + “The Nucleus” — aligned with web branding (nucleus / orbit metaphor).
 */
export function NucleusWordmark({ size = "lg", inverse = false }: Props) {
  const hubSize = size === "lg" ? 32 : 22;
  const textSize = size === "lg" ? 17 : 12;
  const fgThe = inverse ? "rgba(255,255,255,0.98)" : theme.foreground;
  const ringOuter = inverse ? "rgba(255,255,255,0.38)" : "rgba(67, 56, 202, 0.42)";
  const ringMid = inverse ? "rgba(255,255,255,0.55)" : "rgba(79, 70, 229, 0.52)";
  const nucleusColor = inverse ? "#ffffff" : theme.primary;

  return (
    <View style={styles.row} accessibilityLabel="The Nucleus">
      <View style={[styles.hubWrap, { width: hubSize, height: hubSize }]}>
        <View
          style={[
            styles.ring,
            {
              width: hubSize * 0.92,
              height: hubSize * 0.92,
              borderRadius: hubSize,
              borderColor: ringOuter,
            },
          ]}
        />
        <View
          style={[
            styles.ring,
            {
              width: hubSize * 0.66,
              height: hubSize * 0.66,
              borderRadius: hubSize,
              borderColor: ringMid,
            },
          ]}
        />
        <LinearGradient
          colors={
            inverse
              ? ["#f8fafc", "#e0e7ff", "#c7d2fe"]
              : [theme.primarySoft, theme.primary, "#3730a3"]
          }
          start={{ x: 0.25, y: 0.2 }}
          end={{ x: 0.9, y: 0.95 }}
          style={[
            styles.core,
            {
              width: hubSize * 0.34,
              height: hubSize * 0.34,
              borderRadius: hubSize,
            },
          ]}
        />
      </View>
      <Text style={[styles.word, { fontSize: textSize }]}>
        <Text style={{ color: fgThe, fontWeight: "600" }}>The </Text>
        <Text style={{ color: nucleusColor, fontWeight: "800" }}>Nucleus</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  hubWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    borderWidth: 1.5,
  },
  core: {},
  word: { letterSpacing: 0.2 },
});
