import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users to login (except for public pages)
  // Never redirect API routes — let Route Handlers return JSON 401; otherwise
  // client fetch() follows redirect to /login and gets HTML → "not valid JSON".
  const isPublicPath =
    request.nextUrl.pathname === "/" ||
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/signup") ||
    request.nextUrl.pathname.startsWith("/auth");
  const isApiRoute = request.nextUrl.pathname.startsWith("/api");
  const isOnboardingPath = request.nextUrl.pathname.startsWith("/auth/onboarding");
  const isFaceRegistrationPath = request.nextUrl.pathname.startsWith("/face-registration");

  if (!user && !isPublicPath && !isApiRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && !isApiRoute && !isPublicPath) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name, mobile_phone, face_registered")
      .eq("id", user.id)
      .maybeSingle();

    const missingCoreProfile =
      !profile ||
      !profile.full_name?.trim() ||
      !profile.mobile_phone?.trim();

    if (
      missingCoreProfile &&
      !isOnboardingPath &&
      !isFaceRegistrationPath &&
      !request.nextUrl.pathname.startsWith("/auth/callback")
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/onboarding";
      return NextResponse.redirect(url);
    }

    if (
      profile?.role === "student" &&
      !profile.face_registered &&
      !isFaceRegistrationPath &&
      !isOnboardingPath &&
      !request.nextUrl.pathname.startsWith("/auth/callback")
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/face-registration";
      return NextResponse.redirect(url);
    }
  }

  // Redirect authenticated users away from login/signup to the right destination
  if (
    user &&
    (request.nextUrl.pathname.startsWith("/login") ||
      request.nextUrl.pathname.startsWith("/signup"))
  ) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name, mobile_phone, face_registered")
      .eq("id", user.id)
      .maybeSingle();

    const url = request.nextUrl.clone();
    const incomplete =
      !profile || !profile.full_name?.trim() || !profile.mobile_phone?.trim();

    if (incomplete) {
      url.pathname = "/auth/onboarding";
    } else if (profile.role === "student" && !profile.face_registered) {
      url.pathname = "/face-registration";
    } else {
      url.pathname = "/dashboard";
    }
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
