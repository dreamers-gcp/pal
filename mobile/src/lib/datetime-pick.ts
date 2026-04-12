/** Local calendar date ↔ `yyyy-MM-dd` (no UTC shift). */
export function parseYyyyMmDdToLocalDate(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate(), 12, 0, 0, 0);
  }
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  return new Date(y, mo, d, 12, 0, 0, 0);
}

export function formatLocalDateToYyyyMmDd(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

/** Parse `HH:mm` against a calendar day for native time picker value. */
export function parseHHmmToLocalDate(hhmm: string, day: Date): Date {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  const base = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
  if (!m) return base;
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  base.setHours(h, min, 0, 0);
  return base;
}

export function formatLocalDateToHHmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function tomorrowStartLocal(): Date {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  t.setHours(0, 0, 0, 0);
  return t;
}

export function todayYyyyMmDd(): string {
  return formatLocalDateToYyyyMmDd(startOfLocalDay(new Date()));
}
