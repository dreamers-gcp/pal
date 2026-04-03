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
import {
  AuthPasswordField,
  authInputClassName,
} from "@/components/auth/auth-shared";
import { PlanovaWordmark } from "@/components/planova-wordmark";

function LoginBrandPanel() {
  return (
    <div className="relative flex min-h-[220px] w-full flex-1 flex-col justify-center overflow-hidden bg-gradient-to-br from-primary/90 via-[#5b52f0] to-[#312e81] p-8 text-primary-foreground md:min-h-full">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />
      <div className="relative">
        <PlanovaWordmark
          variant="inverse"
          size="sm"
          decorative
          className="opacity-95"
        />
        <h2 className="mt-5 font-display text-2xl font-semibold leading-tight text-white md:text-3xl">
          Your campus schedule, simplified.
        </h2>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/85">
          Book rooms, manage courses, and stay on top of attendance—all in one
          place.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setSubmitAttempted(true);
    setError("");

    const nextField: { email?: string; password?: string } = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail) nextField.email = "Email is required.";
    if (!password) nextField.password = "Password is required.";
    setFieldErrors(nextField);
    if (Object.keys(nextField).length > 0) return;

    setLoading(true);

    const { error, data } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const user = data.user;
    if (user) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("role, face_registered")
        .eq("id", user.id)
        .single();

      if (prof?.role === "student" && !prof.face_registered) {
        router.push("/face-registration");
      } else {
        router.push("/dashboard");
      }
      router.refresh();
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <AuthShell>
      <Card className="w-full max-w-4xl overflow-hidden border-foreground/10 shadow-md md:flex-row md:items-stretch md:gap-0 md:py-0">
        <div className="flex w-full flex-1 flex-col py-4 md:w-1/2 md:min-w-0 md:max-w-none md:py-4">
          <CardHeader className="space-y-4 pb-2 text-center md:text-left">
            <div className="mx-auto flex justify-center md:mx-0 md:justify-start">
              <PlanovaWordmark size="lg" />
            </div>
            <div>
              <CardTitle className="text-2xl">Welcome back</CardTitle>
              <CardDescription className="mt-1.5">
                Sign in to your Planova account
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <form onSubmit={handleLogin} className="space-y-4" noValidate>
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
                  <p className="text-sm text-destructive">{fieldErrors.email}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <AuthPasswordField
                  id="password"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (submitAttempted) {
                      setFieldErrors((f) => ({
                        ...f,
                        password: e.target.value
                          ? undefined
                          : "Password is required.",
                      }));
                    }
                  }}
                  autoComplete="current-password"
                  aria-invalid={Boolean(fieldErrors.password)}
                />
                {fieldErrors.password && (
                  <p className="text-sm text-destructive">
                    {fieldErrors.password}
                  </p>
                )}
                <div className="pt-0.5 text-right">
                  <Link
                    href="/forgot-password"
                    className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
              </div>
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                disabled={loading}
                className="w-full rounded-[8px] bg-primary py-3 text-base font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 active:bg-primary/85 disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <Loader2
                      className="mr-2 size-4 shrink-0 animate-spin"
                      aria-hidden
                    />
                    Signing in…
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
            <div className="mt-8 border-t border-border/80 pt-8">
              <p className="text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{" "}
                <Link
                  href="/signup"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Sign up
                </Link>
              </p>
            </div>
          </CardContent>
        </div>
        <div className="hidden min-h-0 w-full md:flex md:w-1/2 md:min-w-0 md:flex-col">
          <LoginBrandPanel />
        </div>
      </Card>
    </AuthShell>
  );
}
