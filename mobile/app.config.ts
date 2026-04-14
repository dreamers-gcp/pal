import type { ExpoConfig } from "expo/config";

/**
 * iOS SSID/BSSID need the "Access WiFi Information" entitlement (`wifi-info`).
 * - Apple Developer → Identifiers → your App ID → enable **Access WiFi Information** → save.
 * - Regenerate provisioning profiles (EAS does this when credentials are synced).
 * - Rebuild the native app (`eas build` or `expo prebuild --clean && expo run:ios`).
 *
 * EAS profiles in `eas.json` set IOS_WIFI_INFO_ENTITLEMENT=1. For **local** `expo run:ios`
 * without EAS, use `IOS_WIFI_INFO_ENTITLEMENT=1` in the environment (or `.env`) after the
 * capability is enabled. Set `IOS_WIFI_INFO_ENTITLEMENT=0` if your signing profile cannot
 * include this capability (e.g. some free / personal setups).
 */
const iosWifiInfoEntitlementEnabled =
  process.env.IOS_WIFI_INFO_ENTITLEMENT === "1" ||
  process.env.IOS_WIFI_INFO_ENTITLEMENT === "true";

export default (): ExpoConfig => ({
  name: "PAL",
  slug: "pal-mobile",
  version: "1.0.0",
  extra: {
    eas: {
      projectId: "cd94f770-d2ca-414a-86dc-a4a59319ae2f",
    },
  },
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  scheme: "pal",
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.pal.mobile",
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        "PAL uses your location permission (required by the system) to read the Wi‑Fi network name when you mark attendance.",
      NSBluetoothAlwaysUsageDescription:
        "PAL uses Bluetooth for optional in-room attendance sessions (professor beacon and relays).",
      NSBluetoothPeripheralUsageDescription:
        "PAL can advertise a short attendance session code to nearby enrolled students over Bluetooth.",
      UIBackgroundModes: ["bluetooth-central", "bluetooth-peripheral"],
    },
    ...(iosWifiInfoEntitlementEnabled
      ? {
          entitlements: {
            "com.apple.developer.networking.wifi-info": true,
          },
        }
      : {}),
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    package: "com.pal.mobile",
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    permissions: [
      "ACCESS_FINE_LOCATION",
      "ACCESS_COARSE_LOCATION",
      "ACCESS_WIFI_STATE",
      "android.permission.BLUETOOTH",
      "android.permission.BLUETOOTH_ADMIN",
      "android.permission.BLUETOOTH_SCAN",
      "android.permission.BLUETOOTH_CONNECT",
      "android.permission.BLUETOOTH_ADVERTISE",
    ],
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    [
      "react-native-ble-plx",
      {
        /** BLE mesh beacons are not used for location; avoids tying scan to location on API 31+. */
        neverForLocation: true,
      },
    ],
    "@react-native-community/datetimepicker",
    [
      "expo-camera",
      {
        cameraPermission:
          "Allow PAL to use the camera for face registration and attendance verification.",
      },
    ],
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "PAL needs location access so the system can share the Wi‑Fi network name when you mark attendance.",
      },
    ],
  ],
});
