import Link from "next/link";
import { FadeIn } from "./FadeIn";
import { FOOTER_CTA, FOOTER_LINKS, COMPANY } from "@/lib/landing-data";
import { NucleusWordmark } from "@/components/nucleus-wordmark";

export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-background">
      {/* ── Final CTA band ──────────────────────────────── */}
      <div className="bg-mesh border-b border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          <FadeIn>
            <h2
              className="font-display font-bold text-foreground tracking-tight mb-4"
              style={{ fontSize: "clamp(2rem, 4vw, 3.2rem)" }}
            >
              {FOOTER_CTA.headline}
            </h2>
            <p className="text-muted-foreground mb-8 text-lg">{FOOTER_CTA.subhead}</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-5">
              <Link
                href={FOOTER_CTA.primaryCTA.href}
                className="inline-flex h-12 items-center justify-center rounded-xl bg-primary px-8 text-sm font-semibold text-primary-foreground shadow-[0_2px_20px_-4px_rgba(79,70,229,0.4)] hover:opacity-90 transition-opacity"
              >
                {FOOTER_CTA.primaryCTA.label}
              </Link>
              <Link
                href={FOOTER_CTA.secondaryCTA.href}
                className="inline-flex h-12 items-center justify-center rounded-xl border border-border px-8 text-sm font-semibold text-foreground hover:bg-accent transition-colors"
              >
                {FOOTER_CTA.secondaryCTA.label}
              </Link>
            </div>
            <p className="text-xs text-muted-foreground">{FOOTER_CTA.trustLine}</p>
          </FadeIn>
        </div>
      </div>

      {/* ── Footer content ────────────────────────────────── */}
      <div className="container-wide py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="inline-block mb-3">
              <NucleusWordmark decorative />
            </Link>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-[180px]">
              The operating layer for Indian higher education.
            </p>
          </div>

          {FOOTER_LINKS.map((col) => (
            <div key={col.heading}>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
                {col.heading}
              </p>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {COMPANY.legalName}. All rights reserved.
          </p>
          <a
            href={`mailto:${COMPANY.email}`}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {COMPANY.email}
          </a>
        </div>
      </div>
    </footer>
  );
}
