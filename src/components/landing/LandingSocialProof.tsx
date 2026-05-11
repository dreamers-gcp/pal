import { SOCIAL_PROOF } from "@/lib/landing-data";

export function LandingSocialProof() {
  return (
    <div className="border-y border-border bg-muted/40 py-5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-center gap-6 text-center">
        <p className="text-sm text-muted-foreground">{SOCIAL_PROOF.line}</p>
        {SOCIAL_PROOF.logos.length > 0 && (
          <div className="flex items-center gap-6">
            {SOCIAL_PROOF.logos.map((logo, i) => (
              <span key={i} className="text-xs text-muted-foreground font-medium px-3 py-1 border border-border rounded-md bg-background">
                {logo}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
