import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NucleusWordmark } from "@/components/nucleus-wordmark";
import { COMPANY } from "@/lib/landing-data";

export default function DpaPage() {
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
      <main className="container-tight py-24 max-w-2xl">
        <h1 className="font-display font-bold text-foreground mb-4" style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.5rem)" }}>
          Data Processing Agreement
        </h1>
        <p className="text-muted-foreground mb-6">
          The Nucleus processes student and institutional data on behalf of its customers. This page will contain the full DPA aligned with India&apos;s Digital Personal Data Protection Act (DPDP Act, 2023).
        </p>
        <p className="text-sm text-muted-foreground mb-8">
          The full DPA document is available to Enterprise plan customers. To request a copy or discuss data processing terms, contact us at{" "}
          <a href={`mailto:${COMPANY.email}`} className="text-primary hover:underline">{COMPANY.email}</a>.
        </p>
        <div className="bg-accent/30 border border-border rounded-xl p-6">
          <h2 className="text-sm font-semibold text-foreground mb-3">Key commitments</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Data hosted on AWS Mumbai (ap-south-1 region)</li>
            <li>• AES-256 encryption at rest, TLS 1.3 in transit</li>
            <li>• Consent-gated biometric and photo/video features</li>
            <li>• Configurable data retention periods</li>
            <li>• Full data export on contract termination</li>
            <li>• Aligned with DPDP Act 2023 obligations</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
