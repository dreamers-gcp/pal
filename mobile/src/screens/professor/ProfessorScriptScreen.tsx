import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { getPalApiBaseUrl } from "../../lib/config";
import { theme } from "../../theme";

export function ProfessorScriptScreen() {
  const webBase = getPalApiBaseUrl();

  async function open() {
    if (!webBase) return;
    const url = `${webBase}/dashboard`;
    if (await Linking.canOpenURL(url)) await Linking.openURL(url);
  }

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Script evaluation</Text>
      <Text style={styles.body}>
        Uploads, rubrics, and marking workflows match the web professor dashboard. Open Planova in
        your browser to use script evaluation with the full UI.
      </Text>
      {webBase ? (
        <Pressable onPress={open} style={styles.btn}>
          <Text style={styles.btnText}>Open Planova</Text>
        </Pressable>
      ) : (
        <Text style={styles.warn}>Set EXPO_PUBLIC_PAL_API_URL in .env</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
  },
  title: { fontSize: 17, fontWeight: "700", marginBottom: 8 },
  body: { fontSize: 14, color: theme.mutedForeground, lineHeight: 21, marginBottom: 16 },
  btn: {
    backgroundColor: theme.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  btnText: { color: theme.primaryForeground, fontWeight: "700", fontSize: 15 },
  warn: { fontSize: 13, color: theme.destructive },
});
