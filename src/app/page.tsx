import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { Shield, GraduationCap, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-teal-50">
      <header className="container mx-auto flex items-center justify-between px-4 py-6">
        <div className="flex items-center gap-2">
          <img
            src="/planova-logo.png"
            alt="Planova"
            className="h-9 w-auto select-none"
            draggable={false}
          />
        </div>
        <div className="flex gap-3">
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "ghost" }))}
          >
            Sign In
          </Link>
          <Link href="/signup" className={cn(buttonVariants())}>
            Get Started
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4">
        <section className="py-20 text-center max-w-3xl mx-auto">
          <h1 className="text-5xl font-bold tracking-tight mb-6">
            Calendar Management,{" "}
            <span className="text-primary">Simplified</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Planova connects Professors, Admins, and Learners. Professors
            request time slots, Admins approve them, and Students see their
            upcoming schedule — all in one place.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/signup"
              className={cn(buttonVariants({ size: "lg" }))}
            >
              Create Account
            </Link>
            <Link
              href="/login"
              className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
            >
              Sign In
            </Link>
          </div>
        </section>

        <section className="py-16 grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="text-center p-8 rounded-2xl bg-white shadow-sm border">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <BookOpen className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Professors</h3>
            <p className="text-muted-foreground">
              Request calendar blocks for student groups and classrooms. Track
              approval status in real time.
            </p>
          </div>
          <div className="text-center p-8 rounded-2xl bg-white shadow-sm border">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/15">
              <Shield className="h-7 w-7 text-accent-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Admins</h3>
            <p className="text-muted-foreground">
              Review incoming requests. Approve, reject, or ask for
              clarification with a single click.
            </p>
          </div>
          <div className="text-center p-8 rounded-2xl bg-white shadow-sm border">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
              <GraduationCap className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Students</h3>
            <p className="text-muted-foreground">
              See only your group&apos;s approved events. Never miss a class,
              lecture, or lab session.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <p>Planova — Professor Admin Learner Platform</p>
      </footer>
    </div>
  );
}
