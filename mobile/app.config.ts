import type { ExpoConfig } from "expo/config";

/**
 * "Access WiFi Information" is only allowed on a **paid** Apple Developer team.
 * Free Personal Team → leave unset so Xcode can sign. iOS may still return null SSID/BSSID;
 * Android is unaffected.
 *
 * For paid team + EAS: set IOS_WIFI_INFO_ENTITLEMENT=1 (EAS env / .env) and enable the
 * capability on the App ID at developer.apple.com, then `npx expo prebuild --clean`.
 */
const iosWifiInfoEntitlementEnabled =
  process.env.IOS_WIFI_INFO_ENTITLEMENT === "1" ||
  process.env.IOS_WIFI_INFO_ENTITLEMENT === "true";

export default (): ExpoConfig => ({
  name: "PAL",
  slug: "pal-mobile",
  version: "1.0.0",
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
    ],
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
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
