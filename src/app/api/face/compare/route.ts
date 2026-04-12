import { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseForRoute,
  getRouteAuthUser,
  resolveRouteAccessToken,
} from "@/lib/supabase/route-client";

export const runtime = "nodejs";

const FACE_SERVICE_URL =
  process.env.FACE_SERVICE_URL?.trim() || "http://localhost:8100";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const accessToken = resolveRouteAccessToken(req, formData);

  const supabase = await createSupabaseForRoute(accessToken);
  const {
    data: { user },
    error: authError,
  } = await getRouteAuthUser(supabase, accessToken);

  if (!user) {
    return NextResponse.json(
      {
        error:
          authError?.message?.trim() ||
          "Unauthorized — sign in again or open the app while online.",
      },
      { status: 401 }
    );
  }

  const file = formData.get("file") as File | null;
  const studentId = formData.get("studentId") as string | null;
  if (!file || !studentId) {
    return NextResponse.json(
      { error: "file and studentId required" },
      { status: 400 }
    );
  }

  if (studentId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: embeddings, error } = await supabase
    .from("face_embeddings")
    .select("id, embedding")
    .eq("student_id", studentId);

  if (error || !embeddings?.length) {
    return NextResponse.json(
      { error: "No face registered for this student" },
      { status: 404 }
    );
  }

  const embeddingsJson = JSON.stringify(
    embeddings.map((e) => [e.id, e.embedding])
  );

  const proxyForm = new FormData();
  proxyForm.append("file", file);
  proxyForm.append("embeddings_json", embeddingsJson);

  try {
    const res = await fetch(`${FACE_SERVICE_URL}/compare`, {
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
