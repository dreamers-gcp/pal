import Link from "next/link";
import {
  CheckCircle2, MessageSquare, Calendar, Building2,
  UserCheck, TrendingUp, BarChart3, CreditCard,
  FileText, Mail
} from "lucide-react";
import { FadeIn } from "./FadeIn";
import { MODULES_SECTION, COMPANY } from "@/lib/landing-data";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  attendance: CheckCircle2,
  messaging: MessageSquare,
  timetable: Calendar,
  booking: Building2,
  onboarding: UserCheck,
  enrollment: TrendingUp,
  analytics: BarChart3,
  fees: CreditCard,
  evaluation: FileText,
  inbox: Mail,
};

export function ModuleGrid() {
  return (
    <section id="modules" className="section-lg bg-accent/20">
      <div className="container-tight">
        {/* Header */}
        <FadeIn className="text-center mb-14">
          <h2
            className="font-display font-bold text-foreground tracking-tight mb-4"
            style={{ fontSize: "clamp(1.9rem, 3.5vw, 2.75rem)" }}
          >
            {MODULES_SECTION.headline}
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            {MODULES_SECTION.subhead}
          </p>
        </FadeIn>

        {/* Module grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
          {MODULES_SECTION.modules.map((mod, i) => {
            const Icon = iconMap[mod.id] ?? CheckCircle2;
            return (
              <FadeIn key={mod.id} delay={Math.floor(i / 3) * 100 + (i % 3) * 60}>
                <div className={`module-card h-full ${mod.highlight ? "border-primary/30 bg-primary/3" : ""}`}>
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 p-2 rounded-lg ${mod.highlight ? "bg-primary/10" : "bg-accent"}`}>
                      <Icon className={`w-4 h-4 ${mod.highlight ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold text-sm mb-0.5 ${mod.highlight ? "text-primary" : "text-foreground"}`}>
                        {mod.name}
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Replaces: {mod.replaces}
                      </p>
                    </div>
                  </div>
                </div>
              </FadeIn>
            );
          })}
        </div>

        {/* Attendance feature callout */}
        <FadeIn delay={200}>
          <div className="rounded-2xl border border-primary/25 bg-card p-7 md:p-9 flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                <h3 className="font-semibold text-foreground">
                  {MODULES_SECTION.attendanceCallout.title}
                </h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3 max-w-xl">
                {MODULES_SECTION.attendanceCallout.body}
              </p>
              <span className="pill">{MODULES_SECTION.attendanceCallout.tagline}</span>
            </div>
            <Link
              href={COMPANY.demoLink}
              className="flex-shrink-0 inline-flex h-10 items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              See verification options →
            </Link>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
