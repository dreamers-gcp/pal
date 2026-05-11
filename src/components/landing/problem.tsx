"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const problems = [
  {
    eyebrow: "Financial Blindspot",
    headline: "Your ERP knows a fee was paid.\nIt doesn't know you'll have a cash shortfall in March.",
    body: "Transactions are recorded. Patterns are invisible. By the time you notice the gap, the quarter is already lost.",
    visual: <CashflowVisual />,
  },
  {
    eyebrow: "Student Risk",
    headline: "Your register knows who was absent.\nIt doesn't know 23 students are trending toward dropping out.",
    body: "Absenteeism data sits in spreadsheets. No one is connecting the dots until it's too late to intervene.",
    visual: <StudentDotsVisual />,
  },
  {
    eyebrow: "Scheduling Chaos",
    headline: "Your spreadsheets know the timetable.\nThey don't know two departments just double-booked the auditorium.",
    body: "Conflicts are discovered when people show up to the same room. Not before.",
    visual: <ScheduleConflictVisual />,
  },
  {
    eyebrow: "Fragmented Data",
    headline: "Every department has its own data.\nNo one has the full picture.",
    body: "Finance, academics, admissions, and operations each work from their own version of reality. Decisions get made in silos.",
    visual: <DataIslandsVisual />,
  },
];

function ProblemCard({
  problem,
  index,
}: {
  problem: (typeof problems)[0];
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <motion.div
      ref={ref}
      className="grid lg:grid-cols-2 gap-10 items-center py-16 border-b border-white/8 last:border-0"
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className={index % 2 === 1 ? "lg:order-2" : ""}>
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-indigo-400 mb-3">
          {problem.eyebrow}
        </p>
        <h3
          className="font-display font-bold text-white mb-4 whitespace-pre-line"
          style={{ fontSize: "clamp(1.4rem, 2.8vw, 2rem)", lineHeight: 1.2 }}
        >
          {problem.headline}
        </h3>
        <p className="text-slate-400 leading-relaxed">{problem.body}</p>
      </div>
      <div className={`flex items-center justify-center ${index % 2 === 1 ? "lg:order-1" : ""}`}>
        {problem.visual}
      </div>
    </motion.div>
  );
}

/* ── Mini visuals (SVG/CSS) ─────────────────────────────── */

function CashflowVisual() {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref as React.RefObject<Element>, { once: true, amount: 0.5 });

  return (
    <svg ref={ref} viewBox="0 0 280 160" className="w-full max-w-sm" aria-hidden>
      {/* recorded bars */}
      {[40, 65, 55, 80, 70, 60, 85].map((h, i) => (
        <motion.rect
          key={i}
          x={16 + i * 36}
          y={140 - h}
          width={22}
          height={h}
          rx={3}
          fill="#4f46e5"
          fillOpacity={0.5}
          initial={{ scaleY: 0 }}
          animate={inView ? { scaleY: 1 } : { scaleY: 0 }}
          transition={{ delay: i * 0.07, duration: 0.5 }}
          style={{ transformOrigin: "bottom" }}
        />
      ))}
      {/* gap + question mark */}
      <motion.rect
        x={16 + 7 * 36} y={50} width={22} height={90}
        rx={3}
        fill="#94a3b8"
        fillOpacity={0.15}
        stroke="#94a3b8"
        strokeWidth={1}
        strokeDasharray="4 3"
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : { opacity: 0 }}
        transition={{ delay: 0.7 }}
      />
      <motion.text
        x={16 + 7 * 36 + 11} y={100}
        textAnchor="middle"
        fill="#94a3b8"
        fontSize={18}
        fontWeight={700}
        initial={{ opacity: 0, scale: 0 }}
        animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0 }}
        transition={{ delay: 0.9, type: "spring" }}
        style={{ transformOrigin: `${16 + 7 * 36 + 11}px 100px` }}
      >
        ?
      </motion.text>
      {/* x-axis */}
      <line x1={10} y1={142} x2={270} y2={142} stroke="#334155" strokeWidth={1} />
      <text x={8} y={155} fill="#475569" fontSize={9}>Recorded</text>
      <text x={220} y={155} fill="#64748b" fontSize={9}>Projected</text>
    </svg>
  );
}

function StudentDotsVisual() {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref as React.RefObject<Element>, { once: true, amount: 0.5 });

  const dots = Array.from({ length: 40 }, (_, i) => ({
    x: 20 + (i % 8) * 30,
    y: 20 + Math.floor(i / 8) * 30,
    color: i < 30 ? "#22c55e" : i < 36 ? "#f59e0b" : "#ef4444",
    delay: i * 0.03,
  }));

  return (
    <svg ref={ref} viewBox="0 0 260 180" className="w-full max-w-xs" aria-hidden>
      {dots.map((d, i) => (
        <motion.circle
          key={i}
          cx={d.x} cy={d.y} r={9}
          fill={d.color}
          fillOpacity={0.75}
          initial={{ scale: 0 }}
          animate={inView ? { scale: 1 } : { scale: 0 }}
          transition={{ delay: d.delay, type: "spring", stiffness: 200 }}
          style={{ transformOrigin: `${d.x}px ${d.y}px` }}
        />
      ))}
      <motion.text
        x={130} y={172}
        textAnchor="middle"
        fill="#64748b"
        fontSize={9}
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : { opacity: 0 }}
        transition={{ delay: 1.4 }}
      >
        6 at-risk students — no one is watching
      </motion.text>
    </svg>
  );
}

function ScheduleConflictVisual() {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref as React.RefObject<Element>, { once: true, amount: 0.5 });

  return (
    <svg ref={ref} viewBox="0 0 260 160" className="w-full max-w-xs" aria-hidden>
      {/* block A */}
      <motion.rect
        x={40} y={30} width={80} height={50}
        rx={6}
        fill="#4f46e5"
        fillOpacity={0.7}
        initial={{ x: 0, opacity: 0 }}
        animate={inView ? { x: 60, opacity: 1 } : { x: 0, opacity: 0 }}
        transition={{ delay: 0.4, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.text
        x={80} y={60}
        textAnchor="middle"
        fill="white"
        fontSize={9}
        fontWeight={600}
        initial={{ x: 0, opacity: 0 }}
        animate={inView ? { x: 60, opacity: 1 } : { x: 0, opacity: 0 }}
        transition={{ delay: 0.4, duration: 0.6 }}
      >
        Dept A
      </motion.text>

      {/* block B */}
      <motion.rect
        x={140} y={30} width={80} height={50}
        rx={6}
        fill="#ef4444"
        fillOpacity={0.7}
        initial={{ x: 0, opacity: 0 }}
        animate={inView ? { x: -60, opacity: 1 } : { x: 0, opacity: 0 }}
        transition={{ delay: 0.4, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.text
        x={180} y={60}
        textAnchor="middle"
        fill="white"
        fontSize={9}
        fontWeight={600}
        initial={{ x: 0, opacity: 0 }}
        animate={inView ? { x: -60, opacity: 1 } : { x: 0, opacity: 0 }}
        transition={{ delay: 0.4, duration: 0.6 }}
      >
        Dept B
      </motion.text>

      {/* conflict flash */}
      <motion.rect
        x={100} y={28} width={60} height={54}
        rx={4}
        fill="#ef4444"
        fillOpacity={0}
        stroke="#ef4444"
        strokeWidth={2}
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: [0, 1, 0, 1] } : { opacity: 0 }}
        transition={{ delay: 1.2, duration: 0.6 }}
      />

      <motion.text
        x={130} y={120}
        textAnchor="middle"
        fill="#ef4444"
        fontSize={9}
        fontWeight={600}
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : { opacity: 0 }}
        transition={{ delay: 1.6 }}
      >
        Room 301 — double booked
      </motion.text>
    </svg>
  );
}

function DataIslandsVisual() {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref as React.RefObject<Element>, { once: true, amount: 0.5 });

  const islands = [
    { label: "Finance",   x: 35,  y: 30,  color: "#4f46e5" },
    { label: "Academics", x: 155, y: 30,  color: "#7c3aed" },
    { label: "Admissions",x: 35,  y: 100, color: "#0ea5e9" },
    { label: "Operations",x: 155, y: 100, color: "#10b981" },
  ];

  return (
    <svg ref={ref} viewBox="0 0 260 170" className="w-full max-w-xs" aria-hidden>
      {islands.map((is, i) => (
        <motion.g
          key={is.label}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
          transition={{ delay: i * 0.15, type: "spring", stiffness: 200 }}
          style={{ transformOrigin: `${is.x + 45}px ${is.y + 25}px` }}
        >
          <rect x={is.x} y={is.y} width={70} height={40} rx={6}
            fill={is.color} fillOpacity={0.12} stroke={is.color} strokeOpacity={0.3} strokeWidth={1} />
          <text x={is.x + 35} y={is.y + 25} textAnchor="middle" fill={is.color} fontSize={9} fontWeight={600}>
            {is.label}
          </text>
        </motion.g>
      ))}
      <motion.text
        x={130} y={158}
        textAnchor="middle"
        fill="#64748b"
        fontSize={9}
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : { opacity: 0 }}
        transition={{ delay: 0.8 }}
      >
        No one has the full picture
      </motion.text>
    </svg>
  );
}

/* ── exported section ────────────────────────────────────── */
export function Problem() {
  return (
    <section className="section-dark bg-mesh-dark py-20 md:py-32">
      <div className="container-tight">
        <div className="text-center mb-16">
          <p className="eyebrow text-indigo-400">The Problem</p>
          <h2
            className="font-display font-bold text-white tracking-tight"
            style={{ fontSize: "clamp(2rem, 4vw, 3.2rem)" }}
          >
            Data everywhere.
            <br />
            Insight nowhere.
          </h2>
        </div>

        <div className="divide-y divide-white/8">
          {problems.map((p, i) => (
            <ProblemCard key={i} problem={p} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
