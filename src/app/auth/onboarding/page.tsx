"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { mobileFieldError, normalizeTenDigitMobile } from "@/lib/phone-normalize";
import type { UserRole } from "@/lib/types";

function OnboardingHeaderActions() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={signingOut}
      className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
    >
      <LogOut className="h-3.5 w-3.5" />
      {signingOut ? "Signing out…" : "Sign out"}
    </button>
  );
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "student", label: "Student" },
  { value: "professor", label: "Professor" },
  { value: "admin", label: "Admin" },
];

export default function AuthOnboardingPage() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [faceRegistered, setFaceRegistered] = useState(false);
  const [fullName, setFullName] = useState<string | null>(null);
  const [mobile, setMobile] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [profileMissing, setProfileMissing] = useState(false);

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

      setUserId(user.id);
      setUserEmail(user.email ?? null);
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, mobile_phone, role, face_registered")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;
      if (!profile) {
        setProfileMissing(true);
        setRole("student");
        setAuthLoading(false);
        return;
      }

      setFullName(profile.full_name ?? "");
      setMobile(profile.mobile_phone ?? "");
      setRole(profile.role as UserRole);
      setFaceRegistered(Boolean(profile.face_registered));
      setAuthLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const resolvedFullName = fullName ?? "";
  const resolvedMobile = mobile ?? "";
  const resolvedRole = role ?? "student";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const n = resolvedFullName.trim();
    if (!n) {
      setError("Full name is required.");
      return;
    }

    const mobileErr = mobileFieldError(resolvedMobile);
    if (mobileErr) {
      setError(mobileErr);
      return;
    }

    const normalizedMobile = normalizeTenDigitMobile(resolvedMobile)!;
    if (!userId) return;
    if (!userEmail) {
      setError("Could not read account email from session. Please sign in again.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error: upErr } = await supabase
      .from("profiles")
      .upsert(
        {
          id: userId,
          email: userEmail,
          full_name: n,
          mobile_phone: normalizedMobile,
          role: resolvedRole,
        },
        { onConflict: "id" }
      );

    if (upErr) {
      const msg = upErr.message ?? "";
      if (/row-level security|violates row-level security/i.test(msg)) {
        setError(
          "Profile save blocked by database policy. Apply supabase/add-profiles-self-insert-policy.sql, then try again."
        );
      } else {
        setError(msg);
      }
      setSaving(false);
      return;
    }

    if (resolvedRole === "student" && !faceRegistered) {
        router.replace("/face-registration");
      } else {
        router.replace("/dashboard");
      }
    router.refresh();
  }

  if (authLoading) {
    return (
      <AuthShell headerActions={<OnboardingHeaderActions />}>
        <div className="flex w-full max-w-md items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" />
          Loading account...
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell headerActions={<OnboardingHeaderActions />}>
      <Card className="w-full max-w-md border-foreground/10 shadow-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl">Finish setup</CardTitle>
          <CardDescription>
            Complete your profile to continue with Google sign-in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {profileMissing ? (
            <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              We could not find your profile row yet. Saving this form will create it.
            </p>
          ) : null}
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                value={resolvedFullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobile">Mobile number</Label>
              <Input
                id="mobile"
                type="tel"
                inputMode="numeric"
                value={resolvedMobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="10-digit number"
                autoComplete="tel"
                maxLength={14}
              />
            </div>
            <div className="space-y-2">
              <Label>I am a</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {ROLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRole(opt.value)}
                    className={`rounded-[8px] border px-3 py-2 text-sm font-medium ${
                      resolvedRole === opt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-[rgba(26,26,46,0.18)]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <Button
              type="submit"
              disabled={saving}
              className="w-full rounded-[8px] bg-primary py-3 text-base font-medium text-primary-foreground"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  Saving...
                </>
              ) : (
                "Continue"
              )}
            </Button>
            {resolvedRole === "student" ? (
              <p className="text-xs text-muted-foreground">
                Students will be asked to complete face registration next.
              </p>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
