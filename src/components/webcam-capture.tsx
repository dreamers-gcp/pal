"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Camera, X } from "lucide-react";

interface WebcamCaptureProps {
  stream: MediaStream;
  onCapture: (blob: Blob) => void;
  onClose: () => void;
  buttonLabel?: string;
  mirrored?: boolean;
}

export function WebcamCapture({
  stream,
  onCapture,
  onClose,
  buttonLabel = "Capture Photo",
  mirrored = true,
}: WebcamCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
    return () => {
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [stream]);

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
        if (blob) onCapture(blob);
      },
      "image/jpeg",
      0.92
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
          <Camera className="h-4 w-4" /> {buttonLabel}
        </Button>
        <Button size="sm" variant="outline" onClick={onClose} className="gap-1">
          <X className="h-4 w-4" /> Close camera
        </Button>
      </div>
    </div>
  );
}
