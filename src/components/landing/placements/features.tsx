"use client";

import { motion, useInView } from "framer-motion";
import { useRef, type ReactNode } from "react";
import {
  Mail,
  Sparkles,
  Kanban,
  Phone,
  CalendarDays,
  Megaphone,
  Check,
  Clock,
  Building2,
  User,
  FileText,
} from "lucide-react";

type Feature = {
  eyebrow: string;
  title: string;
  body: string;
  icon: typeof Mail;
  mock: ReactNode;
};

const features: Feature[] = [
  {
    eyebrow: "Shared inbox",
    title: "One inbox for the whole team.",
    body: "Connect your placement office Gmail. Every recruiter email lands in a shared inbox visible to the entire committee. Thread assignments, read status, and reply tracking — all without forwarding.",
    icon: Mail,
    mock: (
      <div className="space-y-2.5">
        {[
          { from: "amrita@deloitte.com",     subj: "Re: Campus visit 2026",     time: "2h", unread: true  },
          { from: "rohan.k@goldman.com",     subj: "JD for SDE intern roles",   time: "5h", unread: false },
          { from: "talent@mckinsey.com",     subj: "Preplacement talk slots",   time: "1d", unread: true  },
        ].map((m, i) => (
          <div key={i} className={`flex items-center gap-3 p-2.5 rounded-lg border ${m.unread ? "bg-primary/5 border-primary/15" : "bg-card border-border"}`}>
            <div className={`h-2 w-2 rounded-full flex-shrink-0 ${m.unread ? "bg-primary" : "bg-transparent"}`} />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-foreground truncate">{m.from}</p>
              <p className="text-[10px] text-muted-foreground truncate">{m.subj}</p>
            </div>
            <span className="text-[10px] text-muted-foreground flex-shrink-0">{m.time}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    eyebrow: "AI extraction",
    title: "Contacts extracted. Automatically.",
    body: "Every incoming email is scanned by AI. Company names, recruiter contacts, phone numbers, and JD details are pulled out and added to your CRM — no manual data entry.",
    icon: Sparkles,
    mock: (
      <div className="space-y-2">
        <div className="text-[10px] text-muted-foreground italic px-2 mb-2">
          &quot;Hi, this is Priya from BCG. Reach me at +91-9876543210...&quot;
        </div>
        {[
          { label: "Contact",    value: "Priya Sharma",        icon: User },
          { label: "Company",    value: "Boston Consulting Group", icon: Building2 },
          { label: "Phone",      value: "+91 98765 43210",     icon: Phone },
          { label: "JD",         value: "Associate Consultant", icon: FileText },
        ].map((f, i) => {
          const Icon = f.icon;
          return (
            <div key={i} className="flex items-center gap-2.5 p-2 rounded-lg bg-primary/5 border border-primary/10">
              <Icon className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <span className="text-[10px] text-muted-foreground w-14 flex-shrink-0">{f.label}</span>
              <span className="text-[11px] font-semibold text-foreground truncate">{f.value}</span>
              <Check className="w-3 h-3 text-green-600 flex-shrink-0 ml-auto" />
            </div>
          );
        })}
      </div>
    ),
  },
  {
    eyebrow: "Recruiter CRM",
    title: "From first email to final offer. One pipeline.",
    body: "A 4-stage Kanban board built for placement teams. Track leads from Awareness to Engagement to JD Expected to Relationship Management. See stalled leads, JD counts, lead velocity, and staff assignments at a glance.",
    icon: Kanban,
    mock: (
      <div className="grid grid-cols-4 gap-1.5">
        {[
          { stage: "Awareness",   count: 12, color: "#818cf8" },
          { stage: "Engagement",  count: 8,  color: "#6366f1" },
          { stage: "JD Expected", count: 5,  color: "#f59e0b" },
          { stage: "Relations",   count: 14, color: "#10b981" },
        ].map((s, i) => (
          <div key={i} className="rounded-lg bg-primary/5 border border-primary/10 p-2 text-center">
            <p className="text-base font-bold" style={{ color: s.color }}>{s.count}</p>
            <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">{s.stage}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    eyebrow: "Calls & meetings",
    title: "Every recruiter call. Recorded and transcribed.",
    body: "Make outbound calls directly from the platform. Every call is recorded, transcribed, and linked to the recruiter's CRM profile. AI generates meeting summaries so nothing falls through the cracks.",
    icon: Phone,
    mock: (
      <div className="space-y-2">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
            <Phone className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-foreground">Call with Amrita (Deloitte)</p>
            <p className="text-[10px] text-muted-foreground">12 min · transcribed</p>
          </div>
          <span className="text-[10px] text-green-600 font-semibold">Done</span>
        </div>
        <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/10">
          <p className="text-[10px] font-bold text-primary mb-1">AI summary</p>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Deloitte confirmed 14 SDE slots for Day 1. JD to follow Friday. Wants pre-screen of CGPA &gt; 7.5.
          </p>
        </div>
      </div>
    ),
  },
  {
    eyebrow: "Calendar",
    title: "Recruiter meetings. Synced and scheduled.",
    body: "Google Calendar integration lets you schedule recruiter meetings in one click — with Google Meet links and attendee management.",
    icon: CalendarDays,
    mock: (
      <div className="space-y-2">
        {[
          { time: "10:00",  title: "Deloitte — JD review",     attendees: 3 },
          { time: "14:30",  title: "Goldman Sachs — Pre-talk", attendees: 5 },
          { time: "16:00",  title: "BCG — Slot finalisation",  attendees: 2 },
        ].map((m, i) => (
          <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-card border border-border">
            <div className="flex flex-col items-center w-10 flex-shrink-0">
              <Clock className="w-3 h-3 text-muted-foreground mb-0.5" />
              <span className="text-[10px] font-bold text-foreground">{m.time}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-foreground truncate">{m.title}</p>
              <p className="text-[10px] text-muted-foreground">{m.attendees} attendees</p>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    eyebrow: "Broadcasting",
    title: "Reach recruiters at scale.",
    body: "Send targeted campaigns via email, SMS, or WhatsApp. Segment by lead stage, company type, or custom tags. Track delivery, opens, and responses.",
    icon: Megaphone,
    mock: (
      <div className="space-y-2">
        <div className="p-3 rounded-lg bg-card border border-border">
          <p className="text-[11px] font-semibold text-foreground mb-1">Day 1 invite — Tech sector</p>
          <p className="text-[10px] text-muted-foreground mb-2">Segment: Engagement + JD Expected · 23 recruiters</p>
          <div className="flex gap-1.5">
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">Email</span>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">WhatsApp</span>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">SMS</span>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 p-2 rounded-lg bg-primary/5 border border-primary/10 text-center">
            <p className="text-sm font-bold text-primary">94%</p>
            <p className="text-[9px] text-muted-foreground">Delivered</p>
          </div>
          <div className="flex-1 p-2 rounded-lg bg-primary/5 border border-primary/10 text-center">
            <p className="text-sm font-bold text-primary">67%</p>
            <p className="text-[9px] text-muted-foreground">Opened</p>
          </div>
          <div className="flex-1 p-2 rounded-lg bg-primary/5 border border-primary/10 text-center">
            <p className="text-sm font-bold text-primary">18</p>
            <p className="text-[9px] text-muted-foreground">Replies</p>
          </div>
        </div>
      </div>
    ),
  },
];

function FeatureRow({ feature, index }: { feature: Feature; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.25 });
  const reversed = index % 2 === 1;
  const Icon = feature.icon;

  return (
    <div ref={ref} className={`grid md:grid-cols-2 gap-10 items-center ${reversed ? "md:[&>*:first-child]:order-2" : ""}`}>
      <motion.div
        initial={{ opacity: 0, x: reversed ? 24 : -24 }}
        animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: reversed ? 24 : -24 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="eyebrow">{feature.eyebrow}</p>
        <h3
          className="font-display font-bold text-foreground tracking-tight mb-4"
          style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)" }}
        >
          {feature.title}
        </h3>
        <p className="text-muted-foreground leading-relaxed">{feature.body}</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: reversed ? -24 : 24 }}
        animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: reversed ? -24 : 24 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-2xl border border-border bg-card/80 backdrop-blur shadow-sm p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="w-4 h-4 text-primary" />
          </div>
          <p className="text-xs font-bold text-foreground uppercase tracking-wide">{feature.eyebrow}</p>
        </div>
        {feature.mock}
      </motion.div>
    </div>
  );
}

export function PlacementsFeatures() {
  return (
    <section id="features" className="section-lg bg-background">
      <div className="container-wide space-y-20 md:space-y-28">
        {features.map((f, i) => (
          <FeatureRow key={f.eyebrow} feature={f} index={i} />
        ))}
      </div>
    </section>
  );
}
