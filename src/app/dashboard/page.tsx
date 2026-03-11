"use client";

import { useAuth } from "@/hooks/use-auth";
import { ProfessorDashboard } from "@/components/dashboards/professor-dashboard";
import { AdminDashboard } from "@/components/dashboards/admin-dashboard";
import { StudentDashboard } from "@/components/dashboards/student-dashboard";
import { Loader2 } from "lucide-react";

export default function DashboardPage() {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Unable to load profile. Please sign in again.</p>
      </div>
    );
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
