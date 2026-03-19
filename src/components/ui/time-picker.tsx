"use client";

import * as React from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function parseTime(t: string): { h: number; m: number } | null {
  const parts = t.split(":");
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return { h, m };
}

function to24h(hour12: number, meridiem: "AM" | "PM"): number {
  const base = hour12 % 12;
  return meridiem === "PM" ? base + 12 : base;
}

function clampToStep(minute: number, step: number) {
  if (step <= 1) return minute;
  return Math.round(minute / step) * step;
}

function toISOTime(h24: number, minute: number): string {
  const h = Math.max(0, Math.min(23, h24));
  const m = Math.max(0, Math.min(59, minute));
  return `${pad2(h)}:${pad2(m)}`;
}

export function TimePicker({
  value,
  onChange,
  stepMinutes = 15,
  min = "00:00",
  max = "23:59",
  placeholder = "Select time",
  disabled,
}: {
  value: string;
  onChange: (t: string) => void;
  stepMinutes?: number;
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const parsed = value ? parseTime(value) : null;

  const initialH24 = parsed?.h ?? 9;
  const initialMeridiem: "AM" | "PM" = initialH24 >= 12 ? "PM" : "AM";
  const initialH12 = ((initialH24 + 11) % 12) + 1; // 1..12
  const initialMin = clampToStep(parsed?.m ?? 0, stepMinutes);

  const [hour12, setHour12] = React.useState(String(initialH12));
  const [minute, setMinute] = React.useState(pad2(initialMin));
  const [meridiem, setMeridiem] = React.useState<"AM" | "PM">(initialMeridiem);

  // Keep internal state in sync when parent value changes externally
  React.useEffect(() => {
    if (!value) return;
    const p = parseTime(value);
    if (!p) return;
    const m = clampToStep(p.m, stepMinutes);
    const md: "AM" | "PM" = p.h >= 12 ? "PM" : "AM";
    const h12 = ((p.h + 11) % 12) + 1;
    setHour12(String(h12));
    setMinute(pad2(m));
    setMeridiem(md);
  }, [value, stepMinutes]);

  function commit(nextHour12: string, nextMinute: string, nextMeridiem: "AM" | "PM") {
    const h12n = Number(nextHour12);
    const mn = Number(nextMinute);
    if (!Number.isFinite(h12n) || !Number.isFinite(mn)) return;
    const h24 = to24h(h12n, nextMeridiem);
    onChange(toISOTime(h24, mn));
  }

  const hourItems = Array.from({ length: 12 }, (_, i) => String(i + 1));
  const minuteItems = (() => {
    const step = Math.max(1, stepMinutes);
    const mins: string[] = [];
    for (let m = 0; m < 60; m += step) mins.push(pad2(m));
    return mins;
  })();

  // Note: min/max are enforced upstream (e.g. booking form). This picker focuses
  // on UX consistency, not complex constraint solving.
  return (
    <div className="grid grid-cols-3 gap-2">
      <Select
        value={value ? hour12 : ""}
        onValueChange={(v) => {
          const next = v ?? "";
          setHour12(next);
          if (next) commit(next, minute, meridiem);
        }}
        disabled={disabled}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {hourItems.map((h) => (
            <SelectItem key={h} value={h}>
              {h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value ? minute : ""}
        onValueChange={(v) => {
          const next = v ?? "";
          setMinute(next);
          if (next) commit(hour12, next, meridiem);
        }}
        disabled={disabled || !hour12}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="mm" />
        </SelectTrigger>
        <SelectContent>
          {minuteItems.map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value ? meridiem : ""}
        onValueChange={(v) => {
          const next = (v ?? "") as "AM" | "PM" | "";
          if (next !== "AM" && next !== "PM") return;
          setMeridiem(next);
          commit(hour12, minute, next);
        }}
        disabled={disabled || !hour12}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="AM/PM" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="AM">AM</SelectItem>
          <SelectItem value="PM">PM</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

