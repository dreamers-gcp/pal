"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { FaceRegistration } from "@/components/face-registration";
import { AppLoadingState } from "@/components/ui/app-loading-state";
import { AuthShell } from "@/components/auth-shell";

export default function FaceRegistrationPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!profile || profile.role !== "student") {
      router.replace("/dashboard");
      return;
    }
    if (profile.face_registered) {
      router.replace("/dashboard");
    }
  }, [loading, profile, router]);

  if (loading || !profile) {
    return (
      <AuthShell>
        <AppLoadingState
          title="Almost there"
          subtitle="Checking your account before face setup..."
        />
      </AuthShell>
    );
  }

  if (profile.role !== "student" || profile.face_registered) {
    return null;
  }

  return (
    <AuthShell>
      <div className="w-full max-w-xl">
        <FaceRegistration
          studentId={profile.id}
          onRegistrationComplete={() => {
            router.replace("/dashboard");
          }}
        />
      </div>
    </AuthShell>
  );
}

