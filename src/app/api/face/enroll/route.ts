import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/face/enroll
 * Enroll a student with their face during signup
 * 
 * Body:
 * - image: File (face image)
 * - studentId: string
 * - embedding: string (JSON stringified 128-d embedding array)
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get("image") as File;
    const studentId = formData.get("studentId") as string;
    const embeddingStr = formData.get("embedding") as string;

    if (!imageFile || !studentId || !embeddingStr) {
      return NextResponse.json(
        { error: "Missing required fields: image, studentId, embedding" },
        { status: 400 }
      );
    }

    console.log("Enrollment request - studentId:", studentId);

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    console.log("Image buffer size:", imageBuffer.length);

    // Parse embedding
    let embedding: number[];
    try {
      embedding = JSON.parse(embeddingStr);
      if (!Array.isArray(embedding) || embedding.length !== 128) {
        throw new Error("Invalid embedding format");
      }
      console.log("Embedding received, dimensions:", embedding.length);
    } catch (e) {
      return NextResponse.json(
        { error: "Invalid embedding format. Expected 128-dimensional array." },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "User not authenticated" },
        { status: 401 }
      );
    }

    console.log("Current user ID:", user.id);

    // Ensure user can only enroll themselves
    if (user.id !== studentId) {
      return NextResponse.json(
        { error: "You can only enroll your own face" },
        { status: 403 }
      );
    }

    // Check if face profile already exists
    const { data: existing, error: selectError } = await supabase
      .from("face_profiles")
      .select("id")
      .eq("student_id", studentId)
      .single();

    console.log("Existing profile check:", { existing, selectError });

    if (selectError && selectError.code !== "PGRST116") {
      // PGRST116 means no rows found, which is expected for first enrollment
      throw selectError;
    }

    if (existing) {
      // Update existing profile
      console.log("Updating existing face profile");
      const { error } = await supabase
        .from("face_profiles")
        .update({
          face_image: imageBuffer,
          face_embedding: embedding,
          updated_at: new Date().toISOString(),
        })
        .eq("student_id", studentId);

      if (error) {
        console.error("Update error:", error);
        throw error;
      }

      return NextResponse.json({
        success: true,
        message: "Face profile updated successfully",
      });
    }

    // Insert new face profile
    console.log("Creating new face profile");
    const { error } = await supabase.from("face_profiles").insert({
      student_id: studentId,
      face_image: imageBuffer,
      face_embedding: embedding,
    });

    if (error) {
      console.error("Insert error:", error);
      throw error;
    }

    console.log("Face enrollment successful");
    return NextResponse.json({
      success: true,
      message: "Face enrolled successfully",
    });
  } catch (error) {
    console.error("Face enrollment error:", error);
    const errorMessage = error instanceof Error ? error.message : "Enrollment failed";
    console.error("Error details:", errorMessage);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
