"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ArrowLeft } from "lucide-react";
import { PRICING, PRICING_FORM, COMPANY } from "@/lib/landing-data";
import { NucleusWordmark } from "@/components/nucleus-wordmark";

function PricingTierCard({
  tier,
  onSelect,
}: {
  tier: (typeof PRICING.tiers)[0];
  onSelect: (name: string) => void;
}) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-7 transition-all duration-200 ${
        tier.highlight
          ? "border-primary bg-primary text-primary-foreground shadow-[0_8px_40px_-12px_rgba(1,110,117,0.4)]"
          : "border-border bg-card hover:border-primary/30 hover:shadow-md"
      }`}
    >
      {tier.highlight && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary-foreground text-primary text-[10px] font-bold uppercase tracking-widest">
            Most Popular
          </span>
        </div>
      )}

      <div className="mb-6">
        <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${tier.highlight ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          {tier.name}
        </p>
        <p className={`text-sm mb-4 ${tier.highlight ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
          {tier.tagline}
        </p>
        <p className={`text-2xl font-bold ${tier.highlight ? "text-primary-foreground" : "text-foreground"}`}>
          {tier.priceNote}
        </p>
        <p className={`text-xs mt-1 ${tier.highlight ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          {tier.modules} · {tier.students}
        </p>
      </div>

      <ul className="space-y-2.5 flex-1 mb-8">
        {tier.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm">
            <Check
              className={`w-4 h-4 mt-0.5 flex-shrink-0 ${tier.highlight ? "text-primary-foreground" : "text-primary"}`}
            />
            <span className={tier.highlight ? "text-primary-foreground/90" : "text-foreground"}>
              {f}
            </span>
          </li>
        ))}
      </ul>

      <button
        onClick={() => onSelect(tier.name)}
        className={`w-full h-11 rounded-xl text-sm font-semibold transition-all ${
          tier.highlight
            ? "bg-primary-foreground text-primary hover:opacity-90"
            : "bg-primary text-primary-foreground hover:opacity-90"
        }`}
      >
        {tier.cta}
      </button>
    </div>
  );
}

type FormData = Record<string, string>;

function PricingEnquiryForm({ selectedTier }: { selectedTier: string }) {
  const [formData, setFormData] = useState<FormData>({ tier: selectedTier.toLowerCase() });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/pricing-enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Submission failed");
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
          <Check className="w-6 h-6 text-primary" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          {PRICING_FORM.successMessage}
        </h3>
        <p className="text-sm text-muted-foreground">
          We&apos;ll reach out to{" "}
          <span className="text-foreground font-medium">{formData.email}</span>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        {PRICING_FORM.fields.map((field) => {
          if (field.type === "select") {
            return (
              <div key={field.name} className={field.name === "message" ? "sm:col-span-2" : ""}>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  {field.label}
                  {field.required && <span className="text-primary ml-0.5">*</span>}
                </label>
                <select
                  name={field.name}
                  required={field.required}
                  value={formData[field.name] ?? ""}
                  onChange={handleChange}
                  className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Select…</option>
                  {"options" in field &&
                    field.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                </select>
              </div>
            );
          }

          if (field.type === "textarea") {
            return (
              <div key={field.name} className="sm:col-span-2">
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  {field.label}
                </label>
                <textarea
                  name={field.name}
                  value={formData[field.name] ?? ""}
                  onChange={handleChange}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
            );
          }

          return (
            <div key={field.name}>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                {field.label}
                {field.required && <span className="text-primary ml-0.5">*</span>}
              </label>
              <input
                type={field.type}
                name={field.name}
                required={field.required}
                value={formData[field.name] ?? ""}
                onChange={handleChange}
                className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          );
        })}
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-2">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {submitting ? "Sending…" : PRICING_FORM.submitLabel}
      </button>
    </form>
  );
}

export default function PricingPage() {
  const [selectedTier, setSelectedTier] = useState("Growth");
  const [showForm, setShowForm] = useState(false);

  const handleTierSelect = (name: string) => {
    setSelectedTier(name);
    setShowForm(true);
    setTimeout(() => {
      document.getElementById("enquiry-form")?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="border-b border-border bg-background/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="container-wide h-16 flex items-center justify-between">
          <Link href="/">
            <NucleusWordmark decorative />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>
        </div>
      </header>

      <main className="container-tight py-20">
        {/* Header */}
        <div className="text-center mb-16">
          <h1
            className="font-display font-bold text-foreground tracking-tight mb-4"
            style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
          >
            {PRICING.headline}
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">{PRICING.subhead}</p>
        </div>

        {/* Tier cards */}
        <div className="grid md:grid-cols-3 gap-5 mb-6">
          {PRICING.tiers.map((tier) => (
            <PricingTierCard key={tier.name} tier={tier} onSelect={handleTierSelect} />
          ))}
        </div>

        {/* Fine print */}
        <p className="text-center text-xs text-muted-foreground mb-16">{PRICING.note}</p>

        {/* Enquiry form */}
        <div
          id="enquiry-form"
          className={`max-w-2xl mx-auto transition-all duration-300 ${showForm ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        >
          <div className="bg-card border border-border rounded-2xl p-8">
            <h2 className="text-lg font-semibold text-foreground mb-1">
              Get a quote for {selectedTier}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Tell us about your institution and we&apos;ll put together a proposal within one business day.
            </p>
            <PricingEnquiryForm selectedTier={selectedTier} />
          </div>
        </div>

        {/* Show form CTA if hidden */}
        {!showForm && (
          <div className="text-center mt-8">
            <p className="text-sm text-muted-foreground mb-3">Not sure which plan fits? Tell us about your institution.</p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-border px-6 text-sm font-semibold text-foreground hover:bg-accent transition-colors"
            >
              Get a custom quote
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container-wide flex flex-col sm:flex-row items-center justify-between gap-2">
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
      </footer>
    </div>
  );
}
