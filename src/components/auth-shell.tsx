import Link from "next/link";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="shrink-0 border-b border-[rgba(0,0,0,0.06)] bg-white">
        <div className="mx-auto flex h-16 max-w-[1100px] items-center justify-between px-[clamp(1.5rem,5vw,4rem)]">
          <Link
            href="/"
            className="flex items-center gap-2 no-underline text-foreground transition-opacity hover:opacity-90"
          >
            <img
              src="/planova-logo.png"
              alt="Planova"
              height={32}
              className="m-0 block h-[32px] w-auto max-h-[32px] border-0 bg-transparent p-0 object-contain object-left select-none"
              style={{ display: "block", height: "32px", width: "auto" }}
              draggable={false}
            />
          </Link>
          <Link
            href="/"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Back to home
          </Link>
        </div>
      </header>
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        {children}
      </div>
    </div>
  );
}
