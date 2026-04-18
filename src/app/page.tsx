import Link from "next/link";
import { Shield, GraduationCap, BookOpen } from "lucide-react";
import { LandingCalendarMock } from "@/components/landing-calendar-mock";
import { LandingPageBackdrop } from "@/components/landing-page-backdrop";
import {
  NucleusHeroOrbitAmbient,
  NucleusHubMark,
  NucleusWordmark,
} from "@/components/nucleus-wordmark";

export default function Home() {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <LandingPageBackdrop />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[var(--nucleus-mist)]/40 via-background/90 to-background dark:from-[var(--nucleus-deep)]/35 dark:via-background/88 dark:to-background"
        aria-hidden
      />
      <div className="relative z-10 min-h-screen">
      <header className="border-b border-[rgba(0,0,0,0.06)] bg-white/90 backdrop-blur-sm dark:bg-card/90">
        <div className="mx-auto flex h-16 max-w-[1100px] items-center justify-between px-[clamp(1.5rem,5vw,4rem)]">
          <Link
            href="/"
            aria-label="The Nucleus home"
            className="flex shrink-0 items-center gap-2 no-underline text-foreground"
          >
            <NucleusWordmark decorative size="lg" />
          </Link>
          <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Get Early Access
          </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-4">
        <section className="relative grid items-center gap-12 py-20 lg:grid-cols-2 lg:gap-16 lg:py-24">
          <div>
            <h1
              className="font-display mb-6 max-w-xl leading-[1.08] tracking-tight text-foreground"
              style={{
                fontSize: "clamp(2.5rem, 5vw, 4.5rem)",
              }}
            >
              The calm center where every campus orbit meets.
            </h1>
            <p className="mb-10 max-w-lg text-[17px] leading-relaxed text-muted-foreground">
              From slot request to approval in seconds. Professors, admins, and students
              share the same loop—so schedules stay true, rooms stay fair, and nobody is
              left circling outside the conversation.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="inline-flex h-12 items-center justify-center rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Get Early Access
              </Link>
              <Link
                href="#how-it-works"
                className="inline-flex h-12 items-center justify-center rounded-lg border border-foreground/20 bg-transparent px-6 text-sm font-semibold text-foreground transition-colors hover:border-foreground/35 hover:bg-foreground/[0.04]"
              >
                See How It Works
              </Link>
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <div className="relative w-full max-w-[520px]">
              <div
                className="relative w-full rounded-xl border border-foreground/10 bg-card/95 p-3 shadow-[0_24px_64px_-12px_rgba(26,26,46,0.18)] ring-1 ring-[var(--nucleus-orbit)] backdrop-blur-[2px] dark:bg-card/90 dark:shadow-[0_24px_64px_-12px_rgba(0,0,0,0.45)]"
                style={{ transform: "rotate(2.5deg)" }}
              >
              <div className="mb-3 flex items-center gap-2 border-b border-foreground/8 pb-3">
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                </div>
                <div className="ml-2 flex-1 rounded-md bg-muted px-3 py-1.5 text-center text-xs text-muted-foreground">
                  thenucleus.in/calendar
                </div>
              </div>
              <div className="bg-background p-2 sm:p-3">
                <LandingCalendarMock />
              </div>
            </div>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="why-nucleus"
          className="rounded-3xl border border-primary/15 bg-gradient-to-b from-primary/8 via-[var(--nucleus-mist)]/30 to-background px-6 py-16 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6)] dark:from-primary/10 dark:via-[var(--nucleus-deep)]/25 dark:shadow-none md:px-10 md:py-20"
        >
          <div className="mx-auto max-w-2xl text-center">
            <h2
              id="why-nucleus"
              className="font-display text-[clamp(1.35rem,3vw,1.85rem)] leading-tight text-foreground"
            >
              Why &ldquo;The Nucleus&rdquo;?
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-[17px]">
              In biology, the nucleus holds the blueprint—everything else in the cell is
              organized around it. We built the same idea for your college: one trusted
              center where timetables, approvals, and attendance stay in sync, so your
              campus doesn&apos;t spin on conflicting copies of the truth.
            </p>
            <div className="mt-10 flex justify-center">
              <div className="relative">
                <div
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-primary/20"
                  style={{ width: "min(18rem, 70vw)", height: "min(18rem, 70vw)" }}
                  aria-hidden
                />
                <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 px-8 py-6 shadow-[0_20px_60px_-24px_var(--nucleus-glow)] backdrop-blur-sm dark:to-primary/10">
                  <div
                    className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 opacity-[0.22]"
                    aria-hidden
                  >
                    <NucleusHeroOrbitAmbient />
                  </div>
                  <div className="relative flex flex-col items-center gap-2">
                    <NucleusHubMark size={56} className="drop-shadow-[0_0_16px_var(--nucleus-glow)]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          className="border-t border-foreground/10 py-24 md:py-28"
        >
          <h2 className="font-display mb-12 text-center text-[clamp(1.75rem,3vw,2.25rem)] leading-tight text-foreground">
            Three roles, one shared orbit
          </h2>
          <div className="grid gap-8 md:grid-cols-3 md:gap-10">
            <div className="rounded-2xl border border-foreground/10 bg-card p-8 shadow-sm">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-foreground/10 bg-background md:mx-0">
                <BookOpen className="h-7 w-7 text-foreground/70" />
              </div>
              <h3 className="mb-2 text-lg font-semibold tracking-tight text-foreground">
                Professors
              </h3>
              <p className="text-base leading-relaxed text-muted-foreground">
                Request calendar blocks for programs and classrooms. Track
                approval status in real time.
              </p>
            </div>
            <div className="rounded-2xl border border-foreground/10 bg-card p-8 shadow-sm">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-foreground/10 bg-background md:mx-0">
                <Shield className="h-7 w-7 text-foreground/70" />
              </div>
              <h3 className="mb-2 text-lg font-semibold tracking-tight text-foreground">
                Admins
              </h3>
              <p className="text-base leading-relaxed text-muted-foreground">
                Review incoming requests. Approve, reject, or ask for
                clarification with a single click.
              </p>
            </div>
            <div className="rounded-2xl border border-foreground/10 bg-card p-8 shadow-sm">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-foreground/10 bg-background md:mx-0">
                <GraduationCap className="h-7 w-7 text-foreground/70" />
              </div>
              <h3 className="mb-2 text-lg font-semibold tracking-tight text-foreground">
                Students
              </h3>
              <p className="text-base leading-relaxed text-muted-foreground">
                See only your group&apos;s approved events. Never miss a class,
                lecture, or lab session.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-foreground/10 py-10 text-center text-sm text-muted-foreground">
        <p className="mb-4">
          The Nucleus — the center of gravity for college scheduling and attendance
        </p>
        <nav
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2"
          aria-label="Legal"
        >
          <Link
            href="/terms"
            className="font-medium text-foreground/80 underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            Terms and Conditions
          </Link>
          <span className="hidden text-foreground/25 sm:inline" aria-hidden>
            |
          </span>
          <Link
            href="/privacy"
            className="font-medium text-foreground/80 underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            Privacy Policy
          </Link>
        </nav>
      </footer>
      </div>
    </div>
  );
}
