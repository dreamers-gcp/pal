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
      <main className="mx-auto max-w-[1100px] px-4 py-8 md:py-10">{children}</main>
      <Toaster />
    </div>
  );
}
