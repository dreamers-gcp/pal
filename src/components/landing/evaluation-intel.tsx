"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { ScanLine, Pencil, BarChart3, CheckCircle2, Zap, Shield, Users } from "lucide-react";

const pipelineSteps = [
  {
    icon: ScanLine,
    label: "Scan",
    desc: "Answer sheets scanned or photographed",
    color: "#4f46e5",
  },
  {
    icon: Pencil,
    label: "Transcribe",
    desc: "Handwriting recognised, responses structured",
    color: "#7c3aed",
  },
  {
    icon: BarChart3,
    label: "Evaluate",
    desc: "AI matches against rubric, assigns scores",
    color: "#0ea5e9",
  },
  {
    icon: CheckCircle2,
    label: "Review",
    desc: "Faculty validates edge cases in seconds",
    color: "#10b981",
  },
];

const features = [
  {
    icon: Zap,
    headline: "200 sheets in 20 minutes",
    body: "What used to take a faculty member two days of manual checking is done before the next class.",
  },
  {
    icon: Shield,
    headline: "Rubric-anchored accuracy",
    body: "Define your marking scheme once. Every answer is graded against the same standard — zero evaluator drift.",
  },
  {
    icon: Users,
    headline: "Cohort-level analytics",
    body: "Instantly see which questions stumped the class, which topics need re-teaching, which students need support.",
  },
];

function PipelineAnimation() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.35 });

  return (
    <div ref={ref} className="relative flex items-center justify-center gap-0 my-10 overflow-x-auto pb-2">
      {pipelineSteps.map((step, i) => {
        const Icon = step.icon;
        const isLast = i === pipelineSteps.length - 1;
        return (
          <div key={step.label} className="flex items-center flex-shrink-0">
            {/* Step node */}
            <motion.div
              className="flex flex-col items-center gap-2"
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ delay: i * 0.18, type: "spring", stiffness: 200, damping: 20 }}
            >
              <div
                className="h-18 w-18 rounded-2xl flex items-center justify-center border"
                style={{
                  backgroundColor: step.color + "18",
                  borderColor: step.color + "44",
                  width: "4.5rem",
                  height: "4.5rem",
                }}
              >
                <Icon className="w-8 h-8" style={{ color: step.color }} />
              </div>
              <p className="text-xs font-bold text-foreground">{step.label}</p>
              <p className="text-[10px] text-muted-foreground text-center max-w-[80px] leading-snug">{step.desc}</p>
            </motion.div>

            {/* Connector arrow */}
            {!isLast && (
              <motion.div
                className="w-10 sm:w-14 flex-shrink-0 flex items-center justify-center mx-1"
                initial={{ opacity: 0, scaleX: 0 }}
                animate={inView ? { opacity: 1, scaleX: 1 } : { opacity: 0, scaleX: 0 }}
                transition={{ delay: 0.1 + i * 0.18 + 0.12, duration: 0.35, ease: "easeOut" }}
                style={{ transformOrigin: "left" }}
              >
                <div className="h-px w-full bg-border relative">
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[4px] border-b-[4px] border-l-[6px] border-t-transparent border-b-transparent border-l-border" />
                </div>
              </motion.div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function EvaluationIntel() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });

  return (
    <section id="evaluation" className="section-lg bg-background">
      <div className="container-tight">
        {/* Header */}
        <motion.div
          ref={ref}
          className="text-center mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          <p className="eyebrow">Evaluation Intelligence</p>

          <h2
            className="font-display font-bold text-foreground tracking-tight mb-4"
            style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
          >
            Evaluate 200 answer sheets in the time
            <br />
            it takes to evaluate 5.
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            AI-assisted evaluation reads handwritten answers, applies your rubric, and surfaces
            results — so faculty can focus on teaching, not marking.
          </p>
        </motion.div>

        {/* 4-step pipeline */}
        <PipelineAnimation />

        {/* 3 feature cards */}
        <div className="grid md:grid-cols-3 gap-5 mt-8">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.headline}
                className="flex flex-col gap-3 p-6 rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-[0_4px_24px_-8px_rgba(79,70,229,0.1)] transition-all duration-300"
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                transition={{ delay: 0.85 + i * 0.1, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="h-13 w-13 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center" style={{ width: "3.25rem", height: "3.25rem" }}>
                  <Icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">{f.headline}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
