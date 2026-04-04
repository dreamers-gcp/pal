import { Navbar } from "@/components/navbar";
import { Toaster } from "@/components/ui/sonner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto w-full min-w-0 max-w-[1100px] overflow-x-hidden px-3 py-6 sm:px-4 sm:py-8 md:py-10">
        {children}
      </main>
      <Toaster />
    </div>
  );
}
