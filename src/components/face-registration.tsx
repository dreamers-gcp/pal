"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { WebcamCapture } from "@/components/webcam-capture";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, ScanFace, Trash2, X } from "lucide-react";
import { FaceRegistrationSkeleton } from "@/components/ui/loading-skeletons";
import { toast } from "sonner";
import type { FaceEmbedding } from "@/lib/types";

const MIN_PHOTOS = 3;
const MAX_PHOTOS = 5;
// Registration hardening: every captured photo must match the previously captured face(s).
// This prevents mixing two different people during registration.
const REGISTRATION_MATCH_THRESHOLD = 0.35;

function cosineSimilarity(a: number[], b: number[]): number {
  // Matches face-service logic (cosine similarity on normalized embeddings)
  const dot = a.reduce((acc, v, i) => acc + v * b[i], 0);
  const normA = Math.sqrt(a.reduce((acc, v) => acc + v * v, 0));
  const normB = Math.sqrt(b.reduce((acc, v) => acc + v * v, 0));
  return dot / (normA * normB + 1e-10);
}

interface Props {
  studentId: string;
  onRegistrationComplete?: () => void;
}

export function FaceRegistration({ studentId, onRegistrationComplete }: Props) {
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const [embeddings, setEmbeddings] = useState<FaceEmbedding[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  function killStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
  }

  async function openCamera() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = s;
      setStream(s);
    } catch {
      toast.error("Camera permission denied or unavailable.");
    }
  }

  const fetchEmbeddings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("face_embeddings")
        .select("*")
        .eq("student_id", studentId)
        .order("created_at", { ascending: true });
      if (error) {
        toast.error(`Could not load your face photos: ${error.message}`);
        setEmbeddings([]);
        return;
      }
      setEmbeddings(data ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Could not load your face photos: ${msg}`);
      setEmbeddings([]);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    fetchEmbeddings();
  }, [fetchEmbeddings]);

  async function handleCapture(blob: Blob) {
    killStream();
    setUploading(true);

    try {
      const filename = `${studentId}/${Date.now()}.jpg`;
      const { error: uploadErr } = await supabase.storage
        .from("face-photos")
        .upload(filename, blob, {
          contentType: "image/jpeg",
          upsert: false,
        });

      if (uploadErr) {
        toast.error("Failed to upload photo: " + uploadErr.message);
        setUploading(false);
        return;
      }

      const form = new FormData();
      form.append("file", blob, "face.jpg");
      const embRes = await fetch("/api/face/embedding", { method: "POST", body: form });
      const embData = await embRes.json();

      if (!embRes.ok) {
        await supabase.storage.from("face-photos").remove([filename]);
        toast.error(embData.error || "Could not process face");
        setUploading(false);
        return;
      }

      const newEmbedding = embData.embedding as number[];
      if (embeddings.length > 0) {
        const bestSim = Math.max(
          ...embeddings.map((e) => cosineSimilarity(newEmbedding, e.embedding))
        );

        if (bestSim < REGISTRATION_MATCH_THRESHOLD) {
          // Mismatch: likely a different person/photo mix. Reject this capture.
          await supabase.storage.from("face-photos").remove([filename]);
          toast.error(
            "This photo does not match your earlier captures. Please retake while only your face is visible."
          );
          setUploading(false);
          return;
        }
      }

      const { error: dbErr } = await supabase.from("face_embeddings").insert({
        student_id: studentId,
        photo_path: filename,
        embedding: newEmbedding,
      });

      if (dbErr) {
        toast.error("Failed to save embedding: " + dbErr.message);
        setUploading(false);
        return;
      }

      toast.success("Face photo registered!");
      await fetchEmbeddings();

      // Count directly from DB to avoid stale closure
      const { count } = await supabase
        .from("face_embeddings")
        .select("id", { count: "exact", head: true })
        .eq("student_id", studentId);

      if ((count ?? 0) >= MIN_PHOTOS) {
        await supabase
          .from("profiles")
          .update({ face_registered: true })
          .eq("id", studentId);
        onRegistrationComplete?.();
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto(emb: FaceEmbedding) {
    await supabase.storage.from("face-photos").remove([emb.photo_path]);
    await supabase.from("face_embeddings").delete().eq("id", emb.id);
    toast.success("Photo removed");
    const updated = embeddings.filter((e) => e.id !== emb.id);
    setEmbeddings(updated);

    if (updated.length < MIN_PHOTOS) {
      await supabase
        .from("profiles")
        .update({ face_registered: false })
        .eq("id", studentId);
    }
  }

  const registered = embeddings.length >= MIN_PHOTOS;

  if (loading) {
    return (
      <div className="py-2">
        <span className="sr-only">Loading face registration</span>
        <FaceRegistrationSkeleton />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ScanFace className="h-5 w-5" />
          <CardTitle className="text-lg">Face Registration</CardTitle>
          {registered && (
            <Badge
              variant="outline"
              className="ml-auto bg-accent/15 text-accent-foreground border-accent/30"
            >
              <CheckCircle2 className="h-3 w-3 mr-1" /> Registered
            </Badge>
          )}
        </div>
        <CardDescription>
          Take {MIN_PHOTOS}–{MAX_PHOTOS} clear photos of your face from
          slightly different angles. These will be used to verify your attendance.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Thumbnails */}
        {embeddings.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {embeddings.map((emb) => (
              <PhotoThumb
                key={emb.id}
                emb={emb}
                studentId={studentId}
                onRemove={() => removePhoto(emb)}
              />
            ))}
          </div>
        )}

        {/* Progress */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            {embeddings.length}/{MIN_PHOTOS} required photos
          </span>
          {embeddings.length < MIN_PHOTOS && (
            <span className="text-yellow-600 font-medium">
              — {MIN_PHOTOS - embeddings.length} more needed
            </span>
          )}
        </div>

        {/* Capture controls */}
        {embeddings.length < MAX_PHOTOS && (
          <>
            {uploading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Processing…
              </div>
            )}

            {stream ? (
              <WebcamCapture
                stream={stream}
                onCapture={handleCapture}
                onClose={killStream}
                buttonLabel="Capture face photo"
              />
            ) : (
              !uploading && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={openCamera}
                  className="gap-1.5"
                >
                  <ScanFace className="h-4 w-4" />
                  {embeddings.length === 0
                    ? "Start face registration"
                    : "Add another photo"}
                </Button>
              )
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PhotoThumb({
  emb,
  studentId,
  onRemove,
}: {
  emb: FaceEmbedding;
  studentId: string;
  onRemove: () => void;
}) {
  const supabase = createClient();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    supabase.storage
      .from("face-photos")
      .createSignedUrl(emb.photo_path, 300)
      .then(({ data }) => {
        if (data) setUrl(data.signedUrl);
      });
  }, [emb.photo_path, supabase, studentId]);

  return (
    <div className="relative group">
      <div className="w-20 h-20 rounded-lg overflow-hidden border bg-muted">
        {url ? (
          <img
            src={url}
            alt="Face"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
      <button
        onClick={onRemove}
        className="absolute -top-1.5 -right-1.5 bg-destructive text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
