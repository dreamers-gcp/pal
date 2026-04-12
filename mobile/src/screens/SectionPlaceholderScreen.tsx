import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { getPalApiBaseUrl } from "../lib/config";
import { theme } from "../theme";

export function SectionPlaceholderScreen({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const webBase = getPalApiBaseUrl();

  async function openDashboard() {
    if (!webBase) return;
    const url = `${webBase}/dashboard`;
    if (await Linking.canOpenURL(url)) await Linking.openURL(url);
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{description}</Text>
      {webBase ? (
        <Pressable style={styles.btn} onPress={openDashboard}>
          <Text style={styles.btnText}>Open in Planova (browser)</Text>
        </Pressable>
      ) : (
        <Text style={styles.muted}>Set EXPO_PUBLIC_PAL_API_URL in mobile/.env</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: 8 },
  title: { fontSize: 18, fontWeight: "600", color: theme.foreground },
  body: { marginTop: 10, fontSize: 14, lineHeight: 21, color: theme.mutedForeground },
  btn: {
    marginTop: 18,
    alignSelf: "flex-start",
    backgroundColor: theme.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  btnText: { color: theme.primaryForeground, fontWeight: "600", fontSize: 15 },
  muted: { marginTop: 12, fontSize: 13, color: theme.mutedForeground },
});
