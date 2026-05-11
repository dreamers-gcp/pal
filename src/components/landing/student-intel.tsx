"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { NucleusName } from "@/components/nucleus-wordmark";

function StudentCard() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });

  return (
    <div
      ref={ref}
      className="relative bg-card rounded-2xl border border-border shadow-[0_8px_48px_-12px_rgba(79,70,229,0.15)] overflow-hidden max-w-sm mx-auto"
    >
      {/* card header */}
      <motion.div
        className="px-6 pt-6 pb-4 border-b border-border"
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
            AR
          </div>
          <div>
            <p className="font-semibold text-foreground text-sm">Arjun</p>
            <p className="text-xs text-muted-foreground">B.Tech CSE · Year 2 · Roll 21CS042</p>
          </div>
        </div>
      </motion.div>

      <div className="px-6 py-5 space-y-5">
        {/* Attendance trend */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Attendance (30 days)</p>
            <span className="text-xs font-bold text-red-500">62%</span>
          </div>
          <div className="relative h-[40px]">
            <svg viewBox="0 0 240 40" className="w-full h-full" aria-hidden>
              <motion.path
                d="M0,8 L30,6 L60,5 L90,12 L120,18 L150,22 L180,28 L210,32 L240,35"
                fill="none"
                stroke="#ef4444"
                strokeWidth={2}
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={inView ? { pathLength: 1 } : { pathLength: 0 }}
                transition={{ delay: 0.2, duration: 0.9, ease: "easeOut" }}
              />
              <motion.path
                d="M0,8 L30,6 L60,5 L90,12 L120,18 L150,22 L180,28 L210,32 L240,35 L240,40 L0,40 Z"
                fill="#ef4444"
                fillOpacity={0.06}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={inView ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
                transition={{ delay: 0.2, duration: 0.9 }}
              />
            </svg>
          </div>
        </div>

        {/* Assignment completion ring */}
        <div className="flex items-center gap-5">
          <div className="relative h-16 w-16 flex-shrink-0">
            <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90" aria-hidden>
              <circle cx={32} cy={32} r={26} fill="none" stroke="#f1f5f9" strokeWidth={7} />
              <motion.circle
                cx={32} cy={32} r={26}
                fill="none"
                stroke="#f59e0b"
                strokeWidth={7}
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 26}`}
                initial={{ strokeDashoffset: 2 * Math.PI * 26 }}
                animate={inView
                  ? { strokeDashoffset: 2 * Math.PI * 26 * (1 - 0.6) }
                  : { strokeDashoffset: 2 * Math.PI * 26 }}
                transition={{ delay: 0.6, duration: 0.8, ease: "easeOut" }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-foreground">60%</span>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Assignments</p>
            <p className="text-sm text-foreground">6 of 10 submitted</p>
          </div>
        </div>

        {/* Mid-term score bar */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mid-term Score</p>
            <span className="text-xs font-bold text-red-500">42 / 100</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-red-400 rounded-full"
              initial={{ width: "0%" }}
              animate={inView ? { width: "42%" } : { width: "0%" }}
              transition={{ delay: 0.8, duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Risk badge */}
        <motion.div
          className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-200"
          initial={{ opacity: 0, x: 20 }}
          animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
          transition={{ delay: 1.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <div>
            <p className="text-xs font-bold text-red-700">At Risk</p>
            <p className="text-[10px] text-red-600">Recommended: Faculty counselor review</p>
          </div>
        </motion.div>
      </div>

      {/* cohort insight bar */}
      <motion.div
        className="px-6 py-3 bg-muted/50 border-t border-border"
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : { opacity: 0 }}
        transition={{ delay: 1.4 }}
      >
        <p className="text-[10px] text-muted-foreground">
          <span className="font-semibold text-foreground">Mech Engg Year 2:</span>{" "}
          23% of students flagged — highest across all programs
        </p>
      </motion.div>
    </div>
  );
}

export function StudentIntel() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });

  return (
    <section id="student-intel" className="section-lg bg-background">
      <div className="container-wide">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Text */}
          <motion.div
            ref={ref}
            initial={{ opacity: 0, x: -24 }}
            animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: -24 }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="eyebrow">Student Intelligence</p>
            <h2
              className="font-display font-bold text-foreground tracking-tight mb-5"
              style={{ fontSize: "clamp(1.9rem, 3.5vw, 2.8rem)" }}
            >
              Every student is a story.
              <br />
              <NucleusName /> reads
              <br />
              between the lines.
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Individual student profiles combine attendance patterns, assignment submissions,
              exam performance, and engagement signals into a single risk score.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-8">
              <span className="font-semibold text-foreground">Early-warning alerts</span> surface
              students who need intervention — weeks before they fail, not after.
            </p>

            <ul className="space-y-3">
              {[
                "Risk scores updated daily across every student",
                "Alerts routed automatically to the right faculty member",
                "Cohort-level views for program directors and deans",
                "Intervention history logged for accountability",
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

          {/* Card visual */}
          <StudentCard />
        </div>
      </div>
    </section>
  );
}
