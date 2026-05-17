"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Briefcase } from "lucide-react";
import { NucleusName } from "@/components/nucleus-wordmark";

const leads = {
  awareness:   ["Deloitte",      "McKinsey",   "BCG"],
  engagement:  ["Goldman Sachs", "JP Morgan"],
  jdExpected:  ["Google",        "Amazon",     "Meta"],
  relationship:["TCS",           "Infosys"],
};

const columns = [
  { title: "Awareness",        leads: leads.awareness,   accent: "#818cf8" },
  { title: "Engagement",       leads: leads.engagement,  accent: "#6366f1" },
  { title: "JD Expected",      leads: leads.jdExpected,  accent: "#f59e0b" },
  { title: "Relationship Mgt", leads: leads.relationship,accent: "#10b981" },
];

export function PlacementsHero() {
  return (
    <section className="section-dark min-h-[100svh] flex items-center pt-16 isolate overflow-hidden">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="absolute -top-40 left-1/4 w-[700px] h-[500px] rounded-full bg-indigo-500/10 blur-[120px]" />
        <div className="absolute -bottom-40 right-1/4 w-[600px] h-[400px] rounded-full bg-violet-500/10 blur-[120px]" />
      </div>

      <div className="relative z-10 container-wide py-16 lg:py-24 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        {/* Left: copy */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-indigo-400/30 bg-indigo-400/8 text-xs font-medium text-indigo-300 mb-5">
            <Briefcase className="w-3.5 h-3.5" />
            <NucleusName className="!text-indigo-300" /> for Placements
          </span>

          <h1
            className="font-display font-bold text-white tracking-tighter leading-[1.05] mb-6"
            style={{ fontSize: "clamp(2.5rem, 5vw, 4.2rem)" }}
          >
            Recruiter relationships shouldn&apos;t live in
            <br />
            <span className="text-indigo-400">one person&apos;s inbox.</span>
          </h1>

          <p className="text-lg text-slate-300 leading-relaxed max-w-xl mb-8">
            One workspace for your entire placement team — shared mail,
            AI-powered contact extraction, recruiter CRM, outbound calls,
            calendar, and multi-channel broadcasting.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <Link
              href="#cta"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-primary px-7 text-sm font-semibold text-primary-foreground shadow-[0_2px_24px_-4px_rgba(79,70,229,0.5)] hover:opacity-90 transition-opacity"
            >
              Book a Demo
            </Link>
            <Link
              href="#features"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/15 px-7 text-sm font-semibold text-white hover:bg-white/5 transition-colors"
            >
              See Features
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <p className="text-xs text-slate-500">
            Currently deployed at <span className="text-slate-300 font-medium">XLRI Jamshedpur &amp; Delhi</span> campuses
          </p>
        </motion.div>

        {/* Right: Kanban mock */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="relative"
        >
          <div className="rounded-2xl bg-[#1a1a2e] border border-white/8 shadow-[0_20px_80px_-20px_rgba(79,70,229,0.4)] overflow-hidden">
            {/* Window chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/6 bg-white/3">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
              </div>
              <div className="flex-1 mx-3 h-6 rounded-md bg-white/5 flex items-center px-3">
                <span className="text-[10px] text-slate-400 font-mono">
                  thenucleus.in/placements/crm
                </span>
              </div>
            </div>

            {/* Kanban columns */}
            <div className="grid grid-cols-4 gap-2 p-3">
              {columns.map((col, ci) => (
                <motion.div
                  key={col.title}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + ci * 0.1, duration: 0.4 }}
                  className="space-y-2"
                >
                  <div className="flex items-center justify-between px-1">
                    <span
                      className="text-[10px] font-bold uppercase tracking-wide"
                      style={{ color: col.accent }}
                    >
                      {col.title}
                    </span>
                    <span className="text-[9px] text-slate-500">{col.leads.length}</span>
                  </div>
                  {col.leads.map((lead, li) => (
                    <motion.div
                      key={lead}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.8 + ci * 0.1 + li * 0.05, duration: 0.3 }}
                      className="rounded-lg bg-white/4 border border-white/6 p-2.5 hover:bg-white/6 transition-colors"
                    >
                      <p className="text-[11px] font-semibold text-white truncate">{lead}</p>
                      <p className="text-[9px] text-slate-500 mt-0.5">
                        {Math.floor(Math.random() * 9) + 2}d in stage
                      </p>
                    </motion.div>
                  ))}
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
