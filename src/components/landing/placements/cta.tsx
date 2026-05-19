"use client";

import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { ArrowLeft, Phone } from "lucide-react";

const phones = [
  { display: "+91 84894 31508", number: "+918489431508" },
  { display: "+91 80561 01540", number: "+918056101540" },
  { display: "+91 99943 56787", number: "+919994356787" },
];

export function PlacementsCTA() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <section id="cta" className="section-lg bg-background" ref={ref}>
      <div className="container-tight">
        <motion.div
          className="text-center max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          <h2
            className="font-display font-bold text-foreground tracking-tight mb-4"
            style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
          >
            See it running on your campus.
          </h2>
          <p className="text-muted-foreground text-lg mb-8">
            Book a 30-minute walkthrough. We&apos;ll show you the platform with sample
            placement data — no commitment, no setup fee.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
            <Link
              href="https://calendly.com/thenucleus/demo"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-primary px-7 text-sm font-semibold text-primary-foreground shadow-[0_2px_24px_-4px_rgba(79,70,229,0.45)] hover:opacity-90 transition-opacity"
            >
              Book a Demo
            </Link>
            <Link
              href="/"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border px-7 text-sm font-semibold text-foreground hover:bg-accent transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to The Nucleus
            </Link>
          </div>

          {/* Contact details */}
          <div className="pt-8 border-t border-border">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Or reach us directly
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              <a
                href="mailto:info@thenucleus.in"
                className="text-sm text-primary hover:opacity-80 transition-opacity"
              >
                info@thenucleus.in
              </a>
              {phones.map((p) => (
                <a
                  key={p.number}
                  href={`tel:${p.number}`}
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Phone className="w-3 h-3" />
                  {p.display}
                </a>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
