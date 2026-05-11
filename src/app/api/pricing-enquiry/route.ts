import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const required = ["fullName", "email", "institution", "role", "students"];
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    // Log to console (replace with DB write or email in production)
    console.log("[pricing-enquiry]", {
      timestamp: new Date().toISOString(),
      fullName: body.fullName,
      email: body.email,
      phone: body.phone ?? null,
      institution: body.institution,
      role: body.role,
      students: body.students,
      tier: body.tier ?? null,
      erp: body.erp ?? null,
      timeline: body.timeline ?? null,
      message: body.message ?? null,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
