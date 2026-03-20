"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, RotateCcw, X } from "lucide-react";

interface WebcamCaptureProps {
  onCapture: (blob: Blob) => void;
  onCancel?: () => void;
  buttonLabel?: string;
  mirrored?: boolean;
}

export function WebcamCapture({
  onCapture,
  onCancel,
  buttonLabel = "Capture Photo",
  mirrored = true,
}: WebcamCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pendingBlob = useRef<Blob | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      setActive(true);
    } catch {
      setError("Camera permission denied or unavailable.");
    }
  }, []);

  // Attach stream to video element once it's mounted (active becomes true)
  useEffect(() => {
    if (active && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [active]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  function captureFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    if (mirrored) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        pendingBlob.current = blob;
        setPreview(URL.createObjectURL(blob));
        stopCamera();
      },
      "image/jpeg",
      0.92
    );
  }

  function confirmCapture() {
    if (pendingBlob.current) {
      onCapture(pendingBlob.current);
      pendingBlob.current = null;
      setPreview(null);
    }
  }

  function retake() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    pendingBlob.current = null;
    startCamera();
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive space-y-2">
        <p>{error}</p>
        <Button size="sm" variant="outline" onClick={startCamera}>
          Try again
        </Button>
      </div>
    );
  }

  if (preview) {
    return (
      <div className="space-y-3">
        <div className="relative rounded-lg overflow-hidden border bg-black">
          <img src={preview} alt="Captured" className="w-full" />
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={retake} className="gap-1">
            <RotateCcw className="h-4 w-4" /> Retake
          </Button>
          <Button size="sm" onClick={confirmCapture} className="gap-1">
            <Camera className="h-4 w-4" /> Use this photo
          </Button>
          {onCancel && (
            <Button size="sm" variant="ghost" onClick={onCancel} className="gap-1 ml-auto">
              <X className="h-4 w-4" /> Cancel
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (!active) {
    return (
      <Button size="sm" onClick={startCamera} className="gap-1.5">
        <Camera className="h-4 w-4" /> {buttonLabel}
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative rounded-lg overflow-hidden border bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full"
          style={mirrored ? { transform: "scaleX(-1)" } : undefined}
        />
        <canvas ref={canvasRef} className="hidden" />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={captureFrame} className="gap-1">
          <Camera className="h-4 w-4" /> Snap
        </Button>
        <Button size="sm" variant="outline" onClick={stopCamera} className="gap-1">
          <X className="h-4 w-4" /> Close camera
        </Button>
      </div>
    </div>
  );
}
