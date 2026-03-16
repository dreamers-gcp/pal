import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/face/test-embedding
 * Test endpoint - deprecated, embedding extraction now happens on frontend
 */
export async function POST() {
  return NextResponse.json(
    { error: "This endpoint is deprecated. Face embedding extraction now happens on the client-side." },
    { status: 405 }
  );
}
