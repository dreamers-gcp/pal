"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Shared auth form field styling (login + signup). */
export const authInputClassName = cn(
  "h-auto min-h-0 w-full rounded-[8px] border border-[rgba(26,26,46,0.18)] bg-transparent px-4 py-3 text-base shadow-none outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-0 md:text-sm dark:border-white/18"
);

export function AuthPasswordField({
  id,
  className,
  value,
  onChange,
  placeholder,
  autoComplete = "current-password",
  "aria-invalid": ariaInvalid,
  disabled,
}: React.ComponentProps<"input"> & { id: string }) {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={ariaInvalid}
        disabled={disabled}
        className={cn(authInputClassName, "pr-11", className)}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? (
          <EyeOff className="h-4 w-4" aria-hidden />
        ) : (
          <Eye className="h-4 w-4" aria-hidden />
        )}
      </button>
    </div>
  );
}

export type PasswordStrengthLevel = "weak" | "medium" | "strong";

export function getPasswordStrength(password: string): PasswordStrengthLevel {
  if (!password) return "weak";
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (password.length < 6 || score <= 2) return "weak";
  if (score <= 4) return "medium";
  return "strong";
}

export function PasswordStrengthBar({ password }: { password: string }) {
  const level = getPasswordStrength(password);
  const pct = level === "weak" ? 33 : level === "medium" ? 66 : 100;
  const barColor =
    level === "weak"
      ? "bg-red-500"
      : level === "medium"
        ? "bg-amber-500"
        : "bg-emerald-600";
  const labelColor =
    level === "weak"
      ? "text-red-600 dark:text-red-400"
      : level === "medium"
        ? "text-amber-600 dark:text-amber-400"
        : "text-emerald-600 dark:text-emerald-500";

  const label =
    level === "weak" ? "Weak" : level === "medium" ? "Medium" : "Strong";

  if (!password) {
    return (
      <div className="space-y-1.5">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" />
        <p className="text-xs text-muted-foreground">Password strength</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-[width,background-color] duration-300",
            barColor
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className={cn("text-xs font-medium", labelColor)}>{label}</p>
    </div>
  );
}
