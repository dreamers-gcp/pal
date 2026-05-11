import { FadeIn } from "./FadeIn";
import { VALUE_PROPS } from "@/lib/landing-data";

export function LandingValueProps() {
  return (
    <section id="product" className="section-lg bg-background">
      <div className="container-tight">
        <FadeIn className="mb-14">
          <h2
            className="font-display font-bold text-foreground tracking-tight"
            style={{ fontSize: "clamp(1.9rem, 3.5vw, 2.75rem)" }}
          >
            {VALUE_PROPS.headline}
          </h2>
        </FadeIn>

        <div className="grid md:grid-cols-2 gap-6">
          {VALUE_PROPS.items.map((item, i) => (
            <FadeIn key={i} delay={i * 100}>
              <div className="group flex gap-5 p-7 rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-[0_4px_32px_-8px_rgba(79,70,229,0.1)] transition-all duration-300">
                <div className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/8 border border-primary/15">
                  <span className="text-primary font-bold text-xs tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-1.5">{item.title}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
