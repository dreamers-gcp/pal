import { FadeIn } from "./FadeIn";

const problems = [
  {
    label: "Records are locked in the ERP.",
    detail: "Enrollment, fees, academic history — all there. None of it connected to daily operations.",
  },
  {
    label: "Operations run on informal tools.",
    detail: "WhatsApp groups. Excel trackers. Email chains. No audit trail. No structure. No visibility.",
  },
  {
    label: "Intervention always comes too late.",
    detail: "By the time absenteeism or fee risk shows up, weeks have been lost. The signal was always there.",
  },
];

export function LandingProblem() {
  return (
    <section id="problem" className="section-lg bg-background">
      <div className="container-tight">
        <FadeIn className="text-center mb-16">
          <h2
            className="font-display font-bold text-foreground tracking-tight"
            style={{ fontSize: "clamp(1.9rem, 3.5vw, 2.75rem)" }}
          >
            The gap is costing you.
          </h2>
        </FadeIn>

        <div className="grid md:grid-cols-3 gap-px bg-border rounded-2xl overflow-hidden border border-border">
          {problems.map((p, i) => (
            <FadeIn
              key={i}
              delay={i * 120}
              className="bg-card p-8 md:p-10 flex flex-col gap-4"
            >
              <div className="flex items-start gap-3">
                <span className="mt-1 flex-shrink-0 h-2 w-2 rounded-full bg-destructive/60" />
                <p className="font-semibold text-foreground leading-snug text-base">
                  {p.label}
                </p>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed pl-5">
                {p.detail}
              </p>
            </FadeIn>
          ))}
        </div>

        {/* Bridge statement */}
        <FadeIn delay={400} className="mt-12 text-center">
          <p className="text-base font-semibold text-primary tracking-wide">
            The Nucleus closes that gap — without touching your ERP.
          </p>
        </FadeIn>
      </div>
    </section>
  );
}
