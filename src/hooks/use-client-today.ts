"use client";

import { useEffect, useState } from "react";

/** Local calendar date as YYYY-MM-DD (not UTC from toISOString). */
function localTodayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Today’s date string for min/max on date pickers, set after mount so SSR and
 * the first client render match (avoids hydration mismatches from UTC vs local
 * or server TZ vs user TZ).
 */
export function useClientTodayIso(): string | undefined {
  const [today, setToday] = useState<string | undefined>(undefined);
  useEffect(() => {
    setToday(localTodayIso());
  }, []);
  return today;
}
