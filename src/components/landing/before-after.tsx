"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const metrics = [
  {
    label: "Time to spot a student at risk",
    before: { value: "6–8 weeks", pct: 82 },
    after:  { value: "< 24 hours", pct: 8 },
  },
  {
    label: "Fee collection visibility",
    before: { value: "Month-end report", pct: 70 },
    after:  { value: "Real-time dashboard", pct: 5 },
  },
  {
    label: "Scheduling conflict resolution",
    before: { value: "Discovered day-of", pct: 90 },
    after:  { value: "Flagged 2 weeks out", pct: 12 },
  },
  {
    label: "Manual coordination hours / week",
    before: { value: "18+ hrs across teams", pct: 78 },
    after:  { value: "~7 hrs (est.)", pct: 28 },
  },
  {
    label: "Cross-department data requests",
    before: { value: "3–5 day turnaround", pct: 65 },
    after:  { value: "Self-serve in seconds", pct: 4 },
  },
];

function MetricRow({
  metric,
  index,
  inView,
}: {
  metric: (typeof metrics)[0];
  index: number;
  inView: boolean;
}) {
  return (
    <motion.div
      className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center py-5 border-b border-border last:border-0"
      initial={{ opacity: 0, y: 16 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
      transition={{ delay: 0.25 + index * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Before */}
      <div className="text-right space-y-1.5">
        <p className="text-xs text-muted-foreground font-medium">{metric.before.value}</p>
        <div className="flex justify-end">
          <div className="h-2 w-full max-w-[160px] bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-red-400/70"
              initial={{ width: "0%" }}
              animate={inView ? { width: `${metric.before.pct}%` } : { width: "0%" }}
              transition={{ delay: 0.4 + index * 0.1, duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>

      {/* Label */}
      <div className="text-center px-2 min-w-[120px]">
        <p className="text-[11px] font-semibold text-muted-foreground leading-snug">
          {metric.label}
        </p>
      </div>

      {/* After */}
      <div className="space-y-1.5">
        <p className="text-xs text-primary font-semibold">{metric.after.value}</p>
        <div className="h-2 w-full max-w-[160px] bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={{ width: "0%" }}
            animate={inView ? { width: `${metric.after.pct}%` } : { width: "0%" }}
            transition={{ delay: 0.55 + index * 0.1, duration: 0.8, ease: "easeOut" }}
          />
        </div>
      </div>
    </motion.div>
  );
}

export function BeforeAfter() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <section className="section-lg bg-card">
      <div className="container-tight">
        <motion.div
          ref={ref}
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          <p className="eyebrow">Before vs After</p>
          <h2
            className="font-display font-bold text-foreground tracking-tight mb-4"
            style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
          >
            The Nucleus in numbers.
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            What changes when your institution stops chasing data and starts acting on it.
          </p>
        </motion.div>

        {/* Column headers */}
        <motion.div
          className="grid grid-cols-[1fr_auto_1fr] gap-4 mb-2 pb-3 border-b border-border"
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 0.15 }}
        >
          <p className="text-right text-xs font-bold text-red-500 uppercase tracking-widest">Before</p>
          <div className="min-w-[120px]" />
          <p className="text-xs font-bold text-primary uppercase tracking-widest">After Nucleus</p>
        </motion.div>

        {/* Metric rows */}
        <div>
          {metrics.map((m, i) => (
            <MetricRow key={m.label} metric={m} index={i} inView={inView} />
          ))}
        </div>

        <motion.p
          className="mt-8 text-center text-xs text-muted-foreground/60"
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 1.1 }}
        >
          Based on results from pilot deployments at XLRI Jamshedpur and XLRI Delhi-NCR.
        </motion.p>
      </div>
    </section>
  );
}
