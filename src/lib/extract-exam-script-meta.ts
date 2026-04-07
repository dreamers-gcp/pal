/**
 * Heuristics on plain text from the first page(s) of an exam answer script PDF.
 * Scanned/image-only PDFs yield empty text — callers should fall back to filename parsing.
 */
export function extractNameRollFromExamScriptText(raw: string): { name: string; roll: string } {
  const text = raw.replace(/\r/g, "\n").replace(/\u00a0/g, " ");
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
