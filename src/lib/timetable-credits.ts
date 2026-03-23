/**
 * Credit → total sessions in term (user-specified mapping).
 * Term ≈ 8 weeks; weekly load is derived separately.
 */
export function totalSessionsFromCredits(credits: number): number {
  const c = credits;
  if (c <= 0) return 0;
  if (c === 1.5) return 10;
  if (c === 2) return 13;
  if (c === 3) return 20;
  if (c < 1.5) return Math.max(1, Math.round((c / 1.5) * 10));
  if (c < 2) return Math.round(10 + ((c - 1.5) / 0.5) * (13 - 10));
  if (c < 3) return Math.round(13 + (c - 2) * (20 - 13));
  return Math.max(1, Math.round((c / 3) * 20));
}

/** Minimum weekly sessions so that 8 weeks can cover total_sessions */
export function weeklySessionsRequired(totalSessionsInTerm: number, termWeeks = 8): number {
  if (totalSessionsInTerm <= 0) return 0;
  return Math.ceil(totalSessionsInTerm / termWeeks);
}

/** Each slot is 1.5h; cap daily teaching hours (hard max 3h = 2 slots) */
export function maxSlotsPerDayFromHours(maxHoursPerDay: number): number {
  const cap = Math.min(3, Math.max(0.5, maxHoursPerDay));
  return Math.max(1, Math.floor(cap / 1.5));
}
