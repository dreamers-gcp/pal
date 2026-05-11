"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import { NucleusWordmark } from "@/components/nucleus-wordmark";

const links = [
  { label: "How It Works", href: "#how-it-works" },
  { label: "Features", href: "#attendance" },
  { label: "Contact Us", href: "#contact" },
];

function scrollTo(href: string) {
  const id = href.replace("#", "");
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function Nav() {
  const [open, setOpen] = useState(false);
  const { scrollY } = useScroll();
  const bgOpacity = useTransform(scrollY, [0, 80], [0, 1]);
  const borderOpacity = useTransform(scrollY, [0, 80], [0, 1]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <motion.div
        className="absolute inset-0 bg-background/92 backdrop-blur-md"
        style={{ opacity: bgOpacity }}
      />
      <motion.div
        className="absolute inset-x-0 bottom-0 h-px bg-border"
        style={{ opacity: borderOpacity }}
      />

      <nav className="relative container-wide h-16 flex items-center justify-between">
        <Link href="/" aria-label="The Nucleus home">
          <NucleusWordmark decorative size="lg" />
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <button
              key={l.href}
              onClick={() => scrollTo(l.href)}
              className="text-sm font-medium text-foreground/80 hover:text-foreground border border-border/60 hover:border-border rounded-lg px-3 py-1.5 transition-colors"
            >
              {l.label}
            </button>
          ))}
        </div>

        <div className="hidden md:block">
          <button
            onClick={() => scrollTo("#contact")}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Book a Demo
          </button>
        </div>

        {/* Mobile */}
        <button
          className="md:hidden p-2 rounded-md text-foreground hover:bg-accent"
          onClick={() => setOpen(!open)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {open && (
        <div className="md:hidden absolute inset-x-0 top-16 bg-background border-t border-border px-4 py-6 flex flex-col gap-5 shadow-xl">
          {links.map((l) => (
            <button
              key={l.href}
              onClick={() => { scrollTo(l.href); setOpen(false); }}
              className="text-base font-medium text-foreground text-left"
            >
              {l.label}
            </button>
          ))}
          <button
            onClick={() => { scrollTo("#contact"); setOpen(false); }}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground"
          >
            Book a Demo
          </button>
        </div>
      )}
    </header>
  );
}
