import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const FACE_SERVICE_URL =
  process.env.FACE_SERVICE_URL?.trim() || "http://localhost:8100";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const proxyForm = new FormData();
  proxyForm.append("file", file);

  try {
    const res = await fetch(`${FACE_SERVICE_URL}/embedding`, {
      method: "POST",
      body: proxyForm,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: res.statusText }));
      return NextResponse.json(
        { error: body.detail || "Face service error" },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `Face service unreachable: ${msg}` },
      { status: 502 }
    );
  }
}
