import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cosineSimilarity } from "@/lib/face-recognition";

// Face match threshold (0-1)
// Change this value to adjust how strict the matching is (0.75 = 75% confidence required)
export const FACE_MATCH_THRESHOLD = 0.75;

/**
 * POST /api/face/verify
 * Verify student attendance by comparing captured face with enrolled face
 *
 * Body:
 * - image: File (captured face image)
 * - studentId: string
 * - calendarRequestId: string (class/event ID)
 * - classroomId: string
 * - embedding: string (JSON stringified 128-d embedding array)
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get("image") as File;
    const studentId = formData.get("studentId") as string;
    const calendarRequestId = formData.get("calendarRequestId") as string;
    const classroomId = formData.get("classroomId") as string;
    const embeddingStr = formData.get("embedding") as string;

    if (!imageFile || !studentId || !calendarRequestId || !classroomId || !embeddingStr) {
      return NextResponse.json(
        { error: "Missing required fields: image, studentId, calendarRequestId, classroomId, embedding" },
        { status: 400 }
      );
    }

    console.log("Verification request - studentId:", studentId);

    const supabase = await createClient();
    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());

    // Parse embedding
    let checkInEmbedding: number[];
    try {
      checkInEmbedding = JSON.parse(embeddingStr);
      if (!Array.isArray(checkInEmbedding) || checkInEmbedding.length !== 128) {
        throw new Error("Invalid embedding format");
      }
      console.log("Check-in embedding received, dimensions:", checkInEmbedding.length);
    } catch (e) {
      return NextResponse.json(
        { error: "Invalid embedding format. Expected 128-dimensional array." },
        { status: 400 }
      );
    }

    // Get stored face profile
    console.log("Fetching stored face profile...");
    const { data: profile, error: profileError } = await supabase
      .from("face_profiles")
      .select("face_embedding")
      .eq("student_id", studentId)
      .single();

    if (profileError || !profile) {
      console.error("Profile fetch error:", profileError);
      return NextResponse.json(
        { error: "No face profile found for student. Please enroll your face first." },
        { status: 404 }
      );
    }

    console.log("Profile found, comparing embeddings...");

    // Calculate match confidence
    const storedEmbedding = Array.isArray(profile.face_embedding)
      ? profile.face_embedding
      : Array(128).fill(0);
    
    const confidence = cosineSimilarity(checkInEmbedding, storedEmbedding as number[]);
    const matched = confidence >= FACE_MATCH_THRESHOLD;

    console.log("Match result:", { confidence, matched, threshold: FACE_MATCH_THRESHOLD });

    // Record attendance
    const { error: attendanceError } = await supabase
      .from("face_attendance")
      .insert({
        student_id: studentId,
        calendar_request_id: calendarRequestId,
        classroom_id: classroomId,
        check_in_image: imageBuffer,
        check_in_embedding: checkInEmbedding,
        match_confidence: confidence,
        matched: matched,
        matched_at: new Date().toISOString(),
      });

    if (attendanceError) {
      console.error("Attendance record error:", attendanceError);
      throw attendanceError;
    }

    const confidencePercent = Math.round(confidence * 100);
    const thresholdPercent = Math.round(FACE_MATCH_THRESHOLD * 100);

    console.log("Verification complete:", { matched, confidencePercent, thresholdPercent });

    return NextResponse.json({
      success: true,
      matched: matched,
      confidence: confidencePercent,
      threshold: thresholdPercent,
      message: matched
        ? "✓ Face matched! Attendance marked."
        : `✗ Face match failed. Confidence: ${confidencePercent}%, Required: ${thresholdPercent}%`,
    });
  } catch (error) {
    console.error("Face verification error:", error);
    const errorMessage = error instanceof Error ? error.message : "Verification failed";
    console.error("Error details:", errorMessage);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
