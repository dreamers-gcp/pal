/** Mirrors `Documents/evaluation/src/common.py` `normalize_math_text`. */
export function normalizeMathText(text: string | null | undefined): string {
  if (text == null) return "";
  let s = text.toLowerCase();
  s = s.replace(/×/g, "*").replace(/·/g, "*");
  s = s.replace(/−/g, "-").replace(/–/g, "-").replace(/—/g, "-");
  s = s.replace(/²/g, "^2").replace(/³/g, "^3");
  s = s.replace(/\brs\.?\b/gi, "");
  s = s.replace(/\s+/g, " ");
  return s.trim();
}
