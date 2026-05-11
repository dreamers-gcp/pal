"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { NucleusName } from "@/components/nucleus-wordmark";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const slots = ["8–9", "9–10", "10–11", "11–12", "2–3", "3–4"];

type Cell = { subject: string; room: string; conflict?: boolean } | null;

const grid: Record<string, Cell> = {
  "Mon-8–9":   { subject: "Data Structures", room: "Lab 3" },
  "Mon-9–10":  { subject: "Maths II",        room: "A-101" },
  "Mon-11–12": { subject: "OS",              room: "A-101", conflict: true },
  "Tue-9–10":  { subject: "Networks",        room: "Lab 2" },
  "Tue-10–11": { subject: "Physics",         room: "B-202" },
  "Tue-11–12": { subject: "OS",              room: "A-101", conflict: true },
  "Wed-8–9":   { subject: "Algorithms",      room: "A-103" },
  "Wed-3–4":   { subject: "Project",         room: "Lab 1" },
  "Thu-10–11": { subject: "DBMS",            room: "Lab 1" },
  "Thu-2–3":   { subject: "Soft Skills",     room: "Audi" },
  "Fri-9–10":  { subject: "Ethics",          room: "A-103" },
};

export function Scheduling() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.25 });

  return (
    <section id="scheduling" className="section-md bg-card isolate overflow-hidden">
      <div className="container-tight">
        <motion.div
          ref={ref}
          className="text-center mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          <p className="eyebrow">Scheduling</p>
          <h2
            className="font-display font-bold text-foreground tracking-tight mb-3"
            style={{ fontSize: "clamp(1.9rem, 3.5vw, 2.8rem)" }}
          >
            Zero scheduling conflicts.
          </h2>
          <p className="text-muted-foreground text-lg max-w-lg mx-auto">
            Clash detection across programs, faculty, and rooms. One conflict-free view — flagged before anyone shows up.
          </p>
        </motion.div>

        {/* Timetable grid */}
        <motion.div
          className="overflow-x-auto rounded-2xl border border-border bg-background"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          <table className="w-full min-w-[540px] text-xs border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="p-2 text-left text-muted-foreground font-medium w-16">Time</th>
                {days.map((d) => (
                  <th key={d} className="p-2 text-center text-muted-foreground font-medium">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slots.map((slot, si) => (
                <tr key={slot} className={si < slots.length - 1 ? "border-b border-border/50" : ""}>
                  <td className="p-2 text-muted-foreground/60 font-mono text-[10px]">{slot}</td>
                  {days.map((day) => {
                    const cell = grid[`${day}-${slot}`];
                    return (
                      <td key={day} className="p-1">
                        {cell ? (
                          <div
                            className={`p-1.5 rounded-lg text-center leading-tight ${
                              cell.conflict
                                ? "bg-red-50 border border-red-200"
                                : "bg-primary/6 border border-primary/15"
                            }`}
                          >
                            <p className={`font-semibold text-[10px] ${cell.conflict ? "text-red-700" : "text-primary"}`}>
                              {cell.subject}
                            </p>
                            <p className={`text-[9px] ${cell.conflict ? "text-red-500" : "text-muted-foreground"}`}>
                              {cell.room}
                            </p>
                          </div>
                        ) : (
                          <div className="p-1.5" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>

        {/* Conflict callout */}
        <motion.div
          className="mt-4 flex items-center gap-3 p-4 rounded-xl border border-red-200 bg-red-50"
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          transition={{ delay: 0.45, duration: 0.5 }}
        >
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">
            <span className="font-semibold">Room A-101 double-booked</span> — Mon 11–12 and Tue 11–12.
            <NucleusName /> flagged this conflict before the timetable was published.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
