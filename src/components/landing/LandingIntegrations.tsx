import { FadeIn } from "./FadeIn";

const stacks = [
  {
    category: "ERP / SIS",
    items: ["MasterSoft ERP", "Serosoft Academia", "TCS iON", "Focus EduSoft", "SAP & Oracle", "Custom SIS via API"],
  },
  {
    category: "Messaging",
    items: ["Twilio", "AWS SNS", "Local SMS Gateways", "Gmail", "Outlook"],
  },
  {
    category: "Payments",
    items: ["Razorpay", "PayU", "HDFC", "Bank APIs"],
  },
  {
    category: "Identity",
    items: ["OAuth 2.0", "LDAP / AD", "Custom SSO"],
  },
];

export function LandingIntegrations() {
  return (
    <section id="integrations" className="section-lg bg-accent/20">
      <div className="container-tight">
        <FadeIn className="text-center mb-14">
          <h2
            className="font-display font-bold text-foreground tracking-tight mb-3"
            style={{ fontSize: "clamp(1.9rem, 3.5vw, 2.75rem)" }}
          >
            Bring your stack.
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            The Nucleus connects to the ERPs and tools Indian institutions already use. No forklift required.
          </p>
        </FadeIn>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stacks.map((stack, i) => (
            <FadeIn key={i} delay={i * 80}>
              <div className="bg-card border border-border rounded-xl p-5 h-full">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
                  {stack.category}
                </p>
                <ul className="space-y-1.5">
                  {stack.items.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-foreground">
                      <span className="h-1 w-1 rounded-full bg-primary flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={300} className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Versioned REST APIs + webhooks. No vendor lock-in.{" "}
            <span className="text-foreground font-medium">Data is always exportable.</span>
          </p>
        </FadeIn>
      </div>
    </section>
  );
}
