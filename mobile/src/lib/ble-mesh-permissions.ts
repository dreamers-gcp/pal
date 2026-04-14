import { PermissionsAndroid, Platform, type Permission } from "react-native";

function androidApiLevel(): number {
  const v = Platform.Version;
  return typeof v === "number" ? v : Number(v);
}

async function allChecked(permissions: Permission[]): Promise<boolean> {
  for (const p of permissions) {
    if (!(await PermissionsAndroid.check(p))) return false;
  }
  return true;
}

/**
 * Android 12+ (API 31): BLE scan needs BLUETOOTH_SCAN + BLUETOOTH_CONNECT.
 * Unless `BLUETOOTH_SCAN` is declared with `neverForLocation`, the OS also
 * requires ACCESS_FINE_LOCATION for scanning — our app config matches ble-plx
 * defaults, so we request location here as well.
 */
export async function ensureAndroidBleScanPermissions(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  const api = androidApiLevel();
  if (api >= 31) {
    const need: Permission[] = [
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ];
    if (await allChecked(need)) return true;
    const result = await PermissionsAndroid.requestMultiple(need);
    return need.every((p) => result[p] === PermissionsAndroid.RESULTS.GRANTED);
  }
  const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
  if (await PermissionsAndroid.check(fine)) return true;
  const loc = await PermissionsAndroid.request(fine);
  return loc === PermissionsAndroid.RESULTS.GRANTED;
}

export async function ensureAndroidBleAdvertisePermissions(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  if (Platform.Version >= 31) {
    const adv = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE
    );
    return adv === PermissionsAndroid.RESULTS.GRANTED;
  }
  return true;
}
