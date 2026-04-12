import NetInfo from "@react-native-community/netinfo";
import * as Location from "expo-location";
import { Platform } from "react-native";

export type WifiAttendanceSnapshot = {
  wifi_ssid: string | null;
  wifi_bssid: string | null;
};

let netInfoWifiConfigured = false;

function ensureNetInfoWifiSsidFetch() {
  if (netInfoWifiConfigured) return;
  NetInfo.configure({ shouldFetchWiFiSSID: true });
  netInfoWifiConfigured = true;
}

function pickWifiFromDetails(details: unknown): { ssid: string | null; bssid: string | null } {
  if (!details || typeof details !== "object") {
    return { ssid: null, bssid: null };
  }
  const raw = details as { ssid?: string | null; bssid?: string | null };
  const ssid = typeof raw.ssid === "string" && raw.ssid.trim() !== "" ? raw.ssid.trim() : null;
  const bssid =
    typeof raw.bssid === "string" && raw.bssid.trim() !== "" ? raw.bssid.trim() : null;
  return { ssid, bssid };
}

function mergeInto(
  acc: WifiAttendanceSnapshot,
  p: { ssid: string | null; bssid: string | null }
): WifiAttendanceSnapshot {
  return {
    wifi_ssid: acc.wifi_ssid ?? p.ssid,
    wifi_bssid: acc.wifi_bssid ?? p.bssid,
  };
}

/**
 * Reads the current Wi‑Fi SSID/BSSID when the device is on Wi‑Fi.
 * iOS: needs **Location** when-in-use + **Access WiFi Information** entitlement on the App ID
 * and in the built binary; NetInfo must use `shouldFetchWiFiSSID` (also set at app startup).
 */
export async function getWifiSnapshotForAttendance(): Promise<WifiAttendanceSnapshot> {
  try {
    ensureNetInfoWifiSsidFetch();

    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") {
      return { wifi_ssid: null, wifi_bssid: null };
    }

    /** Apple treats location use as one path to allow Wi‑Fi SSID reads; prime the location stack. */
    if (Platform.OS === "ios") {
      try {
        await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Low,
        });
      } catch {
        /* still try NetInfo */
      }
    }

    await NetInfo.refresh();

    let best: WifiAttendanceSnapshot = { wifi_ssid: null, wifi_bssid: null };

    const wifiState = await NetInfo.fetch("wifi");
    if (wifiState.type === "wifi" && wifiState.isConnected) {
      best = mergeInto(best, pickWifiFromDetails(wifiState.details));
    }

    const anyState = await NetInfo.fetch();
    if (anyState.type === "wifi" && anyState.isConnected) {
      best = mergeInto(best, pickWifiFromDetails(anyState.details));
    }

    return best;
  } catch {
    return { wifi_ssid: null, wifi_bssid: null };
  }
}
