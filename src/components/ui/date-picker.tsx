"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD as a local calendar day (same on server and client for a given string). */
function isoDateOnlyToLocalDate(iso: string): Date {
  const [y, mo, d] = iso.split("T")[0].split("-").map((x) => parseInt(x, 10));
  if (Number.isNaN(y) || Number.isNaN(mo) || Number.isNaN(d)) return new Date(NaN);
  return new Date(y, mo - 1, d);
}

export function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = "Pick a date",
  disabled,
  className,
  /** date-fns format; default is shorter than full month + ordinal (PPP). */
  displayFormat = "MMM d, yyyy",
}: {
  value: string;
  onChange: (nextISO: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  displayFormat?: string;
}) {
  const selected = value ? isoDateOnlyToLocalDate(value) : undefined;
  const minDate = min ? isoDateOnlyToLocalDate(min) : undefined;
  const maxDate = max ? isoDateOnlyToLocalDate(max) : undefined;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full min-w-0 justify-start text-left font-normal",
              !value && "text-muted-foreground",
              className
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            <span className="truncate">
              {value
                ? format(isoDateOnlyToLocalDate(value), displayFormat)
                : placeholder}
            </span>
          </Button>
        }
      />
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => {
            if (!d) return;
            onChange(toISODate(d));
          }}
          disabled={(d) => {
            const iso = toISODate(d);
            if (min && iso < min) return true;
            if (max && iso > max) return true;
            return false;
          }}
          defaultMonth={selected ?? minDate}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

