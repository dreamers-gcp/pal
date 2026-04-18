"use client";

import { useId, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

export type NucleusWordmarkProps = {
  /** Light backgrounds */
  variant?: "default" | "inverse";
  /** Navbar vs marketing vs auth card */
  size?: "sm" | "md" | "lg";
  /** Dashboard icon rail: compact hub mark */
  rail?: boolean;
  /**
   * When the wordmark sits inside a control that already has an accessible name
   * (e.g. `Link` with `aria-label="The Nucleus home"`).
   */
  decorative?: boolean;
  /** Short line under the name — e.g. auth cards and marketing hero */
  tagline?: string;
  /** Center stack (e.g. auth card headers); default aligns tagline under the hub column */
  align?: "start" | "center";
  className?: string;
};

const sizeClasses = {
  sm: {
    hub: 24,
    lead: "text-xs font-semibold tracking-wide",
    accent: "text-xs font-bold tracking-tight",
    tagline: "text-[10px] leading-snug sm:text-[11px]",
  },
  md: {
    hub: 30,
    lead: "text-sm font-semibold tracking-wide",
    accent: "text-sm font-bold tracking-tight",
    tagline: "text-[11px] leading-snug sm:text-xs",
  },
  lg: {
    hub: 44,
    lead: "text-base font-semibold tracking-wide md:text-lg",
    accent: "text-base font-bold tracking-tight md:text-lg md:font-extrabold",
    tagline: "text-xs leading-snug sm:text-sm",
  },
} as const;

type HubVariant = "default" | "inverse";

/** Concentric rings, dashed outer orbit, aurora arc, and nodes — “everything orbits here.” */
export function NucleusHubMark({
  size,
  variant = "default",
  className,
}: {
  size: number;
  variant?: HubVariant;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const gidCore = `nucleus-core-${uid}`;
  const gidSheen = `nucleus-sheen-${uid}`;

  const isInv = variant === "inverse";
  const detailed = size >= 22;

  const outerStroke = isInv ? "rgba(255,255,255,0.4)" : "var(--nucleus-orbit)";
  const midStroke = isInv ? "rgba(255,255,255,0.58)" : "var(--nucleus-hub-mid)";
  const innerStroke = isInv ? "rgba(255,255,255,0.72)" : "var(--nucleus-hub-inner)";
  const arcStroke = isInv ? "rgba(255,255,255,0.55)" : "var(--nucleus-aurora)";
  const nodeFill = isInv ? "#ffffff" : "var(--nucleus-aurora)";

  const R = 43.5;
  const orbitAngles = [-Math.PI / 2, Math.PI / 2.2, Math.PI * 0.78] as const;
  const orbitNodes = orbitAngles.map(
    (a) => [50 + R * Math.cos(a), 50 + R * Math.sin(a)] as const
  );

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <defs>
        <radialGradient id={gidCore} cx="36%" cy="30%" r="65%">
          <stop offset="0%" stopColor={isInv ? "#f8fafc" : "var(--nucleus-soft)"} />
          <stop
            offset="45%"
            stopColor={isInv ? "rgba(224,231,255,0.95)" : "var(--nucleus-bright)"}
          />
          <stop
            offset="100%"
            stopColor={isInv ? "rgba(199,210,254,0.92)" : "var(--nucleus-wordmark-from)"}
          />
        </radialGradient>
        <radialGradient id={gidSheen} cx="32%" cy="28%" r="55%">
          <stop offset="0%" stopColor={isInv ? "rgba(255,255,255,0.55)" : "#ffffff"} />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>

      <circle
        cx={50}
        cy={50}
        r={46}
        fill="none"
        stroke={outerStroke}
        strokeWidth={1.05}
        strokeDasharray="3.2 5.5"
      />
      {detailed ? (
        <path
          d="M 50 6.5 A 43.5 43.5 0 0 1 84 34"
          fill="none"
          stroke={arcStroke}
          strokeWidth={1.25}
          strokeLinecap="round"
          opacity={isInv ? 0.95 : 1}
        />
      ) : null}
      <circle cx={50} cy={50} r={35.5} fill="none" stroke={midStroke} strokeWidth={1.2} />
      <circle cx={50} cy={50} r={24} fill="none" stroke={innerStroke} strokeWidth={1.05} />
      <circle cx={50} cy={50} r={12.8} fill={`url(#${gidCore})`} />
      <circle cx={50} cy={50} r={12.8} fill={`url(#${gidSheen})`} opacity={isInv ? 0.32 : 0.22} />

      {detailed
        ? orbitNodes.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={2.35} fill={nodeFill} opacity={isInv ? 1 : 0.95} />
          ))
        : null}
    </svg>
  );
}

/**
 * Large ambient orbit field for marketing hero / auth panels (decorative).
 */
export function NucleusHeroOrbitAmbient({
  className,
  variant = "default",
}: {
  className?: string;
  variant?: HubVariant;
}) {
  const uid = useId().replace(/:/g, "");
  const gidWash = `nucleus-hero-wash-${uid}`;
  const gidStroke = `nucleus-hero-stroke-${uid}`;

  const isInv = variant === "inverse";
  const washMid = isInv ? "rgba(255,255,255,0.14)" : "var(--nucleus-mist)";
  const washEdge = isInv ? "rgba(255,255,255,0.02)" : "transparent";
  const strokeA = isInv ? "rgba(255,255,255,0.38)" : "var(--nucleus-soft)";
  const strokeB = isInv ? "rgba(255,255,255,0.12)" : "var(--nucleus-core)";
  const node = isInv ? "rgba(255,255,255,0.85)" : "var(--nucleus-aurora)";
  const dashRing = isInv ? "rgba(255,255,255,0.18)" : "var(--nucleus-orbit)";

  return (
    <svg
      viewBox="0 0 520 520"
      className={cn("h-auto w-full max-w-none", className)}
      aria-hidden
    >
      <defs>
        <radialGradient id={gidWash} cx="50%" cy="44%" r="64%">
          <stop offset="0%" stopColor={washMid} stopOpacity={isInv ? 0.5 : 0.65} />
          <stop offset="52%" stopColor={washMid} stopOpacity={isInv ? 0.12 : 0.18} />
          <stop offset="100%" stopColor={washEdge} />
        </radialGradient>
        <linearGradient id={gidStroke} x1="0%" y1="12%" x2="100%" y2="88%">
          <stop offset="0%" stopColor={strokeA} stopOpacity="0.45" />
          <stop offset="100%" stopColor={strokeB} stopOpacity="0.2" />
        </linearGradient>
      </defs>

      <rect width="520" height="520" fill={`url(#${gidWash})`} />

      <g
        fill="none"
        stroke={`url(#${gidStroke})`}
        strokeWidth="1.05"
        strokeLinecap="round"
        opacity={isInv ? 0.85 : 0.95}
      >
        <ellipse cx="260" cy="260" rx="228" ry="124" transform="rotate(-26 260 260)" />
        <ellipse cx="260" cy="260" rx="198" ry="138" transform="rotate(38 260 260)" />
        <ellipse cx="260" cy="260" rx="162" ry="178" transform="rotate(72 260 260)" />
      </g>

      <circle
        cx="260"
        cy="260"
        r="248"
        fill="none"
        stroke={dashRing}
        strokeWidth="0.9"
        strokeDasharray="5 9"
        opacity={0.85}
      />

      {[
        [260, 32],
        [412, 168],
        [118, 364],
        [396, 320],
        [152, 112],
        [280, 428],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={5} fill={node} opacity={0.55 + (i % 3) * 0.12} />
      ))}

      <circle cx="260" cy="260" r="72" fill={isInv ? "rgba(255,255,255,0.06)" : "var(--nucleus-core)"} opacity={isInv ? 1 : 0.06} />
      <circle
        cx="260"
        cy="260"
        r="54"
        fill="none"
        stroke={isInv ? "rgba(255,255,255,0.22)" : "var(--nucleus-bright)"}
        strokeWidth="0.85"
        opacity={0.35}
      />
    </svg>
  );
}

/**
 * Wordmark for The Nucleus — hub mark + “The Nucleus” + optional tagline.
 */
export function NucleusWordmark({
  variant = "default",
  size = "md",
  rail = false,
  decorative = false,
  tagline,
  align = "start",
  className,
}: NucleusWordmarkProps) {
  const s = sizeClasses[size];
  const hubPx = s.hub;

  if (rail) {
    const mark = (
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--nucleus-core)] via-[var(--nucleus-bright)] to-[var(--nucleus-deep)] shadow-[0_6px_22px_-6px_var(--nucleus-glow)] ring-1 ring-black/10 dark:ring-white/20",
          variant === "inverse" &&
            "from-white/30 via-white/18 to-white/8 shadow-[0_8px_28px_-8px_rgba(0,0,0,0.35)] ring-white/40",
          className
        )}
        aria-hidden
      >
        <NucleusHubMark size={20} variant="inverse" />
      </span>
    );
    if (decorative) return mark;
    return (
      <>
        <span className="sr-only">The Nucleus</span>
        {mark}
      </>
    );
  }

  const nameRow = (
    <span
      className={cn("inline-flex items-center gap-2.5", !tagline ? className : undefined)}
      aria-hidden
    >
      <NucleusHubMark
        size={hubPx}
        variant={variant === "inverse" ? "inverse" : "default"}
        className={
          variant === "inverse"
            ? "drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)]"
            : "drop-shadow-[0_2px_10px_rgba(55,48,163,0.35)]"
        }
      />
      <span className={cn("font-sans leading-[1.12]", s.lead)}>
        <span
          className={cn(
            variant === "default" && "text-foreground",
            variant === "inverse" && "text-white"
          )}
        >
          The{" "}
        </span>
        <span
          className={cn(
            s.accent,
            "bg-gradient-to-r from-[var(--nucleus-wordmark-from)] via-[var(--nucleus-bright)] to-[var(--nucleus-wordmark-to)] bg-clip-text text-transparent",
            variant === "inverse" &&
              "from-white via-[#eef2ff] to-[#c7d2fe] bg-clip-text text-transparent"
          )}
        >
          Nucleus
        </span>
      </span>
    </span>
  );

  const taglinePad: CSSProperties =
    align === "start" ? { paddingLeft: hubPx + 10 } : {};

  const visual = tagline ? (
    <span
      className={cn(
        "inline-flex flex-col gap-1.5",
        align === "center" ? "items-center text-center" : "items-start",
        className
      )}
      aria-hidden
    >
      {nameRow}
      <span
        className={cn(
          "w-full max-w-[22rem] font-medium leading-snug tracking-wide",
          s.tagline,
          variant === "default" && "text-muted-foreground",
          variant === "inverse" && "text-white/90"
        )}
        style={taglinePad}
      >
        {tagline}
      </span>
    </span>
  ) : (
    nameRow
  );

  if (decorative) return visual;
  return (
    <>
      <span className="sr-only">The Nucleus{tagline ? `. ${tagline}` : ""}</span>
      {visual}
    </>
  );
}

/** Larger marketing block: wordmark + optional tagline + optional supporting line. */
export function NucleusBrandLockup({
  variant = "default",
  className,
  tagline,
  supporting,
}: {
  variant?: "default" | "inverse";
  className?: string;
  tagline?: string;
  supporting?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <NucleusWordmark variant={variant} size="lg" {...(tagline ? { tagline } : {})} />
      {supporting ? (
        <p
          className={cn(
            "max-w-md text-sm leading-relaxed md:text-base",
            variant === "default" && "text-muted-foreground",
            variant === "inverse" && "text-white/80"
          )}
        >
          {supporting}
        </p>
      ) : null}
    </div>
  );
}
