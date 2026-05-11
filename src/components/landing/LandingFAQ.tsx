"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { FAQ } from "@/lib/landing-data";
import { FadeIn } from "./FadeIn";

export function LandingFAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="section-lg bg-accent/20">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn className="text-center mb-12">
          <h2
            className="font-display font-bold text-foreground tracking-tight"
            style={{ fontSize: "clamp(1.9rem, 3.5vw, 2.75rem)" }}
          >
            Common questions
          </h2>
        </FadeIn>

        <div className="space-y-2">
          {FAQ.map((item, i) => (
            <FadeIn key={i} delay={i * 60}>
              <div className={`rounded-xl border transition-colors duration-200 overflow-hidden ${
                open === i ? "border-primary/30 bg-card" : "border-border bg-card hover:border-border"
              }`}>
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left"
                >
                  <span className="text-sm font-semibold text-foreground">{item.question}</span>
                  <span className="flex-shrink-0 h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                    {open === i
                      ? <Minus className="w-3 h-3 text-primary" />
                      : <Plus className="w-3 h-3 text-primary" />
                    }
                  </span>
                </button>
                {open === i && (
                  <div className="px-6 pb-5">
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.answer}</p>
                  </div>
                )}
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
