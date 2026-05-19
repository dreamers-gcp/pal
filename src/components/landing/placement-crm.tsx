"use client";

import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  Mail,
  Sparkles,
  Kanban,
  Phone,
  CalendarDays,
  Megaphone,
  ArrowRight,
  Briefcase,
} from "lucide-react";
import { NucleusName } from "@/components/nucleus-wordmark";

const features = [
  {
    icon: Mail,
    title: "Shared inbox",
    desc: "One Gmail inbox for the entire placement team. No more forwarded chains or lost threads.",
  },
  {
    icon: Sparkles,
    title: "AI contact extraction",
    desc: "Recruiter contacts, company details, and JD info pulled from every email — automatically.",
  },
  {
    icon: Kanban,
    title: "Recruiter CRM",
    desc: "4-stage Kanban pipeline. Track every corporate lead from first touch to offer letter.",
  },
  {
    icon: Phone,
    title: "Calls & transcripts",
    desc: "Outbound calls with automatic recordings, transcripts, and AI-generated summaries.",
  },
  {
    icon: CalendarDays,
    title: "Calendar sync",
    desc: "Google Calendar integration. Schedule recruiter meetings with Meet links in one click.",
  },
  {
    icon: Megaphone,
    title: "Broadcasting",
    desc: "SMS, WhatsApp, and email campaigns to recruiters and students — segmented and tracked.",
  },
];

const pipelineStages = [
  { label: "Awareness",    count: 12, color: "#6366f1" },
  { label: "Engagement",   count: 8,  color: "#4f46e5" },
  { label: "JD expected",  count: 5,  color: "#f59e0b" },
  { label: "Relationship", count: 14, color: "#10b981" },
];

export function PlacementCRM() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.1 });

  return (
    <section id="placements" className="section-lg bg-background" ref={ref}>
      <div className="container-wide">
        {/* Header */}
        <motion.div
          className="text-center mb-12 max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          <span className="pill mb-4">
            <Briefcase className="w-3.5 h-3.5" />
            <NucleusName /> for Placements
          </span>
          <h2
            className="font-display font-bold text-foreground tracking-tight mb-4 mt-4"
            style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
          >
            Your placement office runs on
            <br />
            <span className="text-primary">forwarded emails and spreadsheets.</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            <NucleusName /> for Placements gives your team a shared workspace —
            recruiter mail, AI extraction, CRM pipeline, calls, calendar, and broadcasts. All in one place.
          </p>
        </motion.div>

        {/* 6 features in a 3-column grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                className="rounded-2xl border border-border bg-card p-6 hover:border-primary/30 hover:shadow-[0_4px_24px_-8px_rgba(79,70,229,0.15)] transition-all duration-300"
                initial={{ opacity: 0, y: 16 }}
                animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
                transition={{ delay: 0.2 + i * 0.06, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            );
          })}
        </div>

        {/* Bottom row: pipeline preview + traction card */}
        <div className="grid lg:grid-cols-2 gap-5 items-stretch">
          {/* Pipeline preview */}
          <motion.div
            className="rounded-2xl border border-border bg-card p-6"
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
            transition={{ delay: 0.6, duration: 0.6 }}
          >
            <div className="flex items-center justify-between mb-5">
              <p className="text-xs font-bold text-foreground uppercase tracking-wide">
                Live Recruiter Pipeline
              </p>
              <span className="text-[10px] text-muted-foreground">39 active leads</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {pipelineStages.map((stage, i) => (
                <motion.div
                  key={stage.label}
                  className="flex flex-col items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10"
                  initial={{ opacity: 0, y: 10 }}
                  animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                  transition={{ delay: 0.75 + i * 0.08, duration: 0.4 }}
                >
                  <span className="text-xl font-bold" style={{ color: stage.color }}>
                    {stage.count}
                  </span>
                  <span className="text-[10px] text-muted-foreground text-center leading-tight">
                    {stage.label}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Dark traction card */}
          <motion.div
            className="rounded-2xl section-dark p-6 flex flex-col justify-between"
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
            transition={{ delay: 0.7, duration: 0.6 }}
          >
            <div>
              <p className="text-xs font-bold text-indigo-400 uppercase tracking-wide mb-2">
                Live deployment
              </p>
              <p className="text-white font-semibold text-lg mb-2">
                Live at XLRI Jamshedpur &amp; Delhi
              </p>
              <p className="text-sm text-slate-400 leading-relaxed">
                Placement committees are using it right now to track recruiter relationships across batches.
              </p>
            </div>
            <Link
              href="/placements"
              className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-400 hover:text-indigo-300 hover:gap-3 transition-all mt-4"
            >
              Explore <NucleusName className="!text-indigo-400" /> for Placements
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
