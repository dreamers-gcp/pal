"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { ProfessorDashboard } from "@/components/dashboards/professor-dashboard";
import { AdminDashboard } from "@/components/dashboards/admin-dashboard";
import { StudentDashboard } from "@/components/dashboards/student-dashboard";
import { AppLoadingState } from "@/components/ui/app-loading-state";

export default function DashboardPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !profile) {
      router.replace("/login");
    }
  }, [loading, profile, router]);

  if (loading) {
    return <AppLoadingState title="Loading dashboard" subtitle="Fetching your latest classes and requests..." />;
  }

  if (!profile) {
    return <AppLoadingState title="Finishing sign-in" subtitle="Redirecting you to login..." />;
  }

  switch (profile.role) {
    case "professor":
      return <ProfessorDashboard profile={profile} />;
    case "admin":
      return <AdminDashboard profile={profile} />;
    case "student":
      return <StudentDashboard profile={profile} />;
    default:
      return <p>Unknown role</p>;
  }
}
