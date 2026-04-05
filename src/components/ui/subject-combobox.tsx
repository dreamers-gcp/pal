"use client";

import { useMemo, useState } from "react";
import { ChevronsUpDown, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function SubjectMultiSelect({
  id,
  options,
  value,
  onChange,
  placeholder = "Select subjects (optional)",
  disabled,
  loading,
}: {
  id?: string;
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((s) => s.toLowerCase().includes(q));
  }, [options, query]);

  function toggle(s: string) {
    if (value.includes(s)) {
      onChange(value.filter((x) => x !== s));
    } else {
      onChange([...value, s]);
    }
  }

  const summary =
    loading
      ? "Loading subjects…"
      : value.length === 0
        ? placeholder
        : value.length === 1
          ? value[0]
          : `${value.length} subjects selected`;

  return (
    <div className="space-y-2">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
      >
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              disabled={disabled || loading}
              className="h-9 w-full min-w-0 justify-between px-3 font-normal"
              aria-expanded={open}
              id={id}
            >
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-left",
                  value.length === 0 && !loading && "text-muted-foreground"
                )}
              >
                {summary}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          }
        />
        <PopoverContent
          align="start"
          className="w-80 max-w-[min(calc(100vw-2rem),20rem)] gap-0 p-0"
        >
          <div className="border-b border-border p-2">
            <Input
              placeholder="Search subjects…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8"
              autoComplete="off"
              disabled={loading}
            />
          </div>
          <ul className="max-h-56 overflow-y-auto p-1" role="listbox">
            <li>
              <button
                type="button"
                className="flex w-full rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                onClick={() => onChange([])}
              >
                Clear all
              </button>
            </li>
            {!loading && options.length === 0 ? (
              <li className="px-2 py-3 text-center text-sm text-muted-foreground">
                No subjects found in student enrollments. Ask an admin to upload
                the roster CSV.
              </li>
            ) : filtered.length === 0 ? (
              <li className="px-2 py-3 text-center text-sm text-muted-foreground">
                No matching subjects
              </li>
            ) : (
              filtered.map((s) => {
                const checked = value.includes(s);
                return (
                  <li key={s}>
                    <label
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                        checked && "bg-accent/60"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(s)}
                        className="rounded border-input"
                      />
                      <span className="min-w-0 flex-1 truncate">{s}</span>
                    </label>
                  </li>
                );
              })
            )}
          </ul>
        </PopoverContent>
      </Popover>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((s) => (
            <span
              key={s}
              className="inline-flex max-w-full items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
            >
              <span className="truncate">{s}</span>
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== s))}
                className="shrink-0 rounded p-0.5 hover:bg-primary/20 hover:text-destructive transition-colors"
                aria-label={`Remove ${s}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
