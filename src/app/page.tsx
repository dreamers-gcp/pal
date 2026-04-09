import Link from "next/link";
import { Shield, GraduationCap, BookOpen } from "lucide-react";
import { PlanovaWordmark } from "@/components/planova-wordmark";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-[rgba(0,0,0,0.06)] bg-white">
        <div className="mx-auto flex h-16 max-w-[1100px] items-center justify-between px-[clamp(1.5rem,5vw,4rem)]">
          <Link
            href="/"
            aria-label="Planova home"
            className="flex shrink-0 items-center gap-2 no-underline text-foreground"
          >
            <PlanovaWordmark decorative size="lg" />
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
        <section className="grid items-center gap-12 py-20 lg:grid-cols-2 lg:gap-16 lg:py-24">
          <div>
            <h1
              className="font-display mb-6 max-w-xl leading-[1.08] tracking-tight text-foreground"
              style={{
                fontSize: "clamp(2.5rem, 5vw, 4.5rem)",
              }}
            >
              From slot request to approval — in seconds.
            </h1>
            <p className="mb-10 max-w-lg text-[17px] leading-relaxed text-muted-foreground">
              Planova connects Professors, Admins, and Students in one seamless
              scheduling loop. Built for colleges.
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
            <div
              className="w-full max-w-[520px] rounded-xl border border-foreground/10 bg-card p-3 shadow-[0_24px_64px_-12px_rgba(26,26,46,0.18)]"
              style={{ transform: "rotate(2.5deg)" }}
            >
              <div className="mb-3 flex items-center gap-2 border-b border-foreground/8 pb-3">
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                </div>
                <div className="ml-2 flex-1 rounded-md bg-muted px-3 py-1.5 text-center text-xs text-muted-foreground">
                  app.planova.edu / calendar
                </div>
              </div>
              <div className="relative overflow-hidden rounded-lg border border-foreground/8 bg-background p-4">
                <div
                  className="absolute right-3 top-3 z-10 rounded-full border border-foreground/10 bg-card px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-foreground/80 shadow-sm"
                  title="Admin view"
                >
                  Pending Approvals
                  <span className="ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-foreground px-1 text-[9px] text-background">
                    3
                  </span>
                </div>
                <div className="flex gap-3">
                  <aside className="hidden w-[132px] shrink-0 rounded-lg border border-foreground/10 bg-card p-2.5 sm:block">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      My Schedule
                    </p>
                    <p className="text-[11px] font-medium text-foreground">
                      Dr. Rao
                    </p>
                    <p className="mb-2 text-[10px] text-muted-foreground">
                      Computer Science
                    </p>
                    <ul className="space-y-1.5 text-[10px] text-foreground/70">
                      <li className="rounded border border-foreground/8 bg-background px-1.5 py-1">
                        Data Structures · Mon 10:00
                      </li>
                      <li className="rounded border border-foreground/8 bg-background px-1.5 py-1">
                        Lab B · Wed 14:00
                      </li>
                    </ul>
                  </aside>
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">
                        Week of Apr 7
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Professor view
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-1 text-[9px]">
                      {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => (
                        <div
                          key={d}
                          className="rounded-t border border-b-0 border-foreground/10 bg-card py-1 text-center font-medium text-muted-foreground"
                        >
                          {d}
                        </div>
                      ))}
                      {Array.from({ length: 15 }).map((_, i) => {
                        const col = i % 5;
                        const row = Math.floor(i / 5);
                        const isEvent =
                          (col === 0 && row === 1) ||
                          (col === 2 && row === 0) ||
                          (col === 4 && row === 2);
                        return (
                          <div
                            key={i}
                            className={`min-h-[28px] border border-foreground/8 bg-card ${
                              col === 0 ? "rounded-bl" : ""
                            } ${col === 4 ? "rounded-br" : ""}`}
                          >
                            {isEvent ? (
                              <div className="m-0.5 rounded bg-foreground px-1 py-0.5 text-[8px] font-medium leading-tight text-background">
                                {col === 0
                                  ? "CS-201"
                                  : col === 2
                                    ? "Review"
                                    : "Office hrs"}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
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
            One loop for your whole campus
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
        <p>Planova — college calendar management</p>
      </footer>
    </div>
  );
}
