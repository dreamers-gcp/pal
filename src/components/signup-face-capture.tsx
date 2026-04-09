"use client";

import { useRef, useState } from "react";
import { WebcamCapture } from "@/components/webcam-capture";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Camera, CheckCircle2, Loader2, ScanFace, X } from "lucide-react";
import { toast } from "sonner";

const MIN_PHOTOS = 3;
const MAX_PHOTOS = 5;
const REGISTRATION_MATCH_THRESHOLD = 0.35;

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((acc, v, i) => acc + v * b[i], 0);
  const normA = Math.sqrt(a.reduce((acc, v) => acc + v * v, 0));
  const normB = Math.sqrt(b.reduce((acc, v) => acc + v * v, 0));
  return dot / (normA * normB + 1e-10);
}

export interface CapturedFace {
  blob: Blob;
  embedding: number[];
  previewUrl: string;
}

interface Props {
  captures: CapturedFace[];
  onCapturesChange: (captures: CapturedFace[]) => void;
}

export function SignupFaceCapture({ captures, onCapturesChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const ready = captures.length >= MIN_PHOTOS;
  const canAddMore = captures.length < MAX_PHOTOS;

  function killStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setStream(null);
  }

  async function openCamera() {
    setCameraError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = s;
      setStream(s);
    } catch {
      setCameraError("Camera permission denied or unavailable.");
    }
  }

  async function handleCapture(blob: Blob) {
    killStream();
    setUploading(true);
    setLastError(null);

    try {
      const form = new FormData();
      form.append("file", blob, "face.jpg");
      const res = await fetch("/api/face/embedding", {
        method: "POST",
        body: form,
        headers: { "x-signup-flow": "1" },
      });
      const data = await res.json();

      if (!res.ok) {
        const msg = data.error || "Could not process face";
        setLastError(msg);
        toast.error(msg);
        return;
      }

      const newEmbedding = data.embedding as number[];

      if (captures.length > 0) {
        const bestSim = Math.max(
          ...captures.map((c) => cosineSimilarity(newEmbedding, c.embedding))
        );
        if (bestSim < REGISTRATION_MATCH_THRESHOLD) {
          const msg =
            "This photo does not match your earlier captures. Please retake with only your face visible.";
          setLastError(msg);
          toast.error(msg);
          return;
        }
      }

      const previewUrl = URL.createObjectURL(blob);
      onCapturesChange([
        ...captures,
        { blob, embedding: newEmbedding, previewUrl },
      ]);
      toast.success(`Photo ${captures.length + 1} of ${MIN_PHOTOS} captured!`);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to process photo";
      setLastError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

  function removeCapture(index: number) {
    URL.revokeObjectURL(captures[index].previewUrl);
    const next = captures.filter((_, i) => i !== index);
    onCapturesChange(next);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ScanFace className="h-5 w-5" />
          <CardTitle className="text-lg">Face Registration</CardTitle>
          {ready && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-accent/15 text-accent-foreground border border-accent/30 px-2.5 py-0.5 text-xs font-medium">
              <CheckCircle2 className="h-3 w-3" /> Ready
            </span>
          )}
        </div>
        <CardDescription>
          {ready
            ? "Face registration complete. You can add more photos or sign up now."
            : `Take ${MIN_PHOTOS} clear photos of your face from slightly different angles. Photo ${captures.length + 1} of ${MIN_PHOTOS}.`}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {captures.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {captures.map((c, i) => (
              <div key={i} className="relative group">
                <div className="w-20 h-20 rounded-lg overflow-hidden border bg-muted">
                  <img
                    src={c.previewUrl}
                    alt={`Face ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeCapture(i)}
                  className="absolute -top-1.5 -right-1.5 bg-destructive text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            {captures.length}/{MIN_PHOTOS} required photos
          </span>
          {captures.length < MIN_PHOTOS && (
            <span className="text-yellow-600 font-medium">
              — {MIN_PHOTOS - captures.length} more needed
            </span>
          )}
        </div>

        {lastError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {lastError}
          </div>
        )}

        {cameraError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {cameraError}
          </div>
        )}

        {uploading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Processing photo…
          </div>
        )}

        {!uploading && stream && (
          <WebcamCapture
            stream={stream}
            onCapture={handleCapture}
            onClose={killStream}
            buttonLabel={`Capture photo ${captures.length + 1}`}
          />
        )}

        {!uploading && !stream && canAddMore && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={openCamera}
            className="gap-1.5"
          >
            <Camera className="h-4 w-4" />
            {captures.length === 0
              ? "Open camera to capture photo"
              : `Capture photo ${captures.length + 1}`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
