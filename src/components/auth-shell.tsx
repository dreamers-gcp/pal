import Link from "next/link";
import { NucleusWordmark } from "@/components/nucleus-wordmark";

interface AuthShellProps {
  children: React.ReactNode;
  /** Override the default "Back to home" link in the top-right corner. */
  headerActions?: React.ReactNode;
}

export function AuthShell({ children, headerActions }: AuthShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="shrink-0 border-b border-[rgba(0,0,0,0.06)] bg-white">
        <div className="mx-auto flex h-16 max-w-[1100px] items-center justify-between px-[clamp(1.5rem,5vw,4rem)]">
          <Link
            href="/"
            aria-label="The Nucleus home"
            className="flex items-center gap-2 no-underline text-foreground transition-opacity hover:opacity-90"
          >
            <NucleusWordmark decorative size="md" />
          </Link>
          {headerActions ?? (
            <Link
              href="/"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Back to home
            </Link>
          )}
        </div>
      </header>
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        {children}
      </div>
    </div>
  );
}
