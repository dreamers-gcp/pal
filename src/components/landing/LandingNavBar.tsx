"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Menu, X, Sun, Moon } from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useTheme } from "next-themes";
import { NAV_ITEMS, COMPANY } from "@/lib/landing-data";
import { NucleusWordmark } from "@/components/nucleus-wordmark";

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="w-8 h-8" />;

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}

export function LandingNavBar() {
  const [open, setOpen] = useState(false);
  const { scrollY } = useScroll();
  const borderOpacity = useTransform(scrollY, [0, 60], [0, 1]);

  return (
    <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur-md">
      <motion.div
        className="absolute inset-x-0 bottom-0 h-px bg-border"
        style={{ opacity: borderOpacity }}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" aria-label="The Nucleus home">
          <NucleusWordmark decorative size="lg" />
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-7">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-2">
          <ThemeToggle />
          <Link
            href={COMPANY.demoLink}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Book a Demo
          </Link>
        </div>

        {/* Mobile toggle */}
        <div className="md:hidden flex items-center gap-1">
          <ThemeToggle />
          <button
            className="p-2 rounded-md text-foreground hover:bg-accent"
            onClick={() => setOpen(!open)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-border bg-background px-4 py-4 flex flex-col gap-4">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-foreground"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href={COMPANY.demoLink}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity w-full"
            onClick={() => setOpen(false)}
          >
            Book a Demo
          </Link>
        </div>
      )}
    </nav>
  );
}
