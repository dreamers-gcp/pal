"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { FaceRegistration } from "@/components/face-registration";
import { AppLoadingState } from "@/components/ui/app-loading-state";

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
      <AppLoadingState
        className="min-h-screen"
        title="Almost there"
        subtitle="Checking your account before face setup..."
      />
    );
  }

  if (profile.role !== "student" || profile.face_registered) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-xl">
        <FaceRegistration
          studentId={profile.id}
          onRegistrationComplete={() => {
            router.replace("/dashboard");
          }}
        />
      </div>
    </div>
  );
}

