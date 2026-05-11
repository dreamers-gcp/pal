import Link from "next/link";
import { NucleusWordmark } from "@/components/nucleus-wordmark";

const phones = [
  { number: "+918489431508", display: "+91 84894 31508" },
  { number: "+918056101540", display: "+91 80561 01540" },
  { number: "+919994356787", display: "+91 99943 56787" },
];

export function Footer() {
  return (
    <footer className="section-dark border-t border-white/8">
      <div className="container-wide py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <div>
            <Link href="/" className="inline-block mb-2">
              <NucleusWordmark decorative variant="inverse" size="lg" />
            </Link>
            <p className="text-xs text-slate-500 leading-relaxed max-w-[200px]">
              The intelligence layer for Indian educational institutions.
            </p>
          </div>

          {/* Contact info */}
          <div>
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">Contact</p>
            <a
              href="mailto:info@thenucleus.in"
              className="text-sm text-slate-400 hover:text-white transition-colors block mb-2"
            >
              info@thenucleus.in
            </a>
            {phones.map((p) => (
              <a
                key={p.number}
                href={`tel:${p.number}`}
                className="text-sm text-slate-400 hover:text-white transition-colors block"
              >
                {p.display}
              </a>
            ))}
          </div>

          {/* Links */}
          <div>
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">Legal</p>
            <nav className="flex flex-col gap-2">
              <Link href="/privacy" className="text-sm text-slate-400 hover:text-white transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-sm text-slate-400 hover:text-white transition-colors">
                Terms of Service
              </Link>
              <Link href="#contact" className="text-sm text-slate-400 hover:text-white transition-colors">
                Contact Us
              </Link>
            </nav>
          </div>
        </div>

        <div className="border-t border-white/8 pt-5 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-slate-600 whitespace-nowrap">
            &copy; {new Date().getFullYear()} The Nucleus Education Tech. All rights reserved.
          </p>
          <a
            href="mailto:info@thenucleus.in"
            className="text-xs text-slate-500 hover:text-white transition-colors"
          >
            info@thenucleus.in
          </a>
        </div>
      </div>
    </footer>
  );
}
