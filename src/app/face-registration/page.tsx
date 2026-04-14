"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { FaceRegistration } from "@/components/face-registration";
import { AppLoadingState } from "@/components/ui/app-loading-state";
import { AuthShell } from "@/components/auth-shell";
import { LogOut, Pencil } from "lucide-react";

function FaceRegHeaderActions() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="flex items-center gap-4">
      <Link
        href="/auth/onboarding"
        className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <Pencil className="h-3.5 w-3.5" />
        Edit profile
      </Link>
      <button
        onClick={handleSignOut}
        disabled={signingOut}
        className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
      >
        <LogOut className="h-3.5 w-3.5" />
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}

export default function FaceRegistrationPage() {
  const router = useRouter();
  const [studentId, setStudentId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, face_registered")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (!profile || profile.role !== "student") {
        router.replace("/dashboard");
        return;
      }

      if (profile.face_registered) {
        router.replace("/dashboard");
        return;
      }

      setStudentId(user.id);
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready || !studentId) {
    return (
      <AuthShell>
        <AppLoadingState
          title="Almost there"
          subtitle="Checking your account before face setup..."
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell headerActions={<FaceRegHeaderActions />}>
      <div className="w-full max-w-xl">
        <FaceRegistration
          studentId={studentId}
          onRegistrationComplete={() => {
            router.replace("/dashboard");
          }}
        />
      </div>
    </AuthShell>
  );
}
