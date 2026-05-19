"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { MailX, Sheet, PhoneOff, CalendarX } from "lucide-react";

const problems = [
  {
    icon: MailX,
    title: "Scattered email chains",
    desc: "Recruiter conversations live in personal inboxes. When a committee member graduates, the relationship history goes with them.",
  },
  {
    icon: Sheet,
    title: "Spreadsheet CRM",
    desc: "Lead tracking in Google Sheets with no pipeline visibility. No one knows which recruiter was contacted, by whom, or when.",
  },
  {
    icon: PhoneOff,
    title: "No call records",
    desc: "Calls happen on personal phones. No recordings, no transcripts, no institutional memory of what was discussed.",
  },
  {
    icon: CalendarX,
    title: "Manual scheduling",
    desc: "Recruiter meetings are coordinated over email, with no shared calendar and no notes from past meetings.",
  },
];

export function PlacementsProblem() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <section className="section-lg bg-background" ref={ref}>
      <div className="container-wide">
        <motion.div
          className="text-center mb-12 max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-red-500 mb-4">
            The problem
          </p>
          <h2
            className="font-display font-bold text-foreground tracking-tight mb-4"
            style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
          >
            Placement teams rebuild from zero.
            <br />
            Every year.
          </h2>
          <p className="text-muted-foreground text-lg">
            Committees rotate. Recruiter contacts, call history, meeting notes,
            and pipeline data disappear. The next batch starts cold.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {problems.map((p, i) => {
            const Icon = p.icon;
            return (
              <motion.div
                key={p.title}
                className="rounded-xl border border-border bg-card p-5 hover:border-red-200 transition-colors"
                initial={{ opacity: 0, y: 16 }}
                animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
                transition={{ delay: 0.15 + i * 0.08, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="h-11 w-11 rounded-xl bg-red-50 dark:bg-red-950/40 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-2">{p.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
