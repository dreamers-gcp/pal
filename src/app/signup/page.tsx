"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import type { UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  AuthPasswordField,
  PasswordStrengthBar,
  authInputClassName,
} from "@/components/auth/auth-shared";
import { PlanovaWordmark } from "@/components/planova-wordmark";
import {
  normalizeTenDigitMobile,
  mobileFieldError,
} from "@/lib/phone-normalize";
import { SignupFaceCapture, type CapturedFace } from "@/components/signup-face-capture";
import { toast } from "sonner";
import { GoogleLogo } from "@/components/auth/google-logo";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "student", label: "Student" },
  { value: "professor", label: "Professor" },
  { value: "admin", label: "Admin" },
];

const MIN_FACE_PHOTOS = 3;

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [role, setRole] = useState<UserRole>("student");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [faceCaptures, setFaceCaptures] = useState<CapturedFace[]>([]);
  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string;
    email?: string;
    mobile?: string;
    password?: string;
  }>({});
  const router = useRouter();

  const isStudent = role === "student";
  const faceReady = faceCaptures.length >= MIN_FACE_PHOTOS;

  async function handleGoogleSignup() {
    setError("");
    setOauthLoading(true);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=/auth/onboarding`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: { prompt: "select_account" },
      },
    });

    if (error) {
      setError(error.message);
      setOauthLoading(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setSubmitAttempted(true);
    setError("");

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();
    const next: {
      fullName?: string;
      email?: string;
      mobile?: string;
      password?: string;
    } = {};
    if (!trimmedName) next.fullName = "Full name is required.";
    if (!trimmedEmail) next.email = "Email is required.";
    const mobileErr = mobileFieldError(mobile);
    if (mobileErr) next.mobile = mobileErr;
    if (!password) next.password = "Password is required.";
    else if (password.length < 6)
      next.password = "Password must be at least 6 characters.";

    setFieldErrors(next);
    if (Object.keys(next).length > 0) return;

    if (isStudent && !faceReady) {
      setError(`Please capture at least ${MIN_FACE_PHOTOS} face photos before signing up.`);
      return;
    }

    const normalizedMobile = normalizeTenDigitMobile(mobile)!;
    setLoading(true);

    const supabase = createClient();
    const { data, error: signupError } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        data: {
          full_name: trimmedName,
          role,
          mobile_phone: normalizedMobile,
        },
      },
    });

    if (signupError) {
      const msg = signupError.message.toLowerCase();
      if (
        msg.includes("duplicate") ||
        msg.includes("unique") ||
        msg.includes("already registered")
      ) {
        setError(
          "This email or mobile may already be in use. Try signing in, or use a different mobile number."
        );
      } else {
        setError(signupError.message);
      }
      setLoading(false);
      return;
    }

    // For students: save face photos + embeddings to Supabase
    if (isStudent && data.user && faceCaptures.length > 0) {
      const userId = data.user.id;
      let savedCount = 0;

      for (const capture of faceCaptures) {
        try {
          const filename = `${userId}/${Date.now()}-${savedCount}.jpg`;
          const { error: uploadErr } = await supabase.storage
            .from("face-photos")
            .upload(filename, capture.blob, {
              contentType: "image/jpeg",
              upsert: false,
            });

          if (uploadErr) {
            console.error("Face upload error:", uploadErr.message);
            continue;
          }

          const { error: dbErr } = await supabase.from("face_embeddings").insert({
            student_id: userId,
            photo_path: filename,
            embedding: capture.embedding,
          });

          if (dbErr) {
            console.error("Face embedding save error:", dbErr.message);
            continue;
          }

          savedCount++;
        } catch (err) {
          console.error("Face save error:", err);
        }
      }

      if (savedCount >= MIN_FACE_PHOTOS) {
        await supabase
          .from("profiles")
          .update({ face_registered: true })
          .eq("id", userId);
      } else if (savedCount > 0) {
        toast.error(
          `Only ${savedCount} of ${faceCaptures.length} photos saved. You can complete registration after confirming your email.`
        );
      } else {
        toast.error(
          "Face photos could not be saved. You can register your face after confirming your email and logging in."
        );
      }

      // Clean up blob URLs
      for (const c of faceCaptures) {
        URL.revokeObjectURL(c.previewUrl);
      }
    }

    setLoading(false);
    setSuccess(true);
  }

  if (success) {
    return (
      <AuthShell>
        <Card className="w-full max-w-md border-foreground/10 shadow-md">
          <CardHeader className="space-y-4 text-center">
            <div className="mx-auto flex justify-center">
              <PlanovaWordmark size="lg" />
            </div>
            <div>
              <CardTitle className="text-2xl">Check your email</CardTitle>
              <CardDescription className="mt-1.5">
                We&apos;ve sent a confirmation link to{" "}
                <strong>{email}</strong>. Click it to activate your account,
                then sign in.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full rounded-[8px] bg-primary py-3 text-base font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
              onClick={() => router.push("/login")}
            >
              Go to Sign In
            </Button>
          </CardContent>
        </Card>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <Card className="w-full max-w-md border-foreground/10 shadow-md">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex justify-center">
            <PlanovaWordmark size="lg" />
          </div>
          <div>
            <CardTitle className="text-2xl">Create your account</CardTitle>
            <CardDescription className="mt-1.5">
              Join Planova to manage your calendar
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleGoogleSignup()}
            disabled={loading || oauthLoading}
            className="w-full rounded-[8px] py-3 text-base font-medium"
          >
            {oauthLoading ? (
              <>
                <Loader2 className="mr-2 size-4 shrink-0 animate-spin" aria-hidden />
                Redirecting to Google…
              </>
            ) : (
              <>
                <GoogleLogo className="mr-2 size-4 shrink-0" />
                Continue with Google
              </>
            )}
          </Button>
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/80" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                or sign up with email
              </span>
            </div>
          </div>
          <form onSubmit={handleSignup} className="space-y-0" noValidate>
            <div className="space-y-4">
              <p className="text-xs font-semibold capitalize tracking-wide text-muted-foreground">
                Personal info
              </p>
              <div className="space-y-2">
                <Label htmlFor="fullName">Full name</Label>
                <Input
                  id="fullName"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (submitAttempted) {
                      setFieldErrors((f) => ({
                        ...f,
                        fullName: e.target.value.trim()
                          ? undefined
                          : "Full name is required.",
                      }));
                    }
                  }}
                  autoComplete="name"
                  aria-invalid={Boolean(fieldErrors.fullName)}
                  className={authInputClassName}
                />
                {fieldErrors.fullName && (
                  <p className="text-sm text-destructive">
                    {fieldErrors.fullName}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@university.edu"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (submitAttempted) {
                      setFieldErrors((f) => ({
                        ...f,
                        email: e.target.value.trim()
                          ? undefined
                          : "Email is required.",
                      }));
                    }
                  }}
                  autoComplete="email"
                  aria-invalid={Boolean(fieldErrors.email)}
                  className={authInputClassName}
                />
                {fieldErrors.email && (
                  <p className="text-sm text-destructive">
                    {fieldErrors.email}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile">Mobile number</Label>
                <Input
                  id="mobile"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="10-digit number you use on campus"
                  value={mobile}
                  maxLength={14}
                  onChange={(e) => {
                    setMobile(e.target.value);
                    if (submitAttempted) {
                      setFieldErrors((f) => ({
                        ...f,
                        mobile: mobileFieldError(e.target.value),
                      }));
                    }
                  }}
                  aria-invalid={Boolean(fieldErrors.mobile)}
                  className={authInputClassName}
                />
                <p className="text-xs text-muted-foreground">
                  10-digit Indian mobile. Used for campus services such as parcel pickup matching.
                </p>
                {fieldErrors.mobile && (
                  <p className="text-sm text-destructive">{fieldErrors.mobile}</p>
                )}
              </div>
            </div>

            <div className="mt-10 space-y-4 border-t border-border/60 pt-10">
              <p className="text-xs font-semibold capitalize tracking-wide text-muted-foreground">
                Account setup
              </p>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <AuthPasswordField
                  id="password"
                  placeholder="Min 6 characters"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (submitAttempted) {
                      const v = e.target.value;
                      setFieldErrors((f) => ({
                        ...f,
                        password: !v
                          ? "Password is required."
                          : v.length < 6
                            ? "Password must be at least 6 characters."
                            : undefined,
                      }));
                    }
                  }}
                  autoComplete="new-password"
                  aria-invalid={Boolean(fieldErrors.password)}
                />
                <PasswordStrengthBar password={password} />
                {fieldErrors.password && (
                  <p className="text-sm text-destructive">
                    {fieldErrors.password}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <span className="text-sm font-medium leading-none" id="role-label">
                  I am a
                </span>
                <div
                  className="grid grid-cols-1 gap-2 sm:grid-cols-3"
                  role="group"
                  aria-labelledby="role-label"
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setRole(opt.value)}
                      className={cn(
                        "rounded-[8px] border px-3 py-3 text-sm font-medium transition-[border-color,background-color,color,box-shadow] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-0 sm:py-2.5",
                        role === opt.value
                          ? "border-primary bg-primary/10 text-primary shadow-sm"
                          : "border-[rgba(26,26,46,0.18)] bg-transparent text-foreground hover:bg-muted/60 dark:border-white/18"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Face registration section — students only */}
            {isStudent && (
              <div className="mt-10 border-t border-border/60 pt-10">
                <SignupFaceCapture
                  captures={faceCaptures}
                  onCapturesChange={setFaceCaptures}
                />
              </div>
            )}

            {error && (
              <p className="mt-6 text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={loading || oauthLoading || (isStudent && !faceReady)}
              className="mt-6 w-full rounded-[8px] bg-primary py-3 text-base font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 active:bg-primary/85 disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2
                    className="mr-2 size-4 shrink-0 animate-spin"
                    aria-hidden
                  />
                  Creating account…
                </>
              ) : isStudent && !faceReady ? (
                `Capture ${MIN_FACE_PHOTOS - faceCaptures.length} more photo${MIN_FACE_PHOTOS - faceCaptures.length === 1 ? "" : "s"} to sign up`
              ) : (
                "Sign Up"
              )}
            </Button>
          </form>
          <div className="mt-8 border-t border-border/80 pt-8">
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
