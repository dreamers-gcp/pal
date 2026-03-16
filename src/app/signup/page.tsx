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
import { UserPlus } from "lucide-react";
import { FaceEnrollment } from "@/components/face-auth";
import type { UserRole } from "@/lib/types";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("student");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState("");
  const [showFaceEnrollment, setShowFaceEnrollment] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // For students, show face enrollment after signup
    if (role === "student" && data.user?.id) {
      setUserId(data.user.id);
      setShowFaceEnrollment(true);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  const handleFaceEnrollmentSuccess = () => {
    console.log("Face enrollment successful, showing email verification screen");
    setSuccess(true);
  };

  // Face enrollment step for students
  if (showFaceEnrollment && role === "student") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Set up Face Authentication</CardTitle>
            <CardDescription>
              We&apos;ll use your face to verify your attendance in classes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FaceEnrollment
              studentId={userId}
              onSuccess={handleFaceEnrollmentSuccess}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show email verification screen after successful signup (with or without face enrollment)
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-green-600">✓ Account Created Successfully</CardTitle>
            <CardDescription>
              {role === "student" && "Face authentication setup complete! "}
              We&apos;ve sent a confirmation link to <strong>{email}</strong>.
              Click it to activate your account, then sign in.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              📧 Check your inbox (and spam folder) for the confirmation email.
            </p>
            <Button
              className="w-full"
              onClick={() => router.push("/login")}
            >
              Go to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary">
            <UserPlus className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Create your account</CardTitle>
          <CardDescription>Join PAL to manage your calendar</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">
                Full Name
                <span className="text-red-500">*</span>
              </Label>
              <Input
                id="fullName"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">
                Email
                <span className="text-red-500">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">
                Password
                <span className="text-red-500">*</span>
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Min 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">
                I am a
                <span className="text-red-500">*</span>
              </Label>
              <select
                id="role"
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                required
              >
                <option value="">Select...</option>
                <option value="student">Student</option>
                <option value="professor">Professor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Sign Up"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary underline hover:no-underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
