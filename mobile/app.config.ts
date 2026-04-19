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
  /** Deep links + OAuth return URL (`thenucleus://…`). Separate from `ios.bundleIdentifier` / `android.package`. */
  scheme: "thenucleus",
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "in.thenucleus.app",
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        "The Nucleus uses your location permission (required by the system) to read the Wi-Fi network name when you mark attendance.",
      NSPhotoLibraryUsageDescription:
        "The Nucleus does not access your photo library. If prompted, deny this permission.",
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
    package: "in.thenucleus.app",
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    permissions: [
      // Location: declared by the `expo-location` plugin (with SDK-scoped attrs). Listing them
      // here too merges duplicate `<uses-permission>` rows and Play rejects the AAB.
      "ACCESS_WIFI_STATE",
    ],
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    "expo-web-browser",
    "@react-native-community/datetimepicker",
    [
      "expo-camera",
      {
        cameraPermission:
          "Allow The Nucleus to use the camera for face registration and attendance verification.",
      },
    ],
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "The Nucleus needs location access so the system can share the Wi-Fi network name when you mark attendance.",
      },
    ],
  ],
});
