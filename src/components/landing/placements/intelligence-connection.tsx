"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { ArrowRight, Briefcase, Sparkles, LayoutDashboard, TrendingUp, Users, BarChart3 } from "lucide-react";
import { NucleusName } from "@/components/nucleus-wordmark";

const metrics = [
  {
    icon: TrendingUp,
    title: "Placement rate",
    desc: "Per program, per batch, per year",
  },
  {
    icon: Users,
    title: "Recruiter engagement",
    desc: "Response rates, stall alerts, velocity",
  },
  {
    icon: BarChart3,
    title: "Offer analytics",
    desc: "Offer-to-join ratio, CTC trends, sector mix",
  },
];

export function PlacementsIntelligence() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <section className="section-dark py-20 md:py-28 isolate overflow-hidden" ref={ref}>
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] rounded-full bg-indigo-500/10 blur-[120px]" />
      </div>

      <div className="container-wide relative">
        <motion.div
          className="text-center mb-14 max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-indigo-400 mb-4">
            Intelligence layer
          </p>
          <h2
            className="font-display font-bold text-white tracking-tight mb-4"
            style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
          >
            Placement data feeds back into
            <br />
            the <NucleusName className="!text-white" /> intelligence layer.
          </h2>
          <p className="text-slate-400 text-lg">
            Every recruiter interaction, call, and pipeline movement becomes data
            that surfaces in dashboards for the Placement Head and Director —
            alongside attendance, fee collection, and student analytics.
          </p>
        </motion.div>

        {/* Flow diagram */}
        <motion.div
          className="flex flex-col md:flex-row items-stretch justify-center gap-3 md:gap-2 mb-12 max-w-4xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          {/* Box 1: Placement CRM */}
          <div className="flex-1 rounded-2xl bg-primary p-5 text-center">
            <div className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center mx-auto mb-3">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <p className="text-sm font-bold text-white mb-1">Placement CRM</p>
            <p className="text-xs text-white/70">Leads · Calls · JDs</p>
          </div>

          {/* Arrow */}
          <div className="flex items-center justify-center md:rotate-0 rotate-90">
            <ArrowRight className="w-6 h-6 text-indigo-400" />
          </div>

          {/* Box 2: The Nucleus */}
          <div className="flex-1 rounded-2xl bg-[#6366f1] p-5 text-center">
            <div className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <p className="text-sm font-bold text-white mb-1">
              <NucleusName className="!text-white" />
            </p>
            <p className="text-xs text-white/70">Intelligence layer</p>
          </div>

          {/* Arrow */}
          <div className="flex items-center justify-center md:rotate-0 rotate-90">
            <ArrowRight className="w-6 h-6 text-indigo-400" />
          </div>

          {/* Box 3: Director's dashboard */}
          <div className="flex-1 rounded-2xl bg-[#0ea5e9] p-5 text-center">
            <div className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center mx-auto mb-3">
              <LayoutDashboard className="w-5 h-5 text-white" />
            </div>
            <p className="text-sm font-bold text-white mb-1">Director&apos;s dashboard</p>
            <p className="text-xs text-white/70">Placement Head view</p>
          </div>
        </motion.div>

        {/* Metric cards */}
        <div className="grid md:grid-cols-3 gap-4">
          {metrics.map((m, i) => {
            const Icon = m.icon;
            return (
              <motion.div
                key={m.title}
                className="bg-white/5 border border-white/8 rounded-xl p-5"
                initial={{ opacity: 0, y: 16 }}
                animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
                transition={{ delay: 0.4 + i * 0.1, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="h-10 w-10 rounded-lg bg-indigo-400/10 border border-indigo-400/20 flex items-center justify-center mb-3">
                  <Icon className="w-5 h-5 text-indigo-400" />
                </div>
                <p className="text-sm font-bold text-white mb-1">{m.title}</p>
                <p className="text-xs text-slate-400 leading-relaxed">{m.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
