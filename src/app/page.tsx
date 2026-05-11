import { Nav }             from "@/components/landing/nav";
import { Hero }            from "@/components/landing/hero";
import { ProductNav }      from "@/components/landing/product-nav";
import { AttendanceIntel } from "@/components/landing/attendance-intel";
import { EvaluationIntel } from "@/components/landing/evaluation-intel";
import { StudentIntel }    from "@/components/landing/student-intel";
import { FinanceIntel }    from "@/components/landing/finance-intel";
import { Scheduling }      from "@/components/landing/scheduling";
import { Communication }   from "@/components/landing/communication";
import { ErpComplement }   from "@/components/landing/erp-complement";
import { Traction }        from "@/components/landing/traction";
import { CTA }             from "@/components/landing/cta";
import { Footer }          from "@/components/landing/footer";

export default function Home() {
  return (
    <div className="w-full bg-background text-foreground">
      <Nav />
      <main>
        <Hero />
        <ErpComplement />
        <ProductNav />
        <AttendanceIntel />
        <EvaluationIntel />
        <StudentIntel />
        <FinanceIntel />
        <Scheduling />
        <Communication />
        <Traction />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
