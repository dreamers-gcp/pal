"use client";

import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { HERO } from "@/lib/landing-data";

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

export function LandingHero() {
  return (
    <section id="hero" className="relative overflow-hidden bg-background bg-mesh">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] rounded-full bg-primary/6 blur-[120px]" />
        <div className="absolute top-1/2 -right-40 w-72 h-72 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <motion.div
        className="relative z-10 container-tight pt-24 pb-20 text-center"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={itemVariants} className="mb-8 flex justify-center">
          <span className="pill">{HERO.tagline}</span>
        </motion.div>

        <motion.h1
          variants={itemVariants}
          className="font-display font-bold text-foreground tracking-tight mb-6"
          style={{ fontSize: "clamp(2.8rem, 5.5vw, 5rem)", lineHeight: 1.06 }}
        >
          Your ERP holds the data.
          <br />
          <span className="text-primary">We make it work.</span>
        </motion.h1>

        <motion.p
          variants={itemVariants}
          className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          {HERO.subheadline}
        </motion.p>

        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-20"
        >
          <Link
            href={HERO.primaryCTA.href}
            className="inline-flex h-12 items-center justify-center rounded-xl bg-primary px-8 text-sm font-semibold text-primary-foreground shadow-[0_2px_20px_-4px_rgba(1,110,117,0.45)] hover:opacity-90 transition-opacity"
          >
            {HERO.primaryCTA.label}
          </Link>
          <Link
            href={HERO.secondaryCTA.href}
            className="inline-flex h-12 items-center justify-center rounded-xl border border-border px-8 text-sm font-semibold text-foreground hover:bg-accent transition-colors"
          >
            {HERO.secondaryCTA.label} ↓
          </Link>
        </motion.div>

        {/* Product diagram */}
        <motion.div variants={itemVariants} className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-border bg-card/80 backdrop-blur shadow-[0_8px_48px_-12px_rgba(26,25,22,0.1)] p-8">
            <div className="flex items-center justify-between gap-2 sm:gap-4">
              <div className="flex-1 rounded-xl border border-border bg-background p-4 text-center">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Source</p>
                <p className="font-semibold text-foreground text-sm">ERP / SIS</p>
                <p className="text-[11px] text-muted-foreground mt-1 hidden sm:block">Records · Enrollment · Fees</p>
              </div>

              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <svg width="40" height="16" viewBox="0 0 40 16" fill="none" className="text-primary">
                  <path d="M2 8h32M26 2l8 6-8 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              <div className="flex-1 rounded-xl border border-primary/50 bg-primary px-4 py-4 text-center shadow-[0_0_32px_-8px_rgba(1,110,117,0.5)]">
                <p className="text-[10px] font-semibold text-primary-foreground/70 uppercase tracking-widest mb-1">Operating Layer</p>
                <p className="font-bold text-primary-foreground text-sm">The Nucleus</p>
                <p className="text-[11px] text-primary-foreground/70 mt-1 hidden sm:block">Workflows · Signals · Action</p>
              </div>

              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <svg width="40" height="16" viewBox="0 0 40 16" fill="none" className="text-primary">
                  <path d="M2 8h32M26 2l8 6-8 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              <div className="flex-1 rounded-xl border border-border bg-background p-4 text-center">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Outputs</p>
                <p className="font-semibold text-foreground text-sm">Action</p>
                <p className="text-[11px] text-muted-foreground mt-1 hidden sm:block">Alerts · Approvals · Insights</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {["Attendance", "Scheduling", "Fee Notices", "Onboarding", "Early Warnings", "Messaging"].map((tag) => (
                <span
                  key={tag}
                  className="inline-block px-3 py-1 rounded-full bg-accent border border-border text-xs text-muted-foreground font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
