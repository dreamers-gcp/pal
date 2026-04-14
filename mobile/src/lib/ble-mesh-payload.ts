import {
  PAL_MESH_COMPANY_ID,
  PAL_MESH_MAX_HOP,
  PAL_MESH_PAYLOAD_V1_LEN,
} from "./ble-mesh-constants";
import type { BleMeshBeaconPayloadV1 } from "./ble-mesh-types";

function hexPairToByte(a: string, b: string): number {
  return parseInt(a + b, 16);
}

/** `public_beacon_token` from Supabase is 16 hex chars (8 bytes). */
export function beaconTokenHexToBytes(tokenHex: string): number[] {
  const t = tokenHex.trim().toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{16}$/.test(t)) {
    throw new Error("Beacon token must be 16 hex characters (8 bytes).");
  }
  const out: number[] = [];
  for (let i = 0; i < 16; i += 2) {
    out.push(hexPairToByte(t[i]!, t[i + 1]!));
  }
  return out;
}

export function encodeMeshManufacturerBytes(
  tokenHex: string,
  hop: number
): number[] {
  if (hop < 0 || hop > 255 || hop > PAL_MESH_MAX_HOP) {
    throw new Error(`hop must be 0–${PAL_MESH_MAX_HOP}`);
  }
  const tokenBytes = beaconTokenHexToBytes(tokenHex);
  return [0x01, ...tokenBytes, hop & 0xff];
}

function companyIdLeFromBytes(b0: number, b1: number): number {
  return b0 | (b1 << 8);
}

/**
 * Parses manufacturer data from a scan (Android often includes LE company id prefix;
 * payload-only buffers are accepted when v1 is at offset 0).
 */
export function parseMeshManufacturerBytes(buf: Uint8Array): BleMeshBeaconPayloadV1 | null {
  if (buf.length < PAL_MESH_PAYLOAD_V1_LEN) return null;

  let off = 0;
  if (buf.length >= 12) {
    const cid = companyIdLeFromBytes(buf[0]!, buf[1]!);
    if (cid === PAL_MESH_COMPANY_ID) off = 2;
  }

  if (off + PAL_MESH_PAYLOAD_V1_LEN > buf.length) return null;
  if (buf[off] !== 0x01) return null;

  const tokenBytes = buf.slice(off + 1, off + 9);
  const hop = buf[off + 9]!;
  if (hop > PAL_MESH_MAX_HOP) return null;

  let hex = "";
  for (let i = 0; i < tokenBytes.length; i++) {
    hex += tokenBytes[i]!.toString(16).padStart(2, "0");
  }

  return { v: 1, t: hex, h: hop };
}

export function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}
