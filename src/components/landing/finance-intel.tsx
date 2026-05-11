"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { TrendingDown, AlertCircle } from "lucide-react";
import { NucleusName } from "@/components/nucleus-wordmark";

function FinanceDashboard() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });

  const W = 2 * Math.PI * 52; // circumference for r=52

  return (
    <div
      ref={ref}
      className="bg-card rounded-2xl border border-border shadow-[0_8px_48px_-12px_rgba(79,70,229,0.12)] overflow-hidden max-w-sm mx-auto"
    >
      {/* header */}
      <motion.div
        className="px-6 py-4 border-b border-border flex items-center justify-between"
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Financial Health</p>
          <p className="text-sm font-bold text-foreground">AY 2025–26 · Semester II</p>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">
          <AlertCircle className="w-3 h-3" />
          Attention needed
        </span>
      </motion.div>

      <div className="px-6 py-5 space-y-6">
        {/* Cashflow line chart */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Fee Collection Trend
          </p>
          <div className="relative h-[60px]">
            <svg viewBox="0 0 280 60" className="w-full h-full" aria-hidden>
              {/* grid lines */}
              {[15, 30, 45].map((y) => (
                <line key={y} x1={0} y1={y} x2={280} y2={y} stroke="#f1f5f9" strokeWidth={1} />
              ))}
              {/* actual line (solid) */}
              <motion.path
                d="M0,45 L40,38 L80,32 L120,28 L160,24 L200,22"
                fill="none"
                stroke="#4f46e5"
                strokeWidth={2}
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={inView ? { pathLength: 1 } : { pathLength: 0 }}
                transition={{ delay: 0.3, duration: 0.9 }}
              />
              {/* projected line (dashed) */}
              <motion.path
                d="M200,22 L240,28 L280,38"
                fill="none"
                stroke="#94a3b8"
                strokeWidth={2}
                strokeDasharray="5 4"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={inView ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
                transition={{ delay: 1.1, duration: 0.6 }}
              />
              {/* divider between actual/projected */}
              <motion.line
                x1={200} y1={0} x2={200} y2={60}
                stroke="#e2e8f0"
                strokeWidth={1}
                strokeDasharray="3 3"
                initial={{ opacity: 0 }}
                animate={inView ? { opacity: 1 } : { opacity: 0 }}
                transition={{ delay: 1.0 }}
              />
              <text x={140} y={58} fill="#94a3b8" fontSize={7}>Actual</text>
              <text x={215} y={58} fill="#94a3b8" fontSize={7}>Projected ↘</text>
            </svg>
          </div>
        </div>

        {/* Collection rate donut */}
        <div className="flex items-center gap-6">
          <div className="relative h-[80px] w-[80px] flex-shrink-0">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90" aria-hidden>
              {/* bg ring */}
              <circle cx={60} cy={60} r={52} fill="none" stroke="#f1f5f9" strokeWidth={12} />
              {/* paid segment — 68% */}
              <motion.circle
                cx={60} cy={60} r={52}
                fill="none"
                stroke="#4f46e5"
                strokeWidth={12}
                strokeLinecap="butt"
                strokeDasharray={W}
                initial={{ strokeDashoffset: W }}
                animate={inView ? { strokeDashoffset: W * (1 - 0.68) } : { strokeDashoffset: W }}
                transition={{ delay: 0.5, duration: 1.0, ease: "easeOut" }}
              />
              {/* pending segment — 18% */}
              <motion.circle
                cx={60} cy={60} r={52}
                fill="none"
                stroke="#f59e0b"
                strokeWidth={12}
                strokeLinecap="butt"
                strokeDasharray={`${W * 0.18} ${W * 0.82}`}
                strokeDashoffset={-W * 0.68}
                initial={{ opacity: 0 }}
                animate={inView ? { opacity: 1 } : { opacity: 0 }}
                transition={{ delay: 1.4 }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-sm font-bold text-foreground">68%</span>
              <span className="text-[9px] text-muted-foreground">collected</span>
            </div>
          </div>

          <div className="space-y-1.5 text-xs">
            {[
              { label: "Paid",    pct: "68%", color: "bg-primary" },
              { label: "Pending", pct: "18%", color: "bg-amber-400" },
              { label: "Overdue", pct: "14%", color: "bg-red-400" },
            ].map((seg) => (
              <div key={seg.label} className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-sm ${seg.color}`} />
                <span className="text-muted-foreground">{seg.label}</span>
                <span className="font-semibold text-foreground ml-auto pl-3">{seg.pct}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Projection card */}
        <motion.div
          className="p-4 rounded-xl bg-red-50 border border-red-100"
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          transition={{ delay: 1.6, duration: 0.5 }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <TrendingDown className="w-4 h-4 text-red-500" />
            <p className="text-xs font-bold text-red-700">Forward Projection</p>
          </div>
          <p className="text-sm font-semibold text-red-800">
            Projected shortfall of ₹18.4L by March 2026
          </p>
          <p className="text-[10px] text-red-600 mt-1">
            At current collection velocity — 47 students overdue &gt; 60 days
          </p>
        </motion.div>
      </div>
    </div>
  );
}

export function FinanceIntel() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });

  return (
    <section id="finance-intel" className="section-lg bg-card">
      <div className="container-wide">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Dashboard first on desktop (right), text left */}
          <FinanceDashboard />

          <motion.div
            ref={ref}
            initial={{ opacity: 0, x: 24 }}
            animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: 24 }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="eyebrow">Financial Intelligence</p>
            <h2
              className="font-display font-bold text-foreground tracking-tight mb-5"
              style={{ fontSize: "clamp(1.9rem, 3.5vw, 2.8rem)" }}
            >
              Your balance sheet tells you
              what happened.
              <br />
              <NucleusName /> tells you
              what&apos;s coming.
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Real-time cashflow monitoring, fee collection velocity tracking, and
              forward-looking projections. Know your financial health across programs,
              campuses, and academic years — before the auditor does.
            </p>
            <ul className="space-y-3">
              {[
                "Fee collection rates per program, per batch, per day",
                "Overdue student lists ranked by amount and age",
                "Shortfall projections updated automatically",
                "Escalation workflows triggered by threshold rules",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <span className="mt-1 h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
