/**
 * Decorative full-page background for the marketing landing: nucleus motif,
 * faint orbits, and atom-like nodes (low contrast so content stays readable).
 */
export function LandingPageBackdrop({ className }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ""}`}
      aria-hidden
    >
      <svg
        className="h-full min-h-full w-full text-primary opacity-[0.22] dark:opacity-[0.18]"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 1400 900"
      >
        <defs>
          <radialGradient id="landing-nucleus-wash" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor="var(--nucleus-bright)" stopOpacity="0.35" />
            <stop offset="45%" stopColor="var(--nucleus-core)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <radialGradient id="landing-nucleus-core" cx="40%" cy="35%" r="55%">
            <stop offset="0%" stopColor="var(--nucleus-mist)" stopOpacity="0.9" />
            <stop offset="55%" stopColor="var(--nucleus-soft)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="var(--nucleus-core)" stopOpacity="0.35" />
          </radialGradient>
        </defs>

        {/* Soft field */}
        <ellipse cx="1080" cy="180" rx="420" ry="280" fill="url(#landing-nucleus-wash)" transform="rotate(-18 1080 180)" />
        <ellipse cx="220" cy="720" rx="380" ry="260" fill="url(#landing-nucleus-wash)" transform="rotate(12 220 720)" />

        {/* Orbits */}
        <ellipse
          cx="700"
          cy="420"
          rx="520"
          ry="220"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.75"
          strokeDasharray="6 10"
          opacity="0.35"
          transform="rotate(-22 700 420)"
        />
        <ellipse
          cx="700"
          cy="420"
          rx="380"
          ry="300"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.65"
          opacity="0.22"
          transform="rotate(38 700 420)"
        />

        {/* Main nucleus (hub) */}
        <g transform="translate(1020 140)">
          <circle r="118" fill="none" stroke="currentColor" strokeWidth="0.9" strokeDasharray="4 7" opacity="0.4" />
          <circle r="82" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.32" />
          <circle r="52" fill="none" stroke="currentColor" strokeWidth="1.05" opacity="0.38" />
          <circle r="28" fill="url(#landing-nucleus-core)" opacity="0.85" />
        </g>

        <g transform="translate(160 760)">
          <circle r="72" fill="none" stroke="currentColor" strokeWidth="0.75" strokeDasharray="3 6" opacity="0.3" />
          <circle r="44" fill="none" stroke="currentColor" strokeWidth="0.9" opacity="0.28" />
          <circle r="20" fill="url(#landing-nucleus-core)" opacity="0.75" />
        </g>

        {/* Atom nodes */}
        {[
          [120, 120],
          [280, 200],
          [420, 90],
          [560, 240],
          [680, 100],
          [840, 180],
          [980, 320],
          [150, 420],
          [320, 520],
          [480, 640],
          [620, 780],
          [900, 640],
          [1240, 480],
          [1280, 220],
          [1050, 520],
          [240, 680],
        ].map(([cx, cy], i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={i % 4 === 0 ? 4 : i % 3 === 0 ? 3 : 2.25}
            fill="currentColor"
            opacity={0.12 + (i % 5) * 0.04}
          />
        ))}

        {/* Faint micro-orbits around a few atoms */}
        <g fill="none" stroke="currentColor" strokeWidth="0.55" opacity="0.22">
          <circle cx="840" cy="180" r="14" strokeDasharray="2 4" />
          <circle cx="480" cy="640" r="18" strokeDasharray="3 5" />
          <circle cx="1050" cy="520" r="12" strokeDasharray="2 3" />
        </g>
      </svg>
    </div>
  );
}
