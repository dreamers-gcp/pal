"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { School, BookOpen, Settings2, GraduationCap, Building2 } from "lucide-react";

const cards = [
  {
    icon: School,
    badge: "K–12 Schools",
    problem: "Attendance is a register. Risk is invisible.",
    solution: "Section-level risk dashboards, parent alerts in minutes, early learning-gap detection.",
  },
  {
    icon: BookOpen,
    badge: "Junior Colleges",
    problem: "Regulatory reports take days. Fee tracking is manual.",
    solution: "Auto-generated compliance reports, per-program fee dashboards, board-readiness scores.",
  },
  {
    icon: Settings2,
    badge: "Engineering Institutes",
    problem: "Labs double-booked. Placement data scattered.",
    solution: "Conflict-free lab scheduling, placement readiness scores, cross-department dean view.",
  },
  {
    icon: GraduationCap,
    badge: "Universities",
    problem: "Multi-campus. Zero unified picture.",
    solution: "Portfolio dashboards across campuses, program-level financials, student lifecycle tracking.",
  },
  {
    icon: Building2,
    badge: "Education Groups",
    problem: "Group leadership flying blind across institutions.",
    solution: "Standardised metrics across 5–50 institutions, anomaly detection, centralised intelligence.",
  },
];

export function Audience() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });

  return (
    <section id="audience" className="section-lg bg-background">
      <div className="container-tight">
        <motion.div
          ref={ref}
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          <p className="eyebrow">Who It&apos;s For</p>
          <h2
            className="font-display font-bold text-foreground tracking-tight mb-4"
            style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
          >
            Every institution has blind spots.
            <br />
            The Nucleus clears them.
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            The same intelligence layer adapts to the complexity and scale of any educational institution.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {cards.map((card, i) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.badge}
                className="flex flex-col gap-4 p-6 rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-[0_6px_32px_-8px_rgba(79,70,229,0.1)] transition-all duration-300"
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                transition={{ delay: 0.15 + i * 0.09, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              >
                {/* Icon + badge */}
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-xs font-bold text-primary uppercase tracking-wide">
                    {card.badge}
                  </span>
                </div>

                {/* Problem */}
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                    The problem
                  </p>
                  <p className="text-sm text-foreground font-medium leading-snug">{card.problem}</p>
                </div>

                {/* Divider */}
                <div className="h-px bg-border" />

                {/* Solution */}
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/70">
                    With Nucleus
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{card.solution}</p>
                </div>
              </motion.div>
            );
          })}

          {/* "Works for everyone" closing card */}
          <motion.div
            className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border border-dashed border-primary/30 bg-primary/3 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ delay: 0.15 + cards.length * 0.09, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="text-sm font-semibold text-foreground">Don&apos;t see your institution type?</p>
            <p className="text-xs text-muted-foreground">
              The Nucleus is configurable to any accreditation, size, or structure. Let&apos;s talk.
            </p>
            <a
              href="#contact"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Book a Discovery Call
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
