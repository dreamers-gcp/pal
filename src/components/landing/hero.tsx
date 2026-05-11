"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, type Variants } from "framer-motion";
import { GraduationCap } from "lucide-react";
import { NucleusName } from "@/components/nucleus-wordmark";

/* ── constellation coordinates ──────────────────────────── */
const CX = 265;
const CY = 215;
const R  = 158;

const nodes = [
  { id: "attendance", label: "Attendance", angle: -90 },
  { id: "fees",       label: "Fee Ledger", angle: -30 },
  { id: "exams",      label: "Exams",      angle:  30 },
  { id: "timetable",  label: "Timetable",  angle:  90 },
  { id: "admissions", label: "Admissions", angle: 150 },
  { id: "erp",        label: "ERP / SIS",  angle: 210 },
].map((n) => ({
  ...n,
  x: Math.round(CX + R * Math.cos((n.angle * Math.PI) / 180)),
  y: Math.round(CY + R * Math.sin((n.angle * Math.PI) / 180)),
}));

const insightCards = [
  { label: "14 students at risk",    color: "amber", top: "10%", left: "0%" },
  { label: "₹23L overdue > 60 days", color: "red",   bottom: "8%", left: "2%" },
  { label: "3 scheduling conflicts", color: "blue",  top: "18%", right: "0%" },
];

const colorMap: Record<string, string> = {
  amber: "bg-amber-50 border-amber-200 text-amber-700",
  red:   "bg-red-50 border-red-200 text-red-700",
  blue:  "bg-blue-50 border-blue-200 text-blue-700",
};

/* ── text animation variants ────────────────────────────── */
const textContainer: Variants = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.12, delayChildren: 0.08 } },
};
const textItem: Variants = {
  hidden: { opacity: 0, y: 18 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

/* ── 4-phase constellation visualization ────────────────── */
function Constellation() {
  return (
    <div className="relative w-full aspect-[5/4] max-w-[600px] ml-auto">
      <svg viewBox="0 0 520 430" className="w-full h-full" aria-hidden>
        <defs>
          <filter id="hub-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="10" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* ── PHASE 3: lines draw AFTER nodes appear ───── */}
        {nodes.map((node, i) => (
          <motion.path
            key={`line-${node.id}`}
            d={`M ${CX} ${CY} L ${node.x} ${node.y}`}
            stroke="#4f46e5"
            strokeWidth={2}
            strokeOpacity={0.3}
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 1.25 + i * 0.06, duration: 0.65, ease: "easeOut" }}
          />
        ))}

        {/* flowing dots (continuous, start after lines) */}
        {nodes.map((node, i) => (
          <motion.circle
            key={`dot-${node.id}`}
            r={2.5}
            fill="#4f46e5"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.7, 0] }}
            transition={{
              delay: 2.1 + i * 0.25,
              duration: 1.2,
              repeat: Infinity,
              repeatDelay: 3,
              ease: "easeInOut",
            }}
            style={{
              offsetPath: `path("M ${CX} ${CY} L ${node.x} ${node.y}")`,
              offsetDistance: "0%",
            } as React.CSSProperties}
          />
        ))}

        {/* ── PHASE 1: hub ─────────────────────────────── */}
        {/* outer pulse rings */}
        <motion.circle
          cx={CX} cy={CY} r={80}
          fill="none" stroke="#4f46e5" strokeWidth={1} strokeOpacity={0.10}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.12, 0.03, 0.12] }}
          transition={{ delay: 0.5, duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: `${CX}px ${CY}px` }}
        />
        <motion.circle
          cx={CX} cy={CY} r={62}
          fill="none" stroke="#4f46e5" strokeWidth={1.5} strokeOpacity={0.18}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [1, 1.18, 1], opacity: [0.25, 0.07, 0.25] }}
          transition={{ delay: 0.35, duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: `${CX}px ${CY}px` }}
        />
        {/* hub glow backdrop */}
        <motion.circle
          cx={CX} cy={CY} r={52}
          fill="#4f46e5"
          fillOpacity={0.15}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0, duration: 0.5 }}
          style={{ transformOrigin: `${CX}px ${CY}px`, filter: "blur(14px)" }}
        />
        {/* hub circle */}
        <motion.circle
          cx={CX} cy={CY} r={46}
          fill="#4f46e5"
          filter="url(#hub-glow)"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0, duration: 0.5, type: "spring", stiffness: 180 }}
          style={{ transformOrigin: `${CX}px ${CY}px` }}
        />
        <motion.text
          x={CX} y={CY - 5}
          textAnchor="middle" fill="white" fontSize={9} fontWeight={700} letterSpacing={1.6}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.3 }}
        >
          THE
        </motion.text>
        <motion.text
          x={CX} y={CY + 10}
          textAnchor="middle" fill="white" fontSize={9} fontWeight={700} letterSpacing={1.6}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.3 }}
        >
          NUCLEUS
        </motion.text>

        {/* ── PHASE 2: nodes appear staggered ─────────── */}
        {nodes.map((node, i) => (
          <motion.g
            key={`node-${node.id}`}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.65 + i * 0.08, type: "spring", stiffness: 200, damping: 18 }}
            style={{ transformOrigin: `${node.x}px ${node.y}px` }}
          >
            <circle cx={node.x} cy={node.y} r={36} fill="white" stroke="#c7d2fe" strokeWidth={2.5} />
            <text
              x={node.x} y={node.y + 4}
              textAnchor="middle" fontSize={10} fill="#3730a3" fontWeight={700}
            >
              {node.label.length > 9 ? node.label.split("/")[0].trim() : node.label}
            </text>
          </motion.g>
        ))}
      </svg>

      {/* ── PHASE 4: insight cards ────────────────────── */}
      {insightCards.map((card, i) => (
        <motion.div
          key={card.label}
          className={`absolute flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold shadow-sm whitespace-nowrap ${colorMap[card.color]}`}
          style={{ top: card.top, bottom: card.bottom, left: card.left, right: card.right }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.85 + i * 0.15, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current flex-shrink-0" />
          {card.label}
        </motion.div>
      ))}
    </div>
  );
}

/* ── scroll indicator ────────────────────────────────────── */
function ScrollIndicator() {
  return (
    <motion.div
      className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 2.5, duration: 0.6 }}
    >
      <span className="text-[0.65rem] uppercase tracking-[0.15em] text-muted-foreground/40">
        Scroll
      </span>
      <motion.div
        className="w-px h-10 bg-gradient-to-b from-muted-foreground/25 to-transparent"
        animate={{ scaleY: [0.3, 1, 0.3] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: "top" }}
      />
    </motion.div>
  );
}

/* ── hero section ────────────────────────────────────────── */
export function Hero() {
  return (
    <section
      id="hero"
      className="relative min-h-[100svh] flex items-center bg-background overflow-hidden pt-16 isolate"
    >
      {/* ambient glow */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <div className="relative z-10 container-wide py-20 lg:py-28 grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

        {/* ── Left: text ───────────────────────────────── */}
        <motion.div variants={textContainer} initial="hidden" animate="show">
          <motion.p variants={textItem} className="eyebrow">
            Campus Intelligence Platform
          </motion.p>

          <motion.h1
            variants={textItem}
            className="font-display font-bold text-foreground tracking-tighter leading-[1.03] mb-6"
            style={{ fontSize: "clamp(2.9rem, 5.5vw, 4.8rem)", position: "relative", zIndex: 1 }}
          >
            Your institution runs on{" "}
            <span className="text-primary">12&nbsp;disconnected&nbsp;tools.</span>
            <br />
            What if they could think together?
          </motion.h1>

          <motion.p
            variants={textItem}
            className="text-lg text-foreground/75 leading-relaxed max-w-lg mb-2 font-medium"
          >
            <NucleusName /> is the intelligence layer for your institution — it connects to
            your ERP, attendance systems, and fee software to turn scattered data into decisions:{" "}
            <span className="text-foreground font-semibold">
              student risk alerts, financial health dashboards, and real-time campus intelligence.
            </span>
          </motion.p>

          <motion.p variants={textItem} className="text-sm text-muted-foreground max-w-lg mb-8">
            For schools, colleges, institutes, universities, and education groups of any size.
          </motion.p>

          <motion.div variants={textItem} className="flex flex-col sm:flex-row gap-3">
            <Link
              href="#attendance"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-primary px-7 text-sm font-semibold text-primary-foreground shadow-[0_2px_24px_-4px_rgba(79,70,229,0.45)] hover:opacity-90 transition-opacity"
            >
              See How It Works
            </Link>
            <Link
              href="#contact"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-border px-7 text-sm font-semibold text-foreground hover:bg-accent transition-colors"
            >
              Book a Demo
            </Link>
          </motion.div>

          {/* BITS / XLRI trust signal */}
          <motion.div
            variants={textItem}
            className="mt-7 pt-6 border-t border-border/50"
          >
            <p className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
              <GraduationCap size={13} className="flex-shrink-0" />
              Built by alumni of
            </p>
            <div className="flex items-center gap-6">
              <div className="flex flex-col items-center gap-2">
                <div className="h-16 w-24 flex items-center justify-center rounded-xl bg-white border border-border/60 p-2 shadow-sm">
                  <Image
                    src="/bits-pilani-logo.svg"
                    alt="BITS Pilani"
                    width={80}
                    height={56}
                    className="object-contain w-full h-full"
                  />
                </div>
                <span className="text-xs font-semibold text-foreground">BITS Pilani</span>
              </div>
              <span className="text-muted-foreground/40 text-sm font-light">&amp;</span>
              <div className="flex flex-col items-center gap-2">
                <div className="h-16 w-24 flex items-center justify-center rounded-xl bg-white border border-border/60 p-2 shadow-sm">
                  <Image
                    src="/xlri-logo.png"
                    alt="XLRI Jamshedpur"
                    width={80}
                    height={56}
                    className="object-contain w-full h-full"
                  />
                </div>
                <span className="text-xs font-semibold text-foreground">XLRI Jamshedpur</span>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* ── Right: constellation ─────────────────────── */}
        <motion.div
          className="relative mt-10 lg:mt-14 flex justify-end lg:translate-x-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Constellation />
        </motion.div>
      </div>

      <ScrollIndicator />
    </section>
  );
}
