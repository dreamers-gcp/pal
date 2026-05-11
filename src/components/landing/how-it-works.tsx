"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const steps = [
  {
    days: "Day 1–7",
    phase: "Connect",
    headline: "We integrate with your existing systems.",
    body: "Secure APIs and data imports connect to your ERP, fee software, and attendance systems. No downtime. No disruption. Your systems stay exactly as they are.",
    details: ["API-based ERP integration", "Historical data import", "Role and access mapping", "Data validation and audit"],
  },
  {
    days: "Week 2–3",
    phase: "Configure",
    headline: "We map your institution's structure.",
    body: "Programs, departments, sections, roles. Dashboards configured to show exactly what each stakeholder needs — the principal sees one view, the finance head sees another.",
    details: ["Institutional hierarchy setup", "Stakeholder dashboard config", "Alert threshold calibration", "Pilot department selection"],
  },
  {
    days: "Week 4",
    phase: "Go Live",
    headline: "Insights start flowing.",
    body: "Student risk alerts activate. Financial dashboards go live. Your team sees the full picture for the first time — across every department, in real time.",
    details: ["Risk scoring activated", "Alert routing live", "Financial dashboards live", "Team training complete"],
  },
];

export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });

  return (
    <section className="section-dark py-24 md:py-36 bg-mesh-dark">
      <div className="container-tight">
        <motion.div
          className="text-center mb-16"
          ref={ref}
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: 0.6 }}
        >
          <p className="eyebrow text-indigo-400">Implementation</p>
          <h2
            className="font-display font-bold text-white tracking-tight mb-4"
            style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
          >
            Up and running in 4 weeks.
            <br />
            No consultants. No project plan.
          </h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Technical credibility without jargon. Your IT team can handle the ERP connection in a day.
          </p>
        </motion.div>

        {/* Timeline */}
        <div className="relative">
          {/* vertical connecting line */}
          <motion.div
            className="absolute left-8 md:left-1/2 top-0 bottom-0 w-px bg-white/10"
            initial={{ scaleY: 0 }}
            animate={inView ? { scaleY: 1 } : { scaleY: 0 }}
            transition={{ delay: 0.3, duration: 1.2, ease: "easeInOut" }}
            style={{ transformOrigin: "top" }}
          />

          <div className="space-y-12">
            {steps.map((step, i) => (
              <motion.div
                key={step.phase}
                className="relative grid md:grid-cols-2 gap-8 md:gap-16 items-start"
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                transition={{ delay: 0.3 + i * 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              >
                {/* step number dot */}
                <div className="absolute left-8 md:left-1/2 -translate-x-1/2 h-5 w-5 rounded-full border-2 border-indigo-500 bg-[#0D1021] z-10" />

                {/* left: timing + headline */}
                <div className={`pl-16 md:pl-0 ${i % 2 === 0 ? "md:text-right" : "md:order-2"}`}>
                  <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-1">{step.days}</p>
                  <p className="text-sm font-bold text-white uppercase tracking-wide mb-2">{step.phase}</p>
                  <h3 className="font-display font-bold text-white text-lg mb-2">{step.headline}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{step.body}</p>
                </div>

                {/* right: details */}
                <div className={`pl-16 md:pl-0 ${i % 2 === 0 ? "" : "md:order-1 md:text-right"}`}>
                  <ul className="space-y-2">
                    {step.details.map((d) => (
                      <li key={d} className={`flex items-center gap-2 text-sm text-slate-400 ${i % 2 !== 0 ? "md:flex-row-reverse" : ""}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
