import { cn } from "@/lib/utils";

export type PlanovaWordmarkProps = {
  /** Light backgrounds */
  variant?: "default" | "inverse";
  /** Navbar vs marketing vs auth card */
  size?: "sm" | "md" | "lg";
  /** Dashboard icon rail: compact “P” mark only */
  rail?: boolean;
  /**
   * When the wordmark sits inside a control that already has an accessible name
   * (e.g. `Link` with `aria-label="Planova home"`).
   */
  decorative?: boolean;
  className?: string;
};

const sizeClasses = {
  sm: {
    bar: "h-[1.125rem] w-0.5",
    text: "text-xs font-semibold tracking-[0.28em]",
  },
  md: {
    bar: "h-5 w-[3px]",
    text: "text-sm font-semibold tracking-[0.26em]",
  },
  lg: {
    bar: "h-6 w-[3px]",
    text: "text-base font-semibold tracking-[0.26em]",
  },
} as const;

/**
 * Text wordmark for Planova (replaces raster logo). Slim accent bar + PLAN/OVA split.
 */
export function PlanovaWordmark({
  variant = "default",
  size = "md",
  rail = false,
  decorative = false,
  className,
}: PlanovaWordmarkProps) {
  if (rail) {
    const mark = (
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary via-primary to-[#6366f1] text-[12px] font-bold tracking-tight text-white shadow-sm ring-1 ring-primary/20",
          variant === "inverse" &&
            "from-white/25 via-white/20 to-white/10 text-white ring-white/20",
          className
        )}
        aria-hidden
      >
        P
      </span>
    );
    if (decorative) return mark;
    return (
      <>
        <span className="sr-only">Planova</span>
        {mark}
      </>
    );
  }

  const s = sizeClasses[size];

  const visual = (
    <span
      className={cn("inline-flex items-center gap-2.5", className)}
      aria-hidden
    >
      <span
        className={cn(
          "shrink-0 rounded-full bg-gradient-to-b from-primary to-[#6366f1] shadow-[0_0_12px_-2px_rgba(79,70,229,0.45)]",
          s.bar,
          variant === "inverse" &&
            "shadow-none ring-1 ring-white/30 from-white to-white/70"
        )}
      />
      <span className={cn("font-sans leading-none uppercase", s.text)}>
        <span
          className={cn(
            variant === "default" && "text-foreground/90 dark:text-foreground",
            variant === "inverse" && "text-white/95"
          )}
        >
          PLAN
        </span>
        <span
          className={cn(
            "bg-gradient-to-r from-primary to-[#6366f1] bg-clip-text text-transparent",
            variant === "inverse" && "from-white to-white/75"
          )}
        >
          OVA
        </span>
      </span>
    </span>
  );

  if (decorative) return visual;
  return (
    <>
      <span className="sr-only">Planova</span>
      {visual}
    </>
  );
}
