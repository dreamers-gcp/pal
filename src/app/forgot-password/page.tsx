"use client";

import { useState } from "react";
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
import { authInputClassName } from "@/components/auth/auth-shared";
import { PlanovaWordmark } from "@/components/planova-wordmark";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitAttempted(true);
    setError("");
    setMessage("");

    const trimmed = email.trim();
    if (!trimmed) {
      setFieldError("Email is required.");
      return;
    }
    setFieldError("");

    setLoading(true);
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      trimmed,
      { redirectTo: origin ? `${origin}/login` : undefined }
    );
    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setMessage(
      "If an account exists for that email, you will receive a link to reset your password."
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
            <CardTitle className="text-2xl">Reset password</CardTitle>
            <CardDescription className="mt-1.5">
              Enter your email and we&apos;ll send you a reset link.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
                    setFieldError(
                      e.target.value.trim() ? "" : "Email is required."
                    );
                  }
                }}
                autoComplete="email"
                aria-invalid={Boolean(fieldError)}
                className={authInputClassName}
              />
              {fieldError && (
                <p className="text-sm text-destructive">{fieldError}</p>
              )}
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            {message && (
              <p className="text-sm text-muted-foreground" role="status">
                {message}
              </p>
            )}
            <Button
              type="submit"
              disabled={loading}
              className="w-full rounded-[8px] bg-primary py-3 text-base font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2
                    className="mr-2 size-4 shrink-0 animate-spin"
                    aria-hidden
                  />
                  Sending…
                </>
              ) : (
                "Send reset link"
              )}
            </Button>
          </form>
          <p className="mt-8 text-center text-sm text-muted-foreground">
            <Link
              href="/login"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
