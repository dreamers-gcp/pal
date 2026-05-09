/**
 * Heuristics on plain text from the first page(s) of an exam answer script PDF.
 * Scanned/image-only PDFs yield empty text — callers should fall back to filename parsing.
 */

const META_NAME_KEYS = [
  "name",
  "studentName",
  "student_name",
  "fullName",
  "full_name",
  "candidateName",
  "candidate_name",
] as const;

const META_ROLL_KEYS = [
  "rollNo",
  "roll_no",
  "RollNo",
  "roll",
  "Roll",
  "registrationNo",
  "registration_no",
  "registrationNumber",
  "regNo",
  "reg_no",
  "enrollmentNo",
  "enrollment_no",
  "hallTicketNo",
  "hall_ticket_no",
  "seatNo",
  "seat_no",
] as const;

function stringifyMetaField(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

function readFirstStringField(o: Record<string, unknown>, keys: readonly string[]): string {
  for (const k of keys) {
    const direct = stringifyMetaField(o[k]);
    if (direct) return direct;
    const foundKey = Object.keys(o).find((x) => x.toLowerCase() === k.toLowerCase());
    if (foundKey) {
      const s = stringifyMetaField(o[foundKey]);
      if (s) return s;
    }
  }
  return "";
}

/** Normalize JSON body from POST /api/answer-scripts/extract-script-meta (handles alternate keys). */
export function metaFromExtractScriptApiBody(body: unknown): {
  name: string;
  rollNo: string;
  pages?: number;
  textExtracted?: boolean;
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { name: "", rollNo: "" };
  }
  const o = body as Record<string, unknown>;
  const name = readFirstStringField(o, META_NAME_KEYS);
  const rollNo = readFirstStringField(o, META_ROLL_KEYS);
  const pages = typeof o.pages === "number" && o.pages > 0 ? o.pages : undefined;
  const textExtracted = typeof o.textExtracted === "boolean" ? o.textExtracted : undefined;
  return { name, rollNo, pages, textExtracted };
}

export function extractNameRollFromExamScriptText(raw: string): { name: string; roll: string } {
  const text = raw
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[：﹕]/g, ":")
    .replace(/\uFEFF/g, "");
  const compact = text.replace(/\s+/g, " ");

  let roll = "";
  const rollPatterns: RegExp[] = [
    /(?:roll\s*(?:no\.?|number|#)|registration\s*(?:no\.?|number|#)|reg\.?\s*no\.?|enrollment\s*(?:no\.?|number)?|hall\s*ticket\s*(?:no\.?)?)\s*[:\s.-]+\s*([A-Za-z0-9][A-Za-z0-9\-/]*)/i,
    /\b(?:roll|reg)\s*[#:]?\s*([A-Za-z0-9][A-Za-z0-9\-/]{2,})\b/i,
  ];
  for (const re of rollPatterns) {
    const m = compact.match(re);
    if (m?.[1]) {
      const r = m[1].trim();
      if (r.length >= 3 && r.length <= 32) {
        roll = r;
        break;
      }
    }
  }

  let name = "";
  const namePatterns: RegExp[] = [
    /(?:^|[\n\s])(?:name|student(?:'s)?\s*name|candidate(?:'s)?\s*name|name\s*of\s*(?:the\s*)?(?:student|candidate))\s*[:\s.-]+\s*([A-Za-z][A-Za-z\s.'-]{1,100}?)(?=\s{2,}|$|(?:roll|reg|signature|date|subject)|\n)/i,
    /(?:name|student\s*name)\s*[:\s]+\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/,
    /** Single capitalized word after "Name :" e.g. "Name : Priya" */
    /(?:name|student\s*name)\s*[:\s.-]+\s*([A-Z][a-z]{1,40})(?=\s*(?:roll|reg|hall|signature|subject|date)|\s*$)/i,
  ];
  for (const re of namePatterns) {
    const m = compact.match(re);
    if (m?.[1]) {
      const n = m[1].replace(/\s+/g, " ").trim();
      if (n.length >= 2 && n.length <= 120 && !/^\d+$/.test(n)) {
        name = n;
        break;
      }
    }
  }

  if (!roll) {
    const digitRun = compact.match(/\b(\d{6,12})\b/);
    if (digitRun) roll = digitRun[1];
  }

  return {
    name: name.trim(),
    roll: roll.trim(),
  };
}

/**
 * Parse model JSON for student script metadata. Models often use `roll` instead of `rollNo`,
 * or wrap JSON in markdown fences.
 */
export function parseStudentMetaFromLlmJsonContent(assistantText: string): { name: string; roll: string } {
  let cleaned = assistantText.trim();
  const fence = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence?.[1]) cleaned = fence[1].trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { name: "", roll: "" };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { name: "", roll: "" };
  }

  const o = parsed as Record<string, unknown>;

  return {
    name: readFirstStringField(o, META_NAME_KEYS),
    roll: readFirstStringField(o, META_ROLL_KEYS),
  };
}

/** When PDF text is empty or parsing fails — same idea as previous filename heuristic. */
export function fallbackMetaFromFileName(fileName: string): { name: string; roll: string } {
  const base = fileName.replace(/\.pdf$/i, "");
  const parts = base.split(/[_\s-]+/).filter(Boolean);
  let name = "Unknown student";
  let roll = "—";
  if (parts.length >= 2) {
    roll = parts[parts.length - 1] ?? roll;
    name = parts.slice(0, -1).join(" ").replace(/\b\w/g, (c) => c.toUpperCase()) || name;
  }
  return { name, roll };
}
