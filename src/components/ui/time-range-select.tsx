"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

const TOTAL_MINUTES = 24 * 60;

/** Generate "HH:mm" times with configurable minute step. */
function getTimeOptions(stepMinutes: number): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  for (let m = 0; m < TOTAL_MINUTES; m += stepMinutes) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    const value = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    const label = formatTime12h(h, min);
    options.push({ value, label });
  }
  return options;
}

function formatTime12h(h24: number, minute: number): string {
  const h12 = h24 % 12 || 12;
  const ampm = h24 < 12 ? "AM" : "PM";
  return `${h12}:${String(minute).padStart(2, "0")} ${ampm}`;
}

function timeToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

export interface TimeRangeSelectProps {
  startValue: string;
  endValue: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  startDisabled?: boolean;
  endDisabled?: boolean;
  startPlaceholder?: string;
  endPlaceholder?: string;
  startLabel?: React.ReactNode;
  endLabel?: React.ReactNode;
  startTriggerId?: string;
  endTriggerId?: string;
  className?: string;
  stepMinutes?: number;
}

/**
 * Two dropdowns: Start time and End time. Options shown as "9:00 AM", "9:15 AM", etc.
 * End time options only include times after the selected start time.
 */
export function TimeRangeSelect({
  startValue,
  endValue,
  onStartChange,
  onEndChange,
  startDisabled,
  endDisabled,
  startPlaceholder = "Start time",
  endPlaceholder = "End time",
  startLabel,
  endLabel,
  startTriggerId,
  endTriggerId,
  className,
  stepMinutes = 15,
}: TimeRangeSelectProps) {
  const allOptions = React.useMemo(() => getTimeOptions(stepMinutes), [stepMinutes]);

  const endOptions = React.useMemo(() => {
    if (!startValue) return allOptions;
    const startMins = timeToMinutes(startValue);
    const minEndMins = startMins + stepMinutes;
    return allOptions.filter((opt) => timeToMinutes(opt.value) >= minEndMins);
  }, [startValue, allOptions, stepMinutes]);

  const endValueValid =
    endValue && endOptions.some((o) => o.value === endValue);
  const effectiveEndValue = endValueValid ? endValue : "";

  React.useEffect(() => {
    if (!startValue || !endOptions.length) return;
    if (endValue && timeToMinutes(endValue) > timeToMinutes(startValue)) return;
    const next = endOptions[0]?.value;
    if (next) onEndChange(next);
  }, [startValue, endValue, endOptions, onEndChange]);

  return (
    <div className={className}>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          {startLabel != null && startLabel}
          <Select
            value={startValue || ""}
            onValueChange={(v) => {
              onStartChange(v ?? "");
              if (endValue && v && timeToMinutes(endValue) <= timeToMinutes(v)) {
                const nextEnd = allOptions.find(
                  (o) => timeToMinutes(o.value) > timeToMinutes(v)
                )?.value;
                if (nextEnd) onEndChange(nextEnd);
              }
            }}
            disabled={startDisabled}
          >
            <SelectTrigger id={startTriggerId} className="w-full">
              <span className="flex flex-1 items-center truncate text-left">
                {startValue
                  ? (allOptions.find((opt) => opt.value === startValue)?.label ?? startValue)
                  : startPlaceholder}
              </span>
            </SelectTrigger>
            <SelectContent>
              {allOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          {endLabel != null && endLabel}
          <Select
            value={effectiveEndValue}
            onValueChange={(v) => onEndChange(v ?? "")}
            disabled={endDisabled || !startValue}
          >
            <SelectTrigger id={endTriggerId} className="w-full">
              <span className="flex flex-1 items-center truncate text-left">
                {effectiveEndValue
                  ? (endOptions.find((opt) => opt.value === effectiveEndValue)?.label ??
                      effectiveEndValue)
                  : endPlaceholder}
              </span>
            </SelectTrigger>
            <SelectContent>
              {endOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
