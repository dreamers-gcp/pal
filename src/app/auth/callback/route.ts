import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, full_name, mobile_phone, face_registered")
          .eq("id", user.id)
          .maybeSingle();

        if (
          !profile ||
          !profile.full_name?.trim() ||
          !profile.mobile_phone?.trim()
        ) {
          return NextResponse.redirect(`${origin}/auth/onboarding`);
        }

        if (profile.role === "student" && !profile.face_registered) {
          return NextResponse.redirect(`${origin}/face-registration`);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
