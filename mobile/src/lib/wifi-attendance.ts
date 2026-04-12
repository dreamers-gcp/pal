import NetInfo from "@react-native-community/netinfo";
import * as Location from "expo-location";

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

/**
 * Reads the current Wi‑Fi SSID/BSSID when the device is on Wi‑Fi.
 * OS policy requires location permission; iOS also needs the Wi‑Fi entitlement for SSID/BSSID.
 * Returns nulls if permission denied, not on Wi‑Fi, or the values are unavailable.
 */
export async function getWifiSnapshotForAttendance(): Promise<WifiAttendanceSnapshot> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") {
      return { wifi_ssid: null, wifi_bssid: null };
    }

    ensureNetInfoWifiSsidFetch();
    const state = await NetInfo.fetch("wifi");

    if (state.type !== "wifi" || !state.isConnected) {
      return { wifi_ssid: null, wifi_bssid: null };
    }

    const d = state.details;
    if (!d || typeof d !== "object") {
      return { wifi_ssid: null, wifi_bssid: null };
    }

    const raw = d as { ssid?: string | null; bssid?: string | null };
    const ssid = typeof raw.ssid === "string" && raw.ssid.trim() !== "" ? raw.ssid.trim() : null;
    const bssid =
      typeof raw.bssid === "string" && raw.bssid.trim() !== "" ? raw.bssid.trim() : null;

    return { wifi_ssid: ssid, wifi_bssid: bssid };
  } catch {
    return { wifi_ssid: null, wifi_bssid: null };
  }
}
