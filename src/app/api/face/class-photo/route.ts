import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const FACE_SERVICE_URL =
  process.env.FACE_SERVICE_URL?.trim() || "http://localhost:8100";

const MIN_SIMILARITY = 0.35;

type CalendarRequestRow = {
  id: string;
  professor_id: string | null;
  professor_email: string | null;
  student_group_id: string | null;
  status: string;
  student_groups?: { student_group?: { id: string } | null }[] | null;
};

function groupIdsForEvent(event: CalendarRequestRow): string[] {
  const ids = new Set<string>();
  if (event.student_group_id) ids.add(event.student_group_id);
  for (const row of event.student_groups ?? []) {
    const id = row?.student_group?.id;
    if (id) ids.add(id);
  }
  return Array.from(ids);
}

export async function POST(req: NextRequest) {
  try {
    return await handleClassPhotoPost(req);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[class-photo]", e);
    return NextResponse.json(
      { error: msg || "Unexpected error processing class photo" },
      { status: 500 }
    );
  }
}

async function handleClassPhotoPost(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "professor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const eventId = formData.get("eventId") as string | null;
  const applyRaw = formData.get("apply");
  const apply = applyRaw === "true" || applyRaw === "1";

  if (!file || !eventId) {
    return NextResponse.json(
      { error: "file and eventId are required" },
      { status: 400 }
    );
  }

  const { data: event, error: eventError } = await supabase
    .from("calendar_requests")
    .select(
      "id, professor_id, professor_email, student_group_id, status, student_groups:calendar_request_groups(student_group:student_groups(id))"
    )
    .eq("id", eventId)
    .maybeSingle();

  if (eventError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const ev = event as unknown as CalendarRequestRow;
  if (ev.status !== "approved") {
    return NextResponse.json({ error: "Event is not approved" }, { status: 400 });
  }

  const isOwner =
    ev.professor_id === user.id ||
    (ev.professor_email &&
      profile.email &&
      ev.professor_email.toLowerCase() === profile.email.toLowerCase());

  if (!isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const groupIds = groupIdsForEvent(ev);
  if (groupIds.length === 0) {
    return NextResponse.json(
      { error: "No student groups linked to this event" },
      { status: 400 }
    );
  }

  const { data: memberRows, error: memErr } = await supabase
    .from("student_group_members")
    .select("student_id")
    .in("group_id", groupIds);

  if (memErr) {
    return NextResponse.json(
      { error: memErr.message },
      { status: 500 }
    );
  }

  const enrolledIds = [
    ...new Set((memberRows ?? []).map((r) => r.student_id as string)),
  ];

  if (enrolledIds.length === 0) {
    return NextResponse.json(
      {
        error: "No students enrolled in this class",
        preview: { face_count: 0, matches: [], enrolled_count: 0 },
      },
      { status: 400 }
    );
  }

  const { data: embeddingRows, error: embErr } = await supabase
    .from("face_embeddings")
    .select("id, student_id, embedding")
    .in("student_id", enrolledIds);

  if (embErr) {
    return NextResponse.json({ error: embErr.message }, { status: 500 });
  }

  const byStudent = new Map<string, [string, number[]][]>();
  for (const row of embeddingRows ?? []) {
    const sid = row.student_id as string;
    const list = byStudent.get(sid) ?? [];
    list.push([row.id as string, row.embedding as number[]]);
    byStudent.set(sid, list);
  }

  const studentsWithEmbeddings = enrolledIds.filter((id) =>
    byStudent.has(id)
  );
  const studentsMissingFace = enrolledIds.filter((id) => !byStudent.has(id));

  if (studentsWithEmbeddings.length === 0) {
    return NextResponse.json(
      {
        error: "No enrolled students have registered a face",
        studentsMissingFace,
        enrolled_count: enrolledIds.length,
      },
      { status: 400 }
    );
  }

  const candidates = studentsWithEmbeddings.map((student_id) => ({
    student_id,
    embeddings: byStudent.get(student_id)!,
  }));

  const candidatesJson = JSON.stringify(candidates);

  const proxyForm = new FormData();
  proxyForm.append("file", file);
  proxyForm.append("candidates_json", candidatesJson);

  let identify: {
    face_count: number;
    matches: { student_id: string; face_index: number; similarity: number }[];
    unmatched_face_indices: number[];
    matched_student_ids: string[];
    threshold: number;
  };

  try {
    const res = await fetch(`${FACE_SERVICE_URL}/identify_class`, {
      method: "POST",
      body: proxyForm,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: res.statusText }));
      return NextResponse.json(
        { error: (body as { detail?: string }).detail || "Face service error" },
        { status: res.status }
      );
    }

    identify = await res.json();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `Face service unreachable: ${msg}` },
      { status: 502 }
    );
  }

  const { data: nameRows } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", [
      ...identify.matches.map((m) => m.student_id),
      ...studentsMissingFace,
    ]);

  const nameById = new Map(
    (nameRows ?? []).map((p) => [
      p.id as string,
      (p.full_name as string) || (p.email as string),
    ])
  );

  const matchesDetailed = identify.matches
    .filter((m) => m.similarity >= MIN_SIMILARITY)
    .map((m) => ({
      ...m,
      student_name: nameById.get(m.student_id) ?? m.student_id,
    }));

  if (!apply) {
    return NextResponse.json({
      preview: true,
      event_id: eventId,
      face_count: identify.face_count,
      threshold: identify.threshold,
      matches: matchesDetailed,
      unmatched_face_indices: identify.unmatched_face_indices,
      enrolled_count: enrolledIds.length,
      students_with_face: studentsWithEmbeddings.length,
      students_missing_face: studentsMissingFace.map((id) => ({
        student_id: id,
        student_name: nameById.get(id) ?? id,
      })),
    });
  }

  /** Apply: upload class photo once, then upsert attendance for each match. */
  const buf = Buffer.from(await file.arrayBuffer());
  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg";
  const photoPath = `class-photo/${eventId}/${randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("face-photos")
    .upload(photoPath, buf, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: `Storage upload failed: ${uploadError.message}` },
      { status: 500 }
    );
  }

  const applied: typeof matchesDetailed = [];
  const attendanceErrors: string[] = [];

  for (const m of matchesDetailed) {
    const { error: upErr } = await supabase.from("attendance_records").upsert(
      {
        student_id: m.student_id,
        event_id: eventId,
        photo_path: photoPath,
        similarity_score: m.similarity,
        verified: true,
        marked_at: new Date().toISOString(),
      },
      { onConflict: "student_id,event_id" }
    );

    if (upErr) {
      attendanceErrors.push(`${m.student_id}: ${upErr.message}`);
    } else {
      applied.push(m);
    }
  }

  return NextResponse.json({
    applied: true,
    photo_path: photoPath,
    face_count: identify.face_count,
    matches: applied,
    unmatched_face_indices: identify.unmatched_face_indices,
    attendance_errors:
      attendanceErrors.length > 0 ? attendanceErrors : undefined,
  });
}
