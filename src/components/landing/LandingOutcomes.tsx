import { FadeIn } from "./FadeIn";
import { OUTCOMES } from "@/lib/landing-data";

export function LandingOutcomes() {
  return (
    <section id="outcomes" className="section-lg bg-background">
      <div className="container-tight">
        <FadeIn className="text-center mb-16">
          <h2
            className="font-display font-bold text-foreground tracking-tight mb-3"
            style={{ fontSize: "clamp(1.9rem, 3.5vw, 2.75rem)" }}
          >
            {OUTCOMES.headline}
          </h2>
          <p className="text-muted-foreground text-sm">{OUTCOMES.subhead}</p>
        </FadeIn>

        <div className="grid grid-cols-3 gap-px bg-border border border-border rounded-2xl overflow-hidden mb-10">
          {OUTCOMES.metrics.map((m, i) => (
            <FadeIn key={i} delay={i * 100} className="bg-card px-6 py-8 text-center">
              <p
                className="font-display font-bold text-primary mb-1"
                style={{ fontSize: "clamp(1.8rem, 3vw, 2.6rem)" }}
              >
                {m.value}
              </p>
              <p className="text-xs font-medium text-foreground leading-snug mb-1">{m.label}</p>
              <p className="text-[10px] text-muted-foreground">{m.context}</p>
            </FadeIn>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          {OUTCOMES.items.map((item, i) => (
            <FadeIn key={i} delay={i * 80}>
              <div className="flex items-start gap-4 p-5 rounded-xl border border-border bg-card hover:border-primary/25 transition-colors">
                <span className="mt-0.5 flex-shrink-0 h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
                <p className="text-sm text-foreground leading-relaxed">{item}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
