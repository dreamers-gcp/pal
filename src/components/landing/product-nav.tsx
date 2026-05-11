"use client";

import { useState, useEffect } from "react";

const features = [
  { label: "Attendance",          anchor: "#attendance" },
  { label: "Evaluation",          anchor: "#evaluation" },
  { label: "Student Analytics",   anchor: "#student-intel" },
  { label: "Financial Analytics", anchor: "#finance-intel" },
  { label: "Scheduling",          anchor: "#scheduling" },
  { label: "Communication",       anchor: "#communication" },
];

export function ProductNav() {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    features.forEach((f) => {
      const el = document.querySelector(f.anchor);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActive(f.anchor); },
        { rootMargin: "-25% 0px -65% 0px", threshold: 0 }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  return (
    <nav className="sticky top-16 z-40 bg-background/90 backdrop-blur-lg border-b border-border py-2.5">
      <div className="container-tight flex gap-1 overflow-x-auto scrollbar-hide">
        {features.map((f) => (
          <a
            key={f.anchor}
            href={f.anchor}
            className={`px-4 py-1.5 text-sm font-medium whitespace-nowrap rounded-full transition-colors flex-shrink-0 ${
              active === f.anchor
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            onClick={(e) => {
              e.preventDefault();
              document.querySelector(f.anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            {f.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
