import type { Metadata } from "next";
import { Nav } from "@/components/landing/nav";
import { Footer } from "@/components/landing/footer";
import { PlacementsHero } from "@/components/landing/placements/hero";
import { PlacementsProblem } from "@/components/landing/placements/problem";
import { PlacementsFeatures } from "@/components/landing/placements/features";
import { PlacementsIntelligence } from "@/components/landing/placements/intelligence-connection";
import { PlacementsCTA } from "@/components/landing/placements/cta";

export const metadata: Metadata = {
  title: "The Nucleus for Placements — Recruiter CRM for Campus Placement Teams",
  description:
    "One workspace for your placement team — shared mail, AI contact extraction, recruiter CRM, outbound calls, calendar, and multi-channel broadcasting. Currently deployed at XLRI Jamshedpur & Delhi.",
};

export default function PlacementsPage() {
  return (
    <div className="w-full bg-background text-foreground">
      <Nav />
      <main>
        <PlacementsHero />
        <PlacementsProblem />
        <PlacementsFeatures />
        <PlacementsIntelligence />
        <PlacementsCTA />
      </main>
      <Footer />
    </div>
  );
}
