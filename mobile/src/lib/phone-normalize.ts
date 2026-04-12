/** Strip non-digits from a phone input string. */
export function digitsOnly(input: string): string {
  return input.replace(/\D/g, "");
}

/**
 * Normalize to a 10-digit Indian-style mobile: accepts optional +91 / 91 prefix.
 * Returns null if not exactly 10 digits after normalization.
 */
export function normalizeTenDigitMobile(input: string): string | null {
  const d = digitsOnly(input.trim());
  if (d.length === 10) return d;
  if (d.length === 12 && d.startsWith("91")) return d.slice(2);
  if (d.length === 11 && d.startsWith("0")) return d.slice(1);
  return null;
}

export function isValidTenDigitMobile(input: string): boolean {
  return normalizeTenDigitMobile(input) !== null;
}

export function mobileFieldError(input: string): string | undefined {
  const t = input.trim();
  if (!t) return "Mobile number is required.";
  if (!isValidTenDigitMobile(t))
    return "Enter a valid 10-digit mobile number (optional +91 prefix).";
  return undefined;
}
