"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Bell, CalendarDays, Users } from "lucide-react";

const notifications = [
  {
    icon: Bell,
    color: "amber",
    title: "Fee Reminder",
    body: "₹45,000 due in 3 days — 12 students not yet paid. Auto-reminder sent to student & parent.",
    time: "Just now",
    colorClasses: "bg-amber-50 border-amber-200 text-amber-700",
    iconBg: "bg-amber-100",
  },
  {
    icon: CalendarDays,
    color: "blue",
    title: "Exam Schedule Published",
    body: "Mid-terms: Mon 3 Mar 2025, 9:00 AM — Sem 4 CSE. 186 students notified via app.",
    time: "2 min ago",
    colorClasses: "bg-blue-50 border-blue-200 text-blue-700",
    iconBg: "bg-blue-100",
  },
  {
    icon: Users,
    color: "green",
    title: "Faculty Coordination",
    body: "Dept. meeting rescheduled to Fri 2 PM — Room 201 reassigned. 14 faculty confirmed.",
    time: "5 min ago",
    colorClasses: "bg-green-50 border-green-200 text-green-700",
    iconBg: "bg-green-100",
  },
];

export function Communication() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.25 });

  return (
    <section id="communication" className="section-md bg-background isolate overflow-hidden">
      <div className="container-tight">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          {/* Text */}
          <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.6 }}
          >
            <p className="eyebrow">Communication</p>
            <h2
              className="font-display font-bold text-foreground tracking-tight mb-4"
              style={{ fontSize: "clamp(1.9rem, 3.5vw, 2.8rem)" }}
            >
              Every stakeholder,
              <br />
              one channel.
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Parent notifications, student announcements, faculty coordination —
              automated, tracked, and auditable. The right message reaches the right person at the right time.
            </p>
            <ul className="space-y-3">
              {[
                "Automated fee reminders to students and parents",
                "Exam and schedule notifications at scale",
                "Faculty coordination and room change alerts",
                "Delivery receipts and read confirmations",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <span className="mt-1 h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Notification stack */}
          <div className="space-y-3">
            {notifications.map((n, i) => {
              const Icon = n.icon;
              return (
                <motion.div
                  key={n.title}
                  className={`flex items-start gap-3 p-4 rounded-2xl border ${n.colorClasses}`}
                  initial={{ opacity: 0, x: 24 }}
                  animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: 24 }}
                  transition={{ delay: 0.2 + i * 0.12, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className={`h-12 w-12 rounded-xl ${n.iconBg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-6 h-6" style={{ color: "currentColor" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className="text-xs font-bold">{n.title}</p>
                      <span className="text-[10px] opacity-60 flex-shrink-0">{n.time}</span>
                    </div>
                    <p className="text-xs leading-relaxed opacity-80">{n.body}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
