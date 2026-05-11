import { Users, ShieldCheck, Database, Lock } from "lucide-react";
import { FadeIn } from "./FadeIn";
import { TRUST } from "@/lib/landing-data";

const icons = [Users, ShieldCheck, Database, Lock];

export function LandingTrust() {
  return (
    <section id="trust" className="section-lg bg-background">
      <div className="container-tight">
        <FadeIn className="text-center mb-14">
          <h2
            className="font-display font-bold text-foreground tracking-tight mb-3"
            style={{ fontSize: "clamp(1.9rem, 3.5vw, 2.75rem)" }}
          >
            {TRUST.headline}
          </h2>
        </FadeIn>

        <div className="grid md:grid-cols-2 gap-4">
          {TRUST.pillars.map((pillar, i) => {
            const Icon = icons[i % icons.length];
            return (
              <FadeIn key={i} delay={i * 100}>
                <div className="flex gap-5 p-7 rounded-2xl border border-border bg-card hover:border-primary/25 hover:shadow-[0_4px_24px_-8px_rgba(79,70,229,0.1)] transition-all duration-300">
                  <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/8 border border-primary/15">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground mb-1.5">{pillar.title}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{pillar.body}</p>
                  </div>
                </div>
              </FadeIn>
            );
          })}
        </div>
      </div>
    </section>
  );
}
