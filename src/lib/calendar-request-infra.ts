/**
 * `calendar_requests.infra_requirements` — optional event infrastructure (jsonb).
 */
export interface CalendarRequestInfraRequirements {
  mic_count?: number;
  sofa_count?: number;
  video_recording?: boolean;
  photography?: boolean;
  stage?: boolean;
  momento_count?: number;
  bouquet_count?: number;
}

function isNonNegInt(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0;
}

/** Build JSON for insert; null if nothing specified. */
export function encodeCalendarRequestInfra(
  input: CalendarRequestInfraRequirements
): CalendarRequestInfraRequirements | null {
  const out: CalendarRequestInfraRequirements = {};
  if (isNonNegInt(input.mic_count)) out.mic_count = input.mic_count;
  if (isNonNegInt(input.sofa_count)) out.sofa_count = input.sofa_count;
  if (isNonNegInt(input.momento_count)) out.momento_count = input.momento_count;
  if (isNonNegInt(input.bouquet_count)) out.bouquet_count = input.bouquet_count;
  if (input.video_recording === true) out.video_recording = true;
  if (input.photography === true) out.photography = true;
  if (input.stage === true) out.stage = true;
  return Object.keys(out).length > 0 ? out : null;
}

export function decodeCalendarRequestInfra(
  raw: unknown
): CalendarRequestInfraRequirements | null {
  if (raw == null) return null;
  let o: Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      o = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  } else if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    o = raw as Record<string, unknown>;
  } else {
    return null;
  }
  const out: CalendarRequestInfraRequirements = {};
  const mic = o.mic_count;
  const sofa = o.sofa_count;
  const mom = o.momento_count;
  const bouq = o.bouquet_count;
  if (isNonNegInt(mic)) out.mic_count = mic;
  if (isNonNegInt(sofa)) out.sofa_count = sofa;
  if (isNonNegInt(mom)) out.momento_count = mom;
  if (isNonNegInt(bouq)) out.bouquet_count = bouq;
  if (o.video_recording === true) out.video_recording = true;
  if (o.photography === true) out.photography = true;
  if (o.stage === true) out.stage = true;
  return Object.keys(out).length > 0 ? out : null;
}

/** Human-readable lines for cards / admin. */
export function formatInfraRequirementsLines(
  infra: CalendarRequestInfraRequirements | null
): string[] {
  if (!infra) return [];
  const lines: string[] = [];
  if (infra.mic_count != null) lines.push(`Mics: ${infra.mic_count}`);
  if (infra.sofa_count != null) lines.push(`Sofas: ${infra.sofa_count}`);
  if (infra.video_recording) lines.push("Video recording");
  if (infra.photography) lines.push("Photography");
  if (infra.stage) lines.push("Stage");
  if (infra.momento_count != null) lines.push(`Momento: ${infra.momento_count}`);
  if (infra.bouquet_count != null) lines.push(`Bouquets: ${infra.bouquet_count}`);
  return lines;
}
