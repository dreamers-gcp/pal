import type { CalendarRequest } from "./types";
import { getPalApiBaseUrl } from "./config";
import { getSupabase } from "./supabase";
import { isProfessorMarkedAbsent, isStudentPresent } from "./attendance-status";

/**
 * Same flow as web `AttendanceMarker`: upload to storage → POST `/api/face/compare` → insert row.
 */
export async function markAttendanceWithPhoto(
  profileId: string,
  event: CalendarRequest,
  imageUri: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = getSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { ok: false, message: "Not signed in" };
  }

  const { data: existing } = await supabase
    .from("attendance_records")
    .select("verified, photo_path")
    .eq("student_id", profileId)
    .eq("event_id", event.id)
    .maybeSingle();

  if (isProfessorMarkedAbsent(existing)) {
    return {
      ok: false,
      message:
        "Your instructor marked you absent for this class. Contact them if this is a mistake.",
    };
  }
  if (isStudentPresent(existing)) {
    return { ok: false, message: "You already marked attendance for this class." };
  }

  const filename = `${profileId}/attendance-${event.id}-${Date.now()}.jpg`;

  const imageRes = await fetch(imageUri);
  const blob = await imageRes.blob();

  const { error: upErr } = await supabase.storage
    .from("face-photos")
    .upload(filename, blob, {
      contentType: "image/jpeg",
      upsert: false,
    });

  if (upErr) {
    return { ok: false, message: upErr.message };
  }

  const form = new FormData();
  form.append("file", {
    uri: imageUri,
    name: "face.jpg",
    type: "image/jpeg",
  } as unknown as Blob);
  form.append("studentId", profileId);

  const apiBase = getPalApiBaseUrl();
  const res = await fetch(`${apiBase}/api/face/compare`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    body: form,
  });

  const data = (await res.json()) as {
    match?: boolean;
    similarity?: number;
    error?: string;
  };

  if (!res.ok) {
    await supabase.storage.from("face-photos").remove([filename]);
    return { ok: false, message: data.error || "Verification failed" };
  }

  if (!data.match) {
    await supabase.storage.from("face-photos").remove([filename]);
    return {
      ok: false,
      message: "Face not recognized. Try again with better lighting.",
    };
  }

  const similarity = Number(data.similarity ?? 0);
  const similarityScore = data.match ? Math.max(similarity, 0.35) : similarity;

  const { error: dbErr } = await supabase.from("attendance_records").insert({
    student_id: profileId,
    event_id: event.id,
    photo_path: filename,
    similarity_score: similarityScore,
    verified: true,
  });

  if (dbErr) {
    if (dbErr.code === "23505") {
      return {
        ok: false,
        message:
          "Attendance is already recorded for this class (present or marked absent by your instructor).",
      };
    }
    await supabase.storage.from("face-photos").remove([filename]);
    return { ok: false, message: dbErr.message };
  }

  return { ok: true };
}
