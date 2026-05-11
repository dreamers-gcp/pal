import { FadeIn } from "./FadeIn";
import { HOW_IT_WORKS } from "@/lib/landing-data";

const outputs = [
  { name: "Attendance", sub: "Verified proof, real-time alerts" },
  { name: "Scheduling", sub: "Conflict-free, approval-logged" },
  { name: "Messaging", sub: "Auditable, role-gated comms" },
  { name: "Fee Workflows", sub: "Auto-notices, payment visibility" },
  { name: "Onboarding", sub: "Structured, ERP-connected" },
  { name: "Early Warnings", sub: "At-risk signals, weeks early" },
];

export function LandingBridge() {
  return (
    <section id="how-it-works" className="section-lg bg-accent/20">
      <div className="container-tight">
        {/* Header */}
        <FadeIn className="text-center mb-16">
          <h2
            className="font-display font-bold text-foreground tracking-tight mb-4"
            style={{ fontSize: "clamp(1.9rem, 3.5vw, 2.75rem)" }}
          >
            {HOW_IT_WORKS.headline}
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            {HOW_IT_WORKS.subhead}
          </p>
        </FadeIn>

        {/* Main diagram */}
        <FadeIn delay={100} className="mb-16">
          <div className="bg-card border border-border rounded-2xl p-8 md:p-12">
            {/* Top row: ERP → Nucleus → Action label */}
            <div className="flex flex-col md:flex-row items-center gap-4 md:gap-0 justify-between mb-10">
              {/* ERP box */}
              <div className="w-full md:w-[220px] rounded-xl border border-border bg-background p-5 text-center">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Your ERP / SIS</p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>Enrollment · Fees</p>
                  <p>Academic records</p>
                  <p>Master student data</p>
                </div>
                <div className="mt-3 inline-block px-2 py-0.5 rounded bg-muted text-[10px] font-semibold text-muted-foreground">
                  Source of truth
                </div>
              </div>

              {/* Arrow */}
              <div className="flex md:flex-col items-center gap-1 mx-4 md:mx-6 flex-shrink-0">
                <div className="h-px w-10 md:h-10 md:w-px bg-primary/30 hidden md:block" />
                <svg className="text-primary rotate-90 md:rotate-0 flex-shrink-0" width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <path d="M4 16h20M18 9l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="h-px w-10 md:h-10 md:w-px bg-primary/30 hidden md:block" />
              </div>

              {/* Nucleus box — center, highlighted */}
              <div className="w-full md:w-[240px] rounded-2xl border border-primary bg-primary p-6 text-center animate-pulse-glow">
                <p className="text-[10px] font-bold text-primary-foreground/70 uppercase tracking-widest mb-2">
                  Operating Layer
                </p>
                <p className="font-bold text-primary-foreground text-lg mb-1">The Nucleus</p>
                <div className="space-y-0.5 text-xs text-primary-foreground/75">
                  <p>Reads ERP data</p>
                  <p>Runs workflows</p>
                  <p>Sends signals</p>
                </div>
              </div>

              {/* Arrow */}
              <div className="flex md:flex-col items-center gap-1 mx-4 md:mx-6 flex-shrink-0">
                <div className="h-px w-10 md:h-10 md:w-px bg-primary/30 hidden md:block" />
                <svg className="text-primary rotate-90 md:rotate-0 flex-shrink-0" width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <path d="M4 16h20M18 9l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="h-px w-10 md:h-10 md:w-px bg-primary/30 hidden md:block" />
              </div>

              {/* Output box */}
              <div className="w-full md:w-[220px] rounded-xl border border-border bg-background p-5 text-center">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Institutional Action</p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>Alerts dispatched</p>
                  <p>Approvals logged</p>
                  <p>Signals surfaced</p>
                </div>
                <div className="mt-3 inline-block px-2 py-0.5 rounded bg-primary/10 text-[10px] font-semibold text-primary">
                  No WhatsApp needed
                </div>
              </div>
            </div>

            {/* Output capability tags */}
            <div className="border-t border-border pt-7">
              <p className="text-xs text-center font-semibold text-muted-foreground uppercase tracking-widest mb-4">
                Active across
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {outputs.map((o) => (
                  <div
                    key={o.name}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent border border-border"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                    <span className="text-xs font-semibold text-foreground">{o.name}</span>
                    <span className="text-xs text-muted-foreground hidden sm:inline">— {o.sub}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </FadeIn>

        {/* Three principles */}
        <div className="grid md:grid-cols-3 gap-4">
          {HOW_IT_WORKS.principles.map((p, i) => (
            <FadeIn key={i} delay={i * 100}>
              <div className="rounded-xl border border-border bg-card p-6">
                <p className="font-semibold text-foreground mb-1 text-sm">{p.title}</p>
                <p className="text-sm text-muted-foreground">{p.body}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
