"use client";

import { useState } from "react";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Check, Phone } from "lucide-react";

type FormData = Record<string, string>;

const roles = [
  "Principal / Director",
  "Registrar / VC Office",
  "Operations Head",
  "Finance / Accounts Head",
  "CIO / IT Head",
  "Admissions Leader",
  "Other",
];

const phones = [
  { display: "+91 84894 31508", number: "+918489431508" },
  { display: "+91 80561 01540", number: "+918056101540" },
  { display: "+91 99943 56787", number: "+919994356787" },
];

export function CTA() {
  const [form, setForm] = useState<FormData>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validated, setValidated] = useState(false);

  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidated(true);
    if (!form.institution || !form.name || !form.role || !form.email) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("submit_failed");
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Email us at info@thenucleus.in or call us directly.");
    } finally {
      setSubmitting(false);
    }
  };

  const fieldInvalid = (name: string) =>
    validated && !form[name] ? ("true" as const) : undefined;

  return (
    <section id="contact" className="section-dark py-24 md:py-36 bg-mesh-dark">
      <div className="container-tight">
        <motion.div
          ref={ref}
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          <p className="eyebrow text-indigo-400">Book a Discovery Call</p>
          <h2
            className="font-display font-bold text-white tracking-tight mb-4"
            style={{ fontSize: "clamp(2rem, 4vw, 3.2rem)" }}
          >
            See what your institution is missing.
          </h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Book a 30-minute discovery call. We&apos;ll show you insights from your own data —
            no commitment, no setup fee for the pilot.
          </p>

          {/* Contact details */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-5">
            <a
              href="mailto:info@thenucleus.in"
              className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              info@thenucleus.in
            </a>
            {phones.map((p) => (
              <a
                key={p.number}
                href={`tel:${p.number}`}
                className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
              >
                <Phone className="w-3 h-3" />
                {p.display}
              </a>
            ))}
          </div>
        </motion.div>

        <motion.div
          className="max-w-xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ delay: 0.15, duration: 0.6 }}
        >
          {submitted ? (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-10 text-center">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10 border border-green-500/20 mb-5">
                <Check className="w-7 h-7 text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">You&apos;re on our list.</h3>
              <p className="text-slate-400">
                Expect a calendar invite within 2 business hours.
                <br />
                We&apos;ll come prepared with insights specific to your institution type.
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              noValidate
              className="bg-white/5 border border-white/10 rounded-2xl p-7 backdrop-blur space-y-4"
            >
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-300">
                    Institution Name <span className="text-indigo-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="institution"
                    required
                    aria-invalid={fieldInvalid("institution")}
                    value={form.institution ?? ""}
                    onChange={handleChange}
                    placeholder="e.g. Manipal University"
                    className="w-full h-10 rounded-lg bg-white/8 border border-white/15 px-3 text-sm text-white placeholder:text-slate-500"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-300">
                    Your Name <span className="text-indigo-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    aria-invalid={fieldInvalid("name")}
                    value={form.name ?? ""}
                    onChange={handleChange}
                    className="w-full h-10 rounded-lg bg-white/8 border border-white/15 px-3 text-sm text-white placeholder:text-slate-500"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-300">
                    Your Role <span className="text-indigo-400">*</span>
                  </label>
                  <select
                    name="role"
                    required
                    aria-invalid={fieldInvalid("role")}
                    value={form.role ?? ""}
                    onChange={handleChange}
                    className="w-full h-10 rounded-lg bg-white/8 border border-white/15 px-3 text-sm text-white"
                  >
                    <option value="" className="bg-[#0D1021]">Select role…</option>
                    {roles.map((r) => (
                      <option key={r} value={r} className="bg-[#0D1021]">{r}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-300">
                    Work Email <span className="text-indigo-400">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    aria-invalid={fieldInvalid("email")}
                    value={form.email ?? ""}
                    onChange={handleChange}
                    className="w-full h-10 rounded-lg bg-white/8 border border-white/15 px-3 text-sm text-white placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-300">
                  Phone <span className="text-slate-500">(optional)</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={form.phone ?? ""}
                  onChange={handleChange}
                  placeholder="+91 98765 43210"
                  className="w-full h-10 rounded-lg bg-white/8 border border-white/15 px-3 text-sm text-white placeholder:text-slate-500"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-300">
                  Biggest operational challenge{" "}
                  <span className="text-slate-500">(optional)</span>
                </label>
                <textarea
                  name="challenge"
                  value={form.challenge ?? ""}
                  onChange={handleChange}
                  rows={3}
                  placeholder="e.g. We can't tell which students are at risk until it's too late…"
                  className="w-full rounded-lg bg-white/8 border border-white/15 px-3 py-2 text-sm text-white placeholder:text-slate-500 resize-none"
                />
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-900/20 border border-red-500/20 rounded-lg px-4 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-12 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {submitting ? "Sending…" : "Book Discovery Call"}
              </button>

              <p className="text-center text-xs text-slate-500">
                Or email us at{" "}
                <a
                  href="mailto:info@thenucleus.in"
                  className="text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  info@thenucleus.in
                </a>
              </p>
            </form>
          )}
        </motion.div>
      </div>
    </section>
  );
}
