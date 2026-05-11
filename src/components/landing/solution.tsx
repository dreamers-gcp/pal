"use client";

import { motion } from "framer-motion";
import { useRef } from "react";
import { useInView } from "framer-motion";
import { Plug, Eye, Zap } from "lucide-react";

const stages = [
  {
    step: "01",
    icon: Plug,
    headline: "Connect",
    sub: "Plug into what you already use",
    body: "The Nucleus connects to your ERP, fee system, attendance registers, and spreadsheets. No rip-and-replace. No new workflows to learn. No downtime.",
    tags: ["MasterSoft ERP", "Serosoft", "TCS iON", "Tally", "Spreadsheets", "Custom APIs"],
  },
  {
    step: "02",
    icon: Eye,
    headline: "See",
    sub: "See what you've been missing",
    body: "Student risk scores. Financial health dashboards. Scheduling conflicts. Real-time visibility across every department — in one place, finally.",
    tags: ["Student risk scores", "Cashflow trends", "Conflict alerts", "Attendance heatmaps"],
  },
  {
    step: "03",
    icon: Zap,
    headline: "Act",
    sub: "Intervene before it's too late",
    body: "Automated alerts route to the right person at the right time. A student at risk reaches their counselor. An overdue fee triggers an escalation. A scheduling conflict is resolved before anyone shows up.",
    tags: ["Counselor alerts", "Fee escalations", "Auto-routing", "Audit trail"],
  },
];

export function Solution() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.1 });

  return (
    <section id="how-it-works" className="section-lg bg-card">
      <div className="container-tight">
        <div className="text-center mb-16">
          <p className="eyebrow">The Solution</p>
          <h2
            className="font-display font-bold text-foreground tracking-tight mb-4"
            style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
          >
            Connect. See. Act.
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Three stages. One intelligence layer. The Nucleus turns your institution&apos;s scattered data into a system that thinks for you.
          </p>
        </div>

        <div ref={ref} className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {stages.map((stage, i) => {
            const Icon = stage.icon;
            return (
              <motion.div
                key={stage.step}
                className="relative flex flex-col gap-5 p-7 rounded-2xl border border-border bg-background hover:border-primary/30 hover:shadow-[0_8px_40px_-12px_rgba(79,70,229,0.12)] transition-all duration-300"
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                transition={{ delay: i * 0.14, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 border border-primary/15">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <span className="font-display font-bold text-4xl text-border select-none">
                    {stage.step}
                  </span>
                </div>

                <div>
                  <h3 className="font-display font-bold text-foreground text-xl mb-1">
                    {stage.headline}
                  </h3>
                  <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-3">
                    {stage.sub}
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{stage.body}</p>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-auto">
                  {stage.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-block px-2.5 py-1 rounded-full bg-accent border border-border text-[10px] text-muted-foreground font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
