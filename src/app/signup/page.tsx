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

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "student", label: "Student" },
  { value: "professor", label: "Professor" },
  { value: "admin", label: "Admin" },
];

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("student");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string;
    email?: string;
    password?: string;
  }>({});
  const router = useRouter();
  const supabase = createClient();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setSubmitAttempted(true);
    setError("");

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();
    const next: { fullName?: string; email?: string; password?: string } = {};
    if (!trimmedName) next.fullName = "Full name is required.";
    if (!trimmedEmail) next.email = "Email is required.";
    if (!password) next.password = "Password is required.";
    else if (password.length < 6)
      next.password = "Password must be at least 6 characters.";

    setFieldErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        data: {
          full_name: trimmedName,
          role,
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
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
          <form onSubmit={handleSignup} className="space-y-0" noValidate>
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
            </div>

            <div className="mt-10 space-y-4 border-t border-border/60 pt-10">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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

            {error && (
              <p className="mt-6 text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={loading}
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
