import { createHash } from "node:crypto";

/** Deep-sort object keys like Python `json.dumps(..., sort_keys=True)`. */
function sortKeysDeep(x: unknown): unknown {
  if (x === null || typeof x !== "object") return x;
  if (Array.isArray(x)) return x.map(sortKeysDeep);
  const o = x as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(o).sort()) {
    out[k] = sortKeysDeep(o[k]);
  }
  return out;
}

/** Mirrors `Documents/evaluation/src/common.py` `stable_hash`. */
export function stableHash(obj: unknown): string {
  const payload = JSON.stringify(sortKeysDeep(obj));
  return createHash("sha256").update(payload, "utf8").digest("hex").slice(0, 16);
}
