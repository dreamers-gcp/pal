import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NucleusWordmark } from "@/components/nucleus-wordmark";
import { COMPANY } from "@/lib/landing-data";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="container-wide h-16 flex items-center justify-between">
          <Link href="/"><NucleusWordmark decorative /></Link>
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />Back to home
          </Link>
        </div>
      </header>
      <main className="container-tight py-24 text-center">
        <h1 className="font-display font-bold text-foreground mb-4" style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}>
          About The Nucleus
        </h1>
        <p className="text-muted-foreground text-lg max-w-lg mx-auto mb-8">
          We&apos;re building the operating layer for Indian higher education. More details coming soon.
        </p>
        <a href={`mailto:${COMPANY.email}`} className="text-primary hover:underline text-sm">{COMPANY.email}</a>
      </main>
    </div>
  );
}
