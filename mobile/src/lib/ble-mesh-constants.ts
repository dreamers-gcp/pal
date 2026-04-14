/**
 * Bluetooth SIG company identifiers are 16-bit; this is an unregistered test ID for dev builds.
 * Must match `react-native-ble-advertiser` `setCompanyId` and scan parsing.
 */
export const PAL_MESH_COMPANY_ID = 0x5041;

/** Wire format v1: one byte version, 8 raw token bytes, one hop byte. */
export const PAL_MESH_PAYLOAD_V1_LEN = 10;

/** Mirrors `ble_mesh_max_hop_count()` in `supabase/ble-mesh-attendance.sql`. */
export const PAL_MESH_MAX_HOP = 3;
