"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Check, Sparkles, Landmark } from "lucide-react";
import { NucleusName } from "@/components/nucleus-wordmark";

const erpDoes = [
  "Records fee payments",
  "Stores exam scores",
  "Manages enrollment",
  "Tracks course completion",
  "Generates compliance reports",
  "Maintains student master data",
];

const nucleusAdds = [
  "Projects upcoming cashflow gaps",
  "Flags students trending toward failure",
  "Identifies enrollment conversion drops",
  "Surfaces early dropout signals",
  "Delivers real-time operational dashboards",
  "Connects signals across all departments",
];

export function ErpComplement() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <section id="how-it-works" className="section-lg bg-background">
      <div className="container-tight">
        <motion.div
          className="text-center mb-14"
          ref={ref}
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: 0.6 }}
        >
          <p className="eyebrow">No rip-and-replace</p>
          <h2
            className="font-display font-bold text-foreground tracking-tight mb-4"
            style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
          >
            We don&apos;t replace your ERP.
            <br />
            We make it useful.
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Your ERP is your system of record. <NucleusName /> reads from it — it doesn&apos;t write to it.
            Your data stays where it is. You just finally get to see what&apos;s inside it.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-5">
          {/* ERP column */}
          <motion.div
            className="rounded-2xl border border-border bg-card p-7"
            initial={{ opacity: 0, x: -20 }}
            animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
            transition={{ delay: 0.15, duration: 0.6 }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                <Landmark className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your ERP does this well</p>
                <p className="text-sm font-semibold text-foreground">Record. Store. Comply.</p>
              </div>
            </div>
            <ul className="space-y-2.5">
              {erpDoes.map((item, i) => (
                <motion.li
                  key={item}
                  className="flex items-center gap-3 text-sm text-muted-foreground"
                  initial={{ opacity: 0, x: -10 }}
                  animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }}
                  transition={{ delay: 0.3 + i * 0.07 }}
                >
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  {item}
                </motion.li>
              ))}
            </ul>
          </motion.div>

          {/* Nucleus column */}
          <motion.div
            className="rounded-2xl border border-primary/30 bg-accent/30 p-7 relative overflow-hidden"
            initial={{ opacity: 0, x: 20 }}
            animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
            transition={{ delay: 0.25, duration: 0.6 }}
          >
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-primary/5 blur-2xl" />
            </div>
            <div className="relative flex items-center gap-3 mb-6">
              <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-xs font-semibold text-primary uppercase tracking-wide"><NucleusName /> adds this</p>
                <p className="text-sm font-semibold text-foreground">Insight. Prediction. Action.</p>
              </div>
            </div>
            <ul className="space-y-2.5 relative">
              {nucleusAdds.map((item, i) => (
                <motion.li
                  key={item}
                  className="flex items-center gap-3 text-sm text-foreground"
                  initial={{ opacity: 0, x: 10 }}
                  animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: 10 }}
                  transition={{ delay: 0.4 + i * 0.07 }}
                >
                  <span className="h-4 w-4 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  </span>
                  {item}
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </div>

        {/* Bottom statement */}
        <motion.div
          className="mt-10 text-center p-6 rounded-2xl border border-border bg-card"
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          transition={{ delay: 0.7, duration: 0.5 }}
        >
          <p className="text-sm text-muted-foreground">
            Works alongside your existing ERP, fee management system, timetable software, or spreadsheets. No lock-in.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
