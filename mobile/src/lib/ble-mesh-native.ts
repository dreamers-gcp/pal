import { NativeModules, Platform } from "react-native";
import { BleManager, type Device } from "react-native-ble-plx";
import { PAL_MESH_COMPANY_ID } from "./ble-mesh-constants";
import {
  encodeMeshManufacturerBytes,
  parseMeshManufacturerBytes,
  base64ToUint8Array,
} from "./ble-mesh-payload";
import type { BleMeshBeaconPayloadV1 } from "./ble-mesh-types";

type BleAdvertiserNative = {
  setCompanyId: (id: number) => void;
  broadcast: (
    uid: string,
    manuf: number[],
    opts: Record<string, unknown>
  ) => Promise<string>;
  stopBroadcast: () => Promise<string>;
};

function getBleAdvertiser(): BleAdvertiserNative | null {
  if (Platform.OS === "web") return null;
  const mod = NativeModules.BLEAdvertiser as BleAdvertiserNative | undefined;
  return mod ?? null;
}

export function isBleAdvertiserNativeAvailable(): boolean {
  return getBleAdvertiser() != null;
}

let manager: BleManager | null = null;

export function getBlePlxManager(): BleManager {
  if (!manager) manager = new BleManager();
  return manager;
}

export async function startMeshAdvertise(tokenHex: string, hop: number): Promise<void> {
  const BLEAdvertiser = getBleAdvertiser();
  if (!BLEAdvertiser) {
    throw new Error("BLE advertiser native module is not available. Use a dev build with react-native-ble-advertiser.");
  }
  BLEAdvertiser.setCompanyId(PAL_MESH_COMPANY_ID);
  const manuf = encodeMeshManufacturerBytes(tokenHex, hop);
  // UUID kept for Android module compatibility (not placed in AD after patch).
  await BLEAdvertiser.broadcast("00000000-0000-0000-0000-000000000000", manuf, {
    connectable: false,
    includeDeviceName: false,
    includeTxPowerLevel: false,
  });
}

export async function stopMeshAdvertise(): Promise<void> {
  const BLEAdvertiser = getBleAdvertiser();
  if (!BLEAdvertiser) return;
  try {
    await BLEAdvertiser.stopBroadcast();
  } catch {
    /* ignore */
  }
}

export function parsePayloadFromBlePlxDevice(device: Device): BleMeshBeaconPayloadV1 | null {
  const raw = device.manufacturerData;
  if (!raw) return null;
  try {
    const buf = base64ToUint8Array(raw);
    return parseMeshManufacturerBytes(buf);
  } catch {
    return null;
  }
}
