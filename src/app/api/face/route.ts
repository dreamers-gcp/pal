import { NextRequest, NextResponse } from "next/server";

/**
 * This file is deprecated
 * Use /api/face/enroll/route.ts for enrollment
 * Use /api/face/verify/route.ts for verification
 */

export async function GET() {
  return NextResponse.json(
    { error: "Use /api/face/enroll or /api/face/verify endpoints" },
    { status: 405 }
  );
}

export async function POST() {
  return NextResponse.json(
    { error: "Use /api/face/enroll or /api/face/verify endpoints" },
    { status: 405 }
  );
}
