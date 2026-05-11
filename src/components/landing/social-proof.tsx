"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Quote, GraduationCap } from "lucide-react";

const stats = [
  { value: "4 weeks", label: "Average time to first insight" },
  { value: "40%", label: "Reduction in manual coordination" },
  { value: "3 wks", label: "Earlier student risk detection" },
];

export function SocialProof() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <section id="social-proof" className="section-lg bg-background">
      <div className="container-tight">
        {/* Institutions */}
        <motion.div
          ref={ref}
          className="text-center mb-16"
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: 0.6 }}
        >
          <p className="eyebrow">Traction</p>
          <h2
            className="font-display font-bold text-foreground tracking-tight mb-5"
            style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
          >
            Powering campus intelligence
            <br />
            at institutions that trust data.
          </h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {["XLRI Jamshedpur", "XLRI Delhi-NCR"].map((inst) => (
              <div
                key={inst}
                className="inline-flex items-center gap-3 px-5 py-3 rounded-xl border border-border bg-card"
              >
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <GraduationCap className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm font-semibold text-foreground">{inst}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-px bg-border border border-border rounded-2xl overflow-hidden mb-14">
          {stats.map((s, i) => (
            <motion.div
              key={i}
              className="bg-card px-6 py-8 text-center"
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
              transition={{ delay: 0.2 + i * 0.1 }}
            >
              <p
                className="font-display font-bold text-primary mb-1"
                style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)" }}
              >
                {s.value}
              </p>
              <p className="text-xs text-muted-foreground leading-snug">{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Quote */}
        <motion.div
          className="relative max-w-2xl mx-auto p-8 rounded-2xl border border-border bg-card"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ delay: 0.5, duration: 0.6 }}
        >
          <Quote className="w-8 h-8 text-primary/20 mb-4" />
          <p className="text-foreground text-lg leading-relaxed font-medium mb-6">
            &ldquo;We reduced manual coordination by 40% in the first semester.
            The operations team now spends time on decisions — not on chasing data
            from twelve different departments.&rdquo;
          </p>
          <div className="border-t border-border pt-5">
            <p className="text-sm font-semibold text-foreground">Operations Head</p>
            <p className="text-xs text-muted-foreground">XLRI Jamshedpur</p>
          </div>
        </motion.div>

        {/* Credibility line */}
        <motion.p
          className="text-center text-sm text-muted-foreground mt-8"
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 0.8 }}
        >
          Built by alumni of{" "}
          <span className="font-medium text-foreground">BITS Pilani</span> and{" "}
          <span className="font-medium text-foreground">XLRI Jamshedpur</span>
        </motion.p>
      </div>
    </section>
  );
}
