// The Nucleus — homepage copy
// Strategy: B2B SaaS, enterprise tone, skimmable, outcome-led

export const COMPANY = {
  name: "The Nucleus",
  legalName: "The Nucleus Education Tech",
  email: "demo@thenucleus.io",
  phone: "+91-XXX-XXX-XXXX",
  demoLink: "https://calendly.com/thenucleus/demo",
};

// ─── NAV ────────────────────────────────────────────────────────────────────

export const NAV_ITEMS = [
  { label: "How It Works", href: "#how-it-works" },
  { label: "Modules", href: "#modules" },
  { label: "Security", href: "#trust" },
  { label: "Pricing", href: "/pricing" },
];

// ─── HERO ───────────────────────────────────────────────────────────────────

export const HERO = {
  headline: "Your ERP holds the data.\nWe make it work.",
  subheadline:
    "The Nucleus sits between your ERP and your institution's daily operations — connecting records to attendance, scheduling, fees, communication, and student outcomes. No replacement. No disruption.",
  primaryCTA: { label: "Book a Demo", href: COMPANY.demoLink },
  secondaryCTA: { label: "See how it works", href: "#how-it-works" },
  tagline: "The operating layer for Indian higher education.",
};

// ─── SOCIAL PROOF ────────────────────────────────────────────────────────────

export const SOCIAL_PROOF = {
  line: "Trusted by schools, colleges, and multi-program universities across India.",
  logos: [] as string[], // replace with real logos
};

// ─── TESTIMONIALS ────────────────────────────────────────────────────────────

export const TESTIMONIALS = [
  {
    quote:
      "We replaced three WhatsApp groups and two Excel trackers with one layer. The registrar's team now has a paper trail for every decision.",
    role: "Registrar",
    institution: "Private Engineering College, Telangana",
    size: "4,200 students",
  },
  {
    quote:
      "Attendance alerts used to go out the next morning — if someone remembered to send them. Now parents know within minutes. That alone changed how families engage.",
    role: "Principal",
    institution: "CBSE School, Karnataka",
    size: "1,800 students",
  },
  {
    quote:
      "Implementation was two weeks for the pilot department. No vendor project, no consultants. Our IT team handled the ERP connection in a day.",
    role: "IT Head",
    institution: "Autonomous College, Maharashtra",
    size: "6,500 students",
  },
];

// ─── PROBLEM ─────────────────────────────────────────────────────────────────

export const PROBLEM = {
  headline: "The gap is costing you.",
  lines: [
    "Your ERP has the records. But the work still happens on WhatsApp, Excel, and email chains nobody can audit.",
    "Missed alerts. Manual approvals. No early warning. No single version of the truth.",
    "The Nucleus closes that gap.",
  ],
};

// ─── HOW IT WORKS ─────────────────────────────────────────────────────────────

export const HOW_IT_WORKS = {
  headline: "One layer. Across every operation.",
  subhead:
    "The Nucleus reads from your ERP and activates it — across workflows, communications, and real-time signals.",
  nodes: [
    {
      label: "Your ERP",
      description: "Records, Enrollment,\nFees, Master data",
    },
    {
      label: "The Nucleus",
      description: "Attendance, Scheduling,\nCommunication, Analytics",
    },
    {
      label: "Action",
      description: "Alerts sent.\nWorkflows run.\nSignals flagged.",
    },
  ],
  principles: [
    {
      title: "ERP stays the source of truth.",
      body: "We read from it. We don't overwrite it.",
    },
    {
      title: "Start with one module.",
      body: "Expand when you're ready. No big-bang rollout.",
    },
    {
      title: "Structure replaces chaos.",
      body: "Every approval, alert, and action is logged.",
    },
  ],
};

// ─── VALUE PROPOSITIONS ───────────────────────────────────────────────────────

export const VALUE_PROPS = {
  headline: "Built for how Indian institutions actually operate.",
  items: [
    {
      title: "Operations that don't depend on memory",
      body: "Every approval, booking, and workflow is tracked. Your team always knows what's next.",
    },
    {
      title: "Communication with a paper trail",
      body: "Attendance alerts, fee notices, and messages go through The Nucleus — not WhatsApp. Every message logged.",
    },
    {
      title: "Early signals, not late reports",
      body: "Attendance patterns, fee delays, and engagement gaps surface before they become problems.",
    },
    {
      title: "Adoption in weeks, not months",
      body: "No implementation project. No parallel migration. Pick a module, connect your ERP, go live.",
    },
  ],
};

// ─── MODULES ──────────────────────────────────────────────────────────────────

export const MODULES_SECTION = {
  headline: "Ten modules. One operating layer.",
  subhead:
    "Use one. Use all. Each module connects to your ERP and to every other module you activate.",
  modules: [
    {
      id: "attendance",
      name: "Attendance",
      replaces: "Manual roll calls, Excel sheets, WhatsApp chains",
      highlight: true,
      highlightNote:
        "Optional: photo, video, or CCTV-based verification where policy permits.",
    },
    {
      id: "messaging",
      name: "Parent & Staff Messaging",
      replaces: "Broadcast WhatsApp groups with no audit trail",
    },
    {
      id: "timetable",
      name: "Timetable & Scheduling",
      replaces: "Email chains and clashing calendar requests",
    },
    {
      id: "booking",
      name: "Facilities Booking",
      replaces: "Spreadsheet sign-up sheets and booking conflicts",
    },
    {
      id: "onboarding",
      name: "Student Onboarding",
      replaces: "Paper forms, scattered document collection",
    },
    {
      id: "enrollment",
      name: "Enrollment & Campaigns",
      replaces: "Ad-hoc outreach with no funnel visibility",
    },
    {
      id: "analytics",
      name: "Per-Student Analytics",
      replaces: "End-of-semester surprises about at-risk students",
    },
    {
      id: "fees",
      name: "Fee Communication",
      replaces: "Manual reminders and unclear payment status",
    },
    {
      id: "evaluation",
      name: "Answer Paper Evaluation",
      replaces: "Physical paper routing and delayed results",
    },
    {
      id: "inbox",
      name: "Shared Inbox & Ops",
      replaces: "Fragmented email inboxes, no handoff, no record",
    },
  ],
  attendanceCallout: {
    title: "Attendance with verified proof",
    body: "Mark via app, QR, biometric, or kiosk. Where policy permits: integrate photo verification, video capture, or live CCTV feed correlation. Every mark is timestamped, consent-managed, and audit-ready.",
    tagline: "Responsible verification. Not surveillance.",
  },
};

// ─── OUTCOMES ────────────────────────────────────────────────────────────────

export const OUTCOMES = {
  headline: "What changes when The Nucleus is running.",
  subhead: "Based on operational data from pilot and active deployments across institutions in India.",
  metrics: [
    { value: "2–4 hrs", label: "Average alert-to-parent time", context: "vs. next-day manual calls" },
    { value: "4–6 wks", label: "Earlier absenteeism detection", context: "vs. end-of-semester review" },
    { value: "0", label: "Double-booked classrooms", context: "after scheduling goes live" },
  ],
  items: [
    "Attendance alerts reach parents in minutes — not next-day",
    "Absenteeism patterns surfaced 4–6 weeks earlier than manual review",
    "Zero double-booked classrooms once scheduling goes live",
    "Fee follow-up time drops — auto-notices replace manual calls",
    "At-risk students flagged before semester-end, not after",
    "Every admin action logged — audit-ready from day one",
  ],
};

// ─── TRUST ────────────────────────────────────────────────────────────────────

export const TRUST = {
  headline: "Built for institutions that can't afford data problems.",
  pillars: [
    {
      title: "Role-based access, by design",
      body: "Teachers see their class. Parents see their child. Admins see what they're authorised for. No accidental exposure.",
    },
    {
      title: "Every action is auditable",
      body: "Timestamps, user IDs, change history. Compliance-ready from day one.",
    },
    {
      title: "Your data stays in India",
      body: "Hosted on AWS Mumbai. Encrypted at rest (AES-256) and in transit (TLS 1.3).",
    },
    {
      title: "Digital proof, with consent",
      body: "Photo, video, and biometric attendance features are consent-gated, institution-controlled, and DPDP Act-aligned. Retention periods are set by you.",
    },
  ],
};

// ─── FAQ ──────────────────────────────────────────────────────────────────────

export const FAQ = [
  {
    question: "Does this replace our ERP?",
    answer:
      "No. Your ERP stays the source of truth. The Nucleus reads from it and adds workflows, communication, and analytics on top. We don't touch your ERP data — we activate it.",
  },
  {
    question: "Can we start with just one module?",
    answer:
      "Yes. Every module is independent and integrates with your ERP. Most institutions start with attendance or scheduling and expand from there. There's no big-bang rollout required.",
  },
  {
    question: "How long does implementation take?",
    answer:
      "A pilot — one department, up to 500 students — can go live in 2–4 weeks. Full rollout typically takes 30–90 days depending on scope. Implementation support is included in every plan.",
  },
  {
    question: "What's your uptime commitment?",
    answer:
      "We target 99.9% uptime with a published SLA. We run on AWS Mumbai with automated failover. Planned maintenance is communicated 48 hours in advance and scheduled outside academic peak hours.",
  },
  {
    question: "How is this different from just extending our ERP?",
    answer:
      "ERP extensions are expensive, slow, and locked to your vendor's roadmap. The Nucleus is a separate layer — faster to deploy, independently updated, and works across any ERP or SIS. You don't need to wait for a vendor upgrade cycle.",
  },
  {
    question: "What if we already use a third-party SMS or payment gateway?",
    answer:
      "We integrate with the common ones: Twilio, AWS SNS, local Indian SMS gateways, Razorpay, PayU, and HDFC. Bring your stack.",
  },
  {
    question: "Is biometric or CCTV attendance mandatory?",
    answer:
      "No. It's optional. Digital proof methods are enabled only if your institution's policy permits and student consent is obtained. The Nucleus works with standard app-based, QR, or manual attendance without any hardware.",
  },
  {
    question: "What happens to our data if we stop using The Nucleus?",
    answer:
      "You export it. Full CSV/JSON export is always available, for every module. No lock-in, no ransom, no friction.",
  },
];

// ─── FOOTER CTA ───────────────────────────────────────────────────────────────

export const FOOTER_CTA = {
  headline: "Ready to close the gap?",
  subhead:
    "Start with one module. Run a 30-day pilot. See the operational shift before you commit further.",
  primaryCTA: { label: "Book a Demo", href: COMPANY.demoLink },
  secondaryCTA: { label: "Download Overview PDF", href: "#" },
  trustLine: "No long-term contract required for pilots. Implementation support included.",
};

// ─── FOOTER LINKS ─────────────────────────────────────────────────────────────

export const FOOTER_LINKS = [
  {
    heading: "Product",
    links: [
      { label: "How It Works", href: "#how-it-works" },
      { label: "Modules", href: "#modules" },
      { label: "Security", href: "#trust" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Blog", href: "/blog" },
      { label: "Careers", href: "/careers" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Data Processing Agreement", href: "/legal/dpa" },
    ],
  },
];

// ─── PRICING ─────────────────────────────────────────────────────────────────

export const PRICING = {
  headline: "Transparent pricing. No hidden costs.",
  subhead:
    "Start with a pilot. Expand when you're ready. Every plan includes implementation support.",
  tiers: [
    {
      name: "Starter",
      tagline: "For schools and small colleges",
      priceNote: "From ₹2,500 / month",
      modules: "Up to 3 modules",
      students: "Up to 1,000 students",
      features: [
        "Attendance + 2 modules of your choice",
        "App-based and QR attendance",
        "Parent messaging (SMS + in-app)",
        "ERP read integration",
        "Standard support (business hours)",
        "Onboarding included",
      ],
      cta: "Get a Quote",
      highlight: false,
    },
    {
      name: "Growth",
      tagline: "For colleges and mid-size institutions",
      priceNote: "From ₹8,000 / month",
      modules: "Up to 7 modules",
      students: "Up to 5,000 students",
      features: [
        "All Starter features",
        "Timetable & Facilities Booking",
        "Per-student analytics dashboard",
        "Fee communication module",
        "Priority support + dedicated CSM",
        "Role-based access controls",
        "Audit log access",
      ],
      cta: "Get a Quote",
      highlight: true,
    },
    {
      name: "Enterprise",
      tagline: "For universities and multi-campus institutions",
      priceNote: "Custom pricing",
      modules: "All 10 modules",
      students: "Unlimited",
      features: [
        "All Growth features",
        "CCTV / biometric attendance (optional)",
        "Custom ERP / SIS integration",
        "Multi-campus management",
        "SSO / LDAP / custom identity",
        "SLA-backed uptime (99.9%)",
        "Dedicated implementation team",
        "Data Processing Agreement (DPA)",
      ],
      cta: "Contact Sales",
      highlight: false,
    },
  ],
  note: "All plans include: data residency in India (AWS Mumbai), AES-256 encryption, DPDP Act alignment, and full CSV/JSON data export.",
};

export const PRICING_FORM = {
  submitLabel: "Send enquiry",
  successMessage: "Got it. We'll get back to you within one business day.",
  fields: [
    { name: "fullName", label: "Full Name", type: "text", required: true },
    { name: "email", label: "Work Email", type: "email", required: true },
    { name: "phone", label: "Phone Number", type: "tel", required: false },
    { name: "institution", label: "Institution Name", type: "text", required: true },
    {
      name: "role",
      label: "Your Role",
      type: "select",
      required: true,
      options: [
        { value: "principal", label: "Principal / Director" },
        { value: "registrar", label: "Registrar / VC Office" },
        { value: "operations", label: "Operations Head" },
        { value: "admissions", label: "Admissions Leader" },
        { value: "cio", label: "CIO / IT Head" },
        { value: "finance", label: "Finance / Accounts Head" },
        { value: "other", label: "Other" },
      ],
    },
    {
      name: "students",
      label: "Student Count",
      type: "select",
      required: true,
      options: [
        { value: "under500", label: "Under 500" },
        { value: "500-2000", label: "500 – 2,000" },
        { value: "2000-5000", label: "2,000 – 5,000" },
        { value: "5000-10000", label: "5,000 – 10,000" },
        { value: "over10000", label: "10,000+" },
      ],
    },
    {
      name: "tier",
      label: "Plan of Interest",
      type: "select",
      required: false,
      options: [
        { value: "starter", label: "Starter" },
        { value: "growth", label: "Growth" },
        { value: "enterprise", label: "Enterprise" },
        { value: "unsure", label: "Not sure yet" },
      ],
    },
    {
      name: "erp",
      label: "Current ERP / SIS",
      type: "text",
      required: false,
    },
    {
      name: "timeline",
      label: "Target Go-Live",
      type: "select",
      required: false,
      options: [
        { value: "asap", label: "As soon as possible" },
        { value: "1month", label: "Within 1 month" },
        { value: "3months", label: "Within 3 months" },
        { value: "6months", label: "6+ months" },
        { value: "exploring", label: "Just exploring" },
      ],
    },
    {
      name: "message",
      label: "Anything else we should know",
      type: "textarea",
      required: false,
    },
  ],
};

// ─── FORM ─────────────────────────────────────────────────────────────────────

export const DEMO_FORM = {
  submitLabel: "Request my demo",
  successMessage: "Done. Expect a calendar invite within 2 hours.",
  fields: [
    { name: "fullName", label: "Full Name", type: "text", required: true },
    { name: "email", label: "Work Email", type: "email", required: true },
    { name: "institution", label: "Institution Name", type: "text", required: true },
    {
      name: "role",
      label: "Your Role",
      type: "select",
      required: true,
      options: [
        { value: "principal", label: "Principal / Director" },
        { value: "registrar", label: "Registrar / VC Office" },
        { value: "operations", label: "Operations Head" },
        { value: "admissions", label: "Admissions Leader" },
        { value: "cio", label: "CIO / IT Head" },
        { value: "other", label: "Other" },
      ],
    },
    {
      name: "students",
      label: "Student Count",
      type: "select",
      required: false,
      options: [
        { value: "under500", label: "Under 500" },
        { value: "500-2000", label: "500 – 2,000" },
        { value: "2000-10000", label: "2,000 – 10,000" },
        { value: "over10000", label: "10,000+" },
      ],
    },
  ],
};
