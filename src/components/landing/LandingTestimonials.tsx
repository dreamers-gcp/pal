import { FadeIn } from "./FadeIn";
import { TESTIMONIALS } from "@/lib/landing-data";

export function LandingTestimonials() {
  return (
    <section className="section-md bg-accent/20">
      <div className="container-tight">
        <div className="grid md:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <FadeIn key={i} delay={i * 100}>
              <div className="flex flex-col gap-4 p-6 rounded-2xl border border-border bg-card h-full">
                <p className="text-sm text-foreground leading-relaxed flex-1">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="border-t border-border pt-4">
                  <p className="text-xs font-semibold text-foreground">{t.role}</p>
                  <p className="text-xs text-muted-foreground">{t.institution}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{t.size}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
