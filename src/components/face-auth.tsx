"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, X, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { extractFaceEmbedding } from "@/lib/face-recognition-client";

interface FaceCaptureProps {
  onCapture: (imageData: Blob) => void;
  title?: string;
  description?: string;
}

export function FaceCapture({ onCapture, title = "Capture Face", description }: FaceCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const startCamera = async () => {
    setIsLoading(true);
    try {
      console.log("1. Requesting camera access...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "user",
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
        },
        audio: false,
      });

      console.log("2. Camera stream obtained:", stream);

      // First, set capturing state so video element renders
      setIsCapturing(true);
      
      // Then assign stream in next render cycle
      setTimeout(() => {
        if (videoRef.current) {
          console.log("3. Setting stream to video element...");
          videoRef.current.srcObject = stream;
          
          // Wait for video to load metadata
          const onLoadedMetadata = () => {
            console.log("4. Video metadata loaded, video dimensions:", videoRef.current?.videoWidth, "x", videoRef.current?.videoHeight);
            console.log("5. Calling play()...");
            
            videoRef.current?.play().then(() => {
              console.log("6. Video playing successfully");
              setIsLoading(false);
            }).catch((err) => {
              console.error("7. Video play error:", err);
              toast.error("Failed to start video playback: " + err.message);
              setIsLoading(false);
              stopCamera();
            });
            
            videoRef.current?.removeEventListener("loadedmetadata", onLoadedMetadata);
          };
          
          videoRef.current.addEventListener("loadedmetadata", onLoadedMetadata);
          
          // Timeout fallback - increased to 10 seconds
          setTimeout(() => {
            if (videoRef.current && videoRef.current.readyState === 0) {
              console.error("8. Video failed to load after 10 seconds, readyState:", videoRef.current.readyState);
              toast.error("Camera is taking longer than expected. Please try again.");
              setIsLoading(false);
              stopCamera();
            }
          }, 10000);
        }
      }, 0);
    } catch (error) {
      setIsLoading(false);
      setIsCapturing(false);
      const err = error as any;
      const message = 
        err.name === "NotAllowedError" ? "Camera permission denied. Please allow camera access." :
        err.name === "NotFoundError" ? "No camera found on this device." :
        "Unable to access camera. Please check permissions and try again.";
      console.error("Camera error details:", err);
      toast.error(message);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => {
        console.log("Stopping track:", track.kind);
        track.stop();
      });
      videoRef.current.srcObject = null;
      setIsCapturing(false);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const context = canvasRef.current.getContext("2d");
    if (!context) return;

    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;

    context.drawImage(videoRef.current, 0, 0);
    const imageData = canvasRef.current.toDataURL("image/jpeg");
    setCapturedImage(imageData);

    stopCamera();
    canvasRef.current.toBlob((blob) => {
      if (blob) onCapture(blob);
    }, "image/jpeg");
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    startCamera();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        <canvas ref={canvasRef} className="hidden" />

        {!isCapturing && !capturedImage && (
          <Button onClick={startCamera} className="w-full gap-2" disabled={isLoading}>
            <Camera className="h-4 w-4" />
            {isLoading ? "Initializing Camera..." : "Start Camera"}
          </Button>
        )}

        {isCapturing && (
          <div className="space-y-2">
            <div className="relative w-full bg-black rounded-lg overflow-hidden border-2 border-gray-300" style={{ aspectRatio: "16/9" }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                disablePictureInPicture
                className="w-full h-full object-cover"
                style={{ transform: "scaleX(-1)" }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">Position your face in the center and ensure good lighting</p>
            <div className="flex gap-2">
              <Button onClick={capturePhoto} className="flex-1" variant="default">
                📷 Capture Photo
              </Button>
              <Button
                onClick={stopCamera}
                className="flex-1"
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {capturedImage && (
          <div className="space-y-2">
            <img
              src={capturedImage}
              alt="Captured face"
              className="w-full rounded-lg"
            />
            <Button onClick={retakePhoto} className="w-full" variant="outline">
              <Camera className="h-4 w-4 mr-2" />
              Retake Photo
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface FaceEnrollProps {
  studentId: string;
  onSuccess?: () => void;
}

export function FaceEnrollment({ studentId, onSuccess }: FaceEnrollProps) {
  const [image, setImage] = useState<Blob | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleCapture = (blob: Blob) => {
    setImage(blob);
  };

  const handleEnroll = async () => {
    if (!image) {
      toast.error("Please capture a photo first");
      return;
    }

    setIsLoading(true);
    try {
      // Extract face embedding on the client side
      console.log("Extracting face embedding for enrollment...");
      toast.loading("Processing face...");
      
      let embedding: number[];
      try {
        embedding = await extractFaceEmbedding(image);
      } catch (embeddingError) {
        const errorMsg = embeddingError instanceof Error ? embeddingError.message : "Failed to extract face";
        console.error("Embedding extraction error:", embeddingError);
        toast.dismiss();
        throw new Error(errorMsg);
      }

      console.log("Embedding extracted, sending to server...");
      toast.loading("Enrolling face...");

      const formData = new FormData();
      formData.append("image", image);
      formData.append("studentId", studentId);
      formData.append("embedding", JSON.stringify(embedding));

      const response = await fetch("/api/face/enroll", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Enrollment failed");
      }

      toast.dismiss();
      setStatus({ type: "success", message: data.message });
      toast.success(data.message);
      setImage(null);
      onSuccess?.();
    } catch (error) {
      toast.dismiss();
      const message = error instanceof Error ? error.message : "Enrollment failed";
      setStatus({ type: "error", message });
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <FaceCapture
        onCapture={handleCapture}
        title="Enroll Your Face"
        description="This photo will be used to verify your attendance. Ensure good lighting and clear visibility of your face."
      />

      {image && (
        <Button
          onClick={handleEnroll}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? "Processing..." : "Enroll Face"}
        </Button>
      )}

      {status && (
        <div
          className={`flex items-start gap-3 p-4 rounded-lg ${
            status.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {status.type === "success" ? (
            <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          )}
          <div>
            <p className="font-medium">{status.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}

interface FaceVerifyProps {
  studentId: string;
  calendarRequestId: string;
  classroomId: string;
  onSuccess?: (data: any) => void;
}

export function FaceVerify({ studentId, calendarRequestId, classroomId, onSuccess }: FaceVerifyProps) {
  const [image, setImage] = useState<Blob | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    matched: boolean;
    confidence: number;
    threshold: number;
    message: string;
  } | null>(null);

  const handleCapture = (blob: Blob) => {
    setImage(blob);
  };

  const handleVerify = async () => {
    if (!image) {
      toast.error("Please capture a photo first");
      return;
    }

    setIsLoading(true);
    try {
      // Extract face embedding on the client side
      console.log("Extracting face embedding for verification...");
      toast.loading("Processing face...");
      
      let embedding: number[];
      try {
        embedding = await extractFaceEmbedding(image);
      } catch (embeddingError) {
        const errorMsg = embeddingError instanceof Error ? embeddingError.message : "Failed to extract face";
        console.error("Embedding extraction error:", embeddingError);
        toast.dismiss();
        throw new Error(errorMsg);
      }

      console.log("Embedding extracted, verifying...");
      toast.loading("Verifying attendance...");

      const formData = new FormData();
      formData.append("image", image);
      formData.append("studentId", studentId);
      formData.append("calendarRequestId", calendarRequestId);
      formData.append("classroomId", classroomId);
      formData.append("embedding", JSON.stringify(embedding));

      const response = await fetch("/api/face/verify", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Verification failed");
      }

      toast.dismiss();
      setResult({
        matched: data.matched,
        confidence: data.confidence,
        threshold: data.threshold,
        message: data.message,
      });

      if (data.matched) {
        toast.success(data.message);
        onSuccess?.(data);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.dismiss();
      const message = error instanceof Error ? error.message : "Verification failed";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <FaceCapture
        onCapture={handleCapture}
        title="Verify Your Face for Attendance"
        description="Capture your face for attendance verification. Ensure good lighting and clear visibility."
      />

      {image && (
        <Button
          onClick={handleVerify}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? "Verifying..." : "Verify Attendance"}
        </Button>
      )}

      {result && (
        <div
          className={`space-y-3 p-4 rounded-lg border ${
            result.matched
              ? "bg-green-50 border-green-200"
              : "bg-yellow-50 border-yellow-200"
          }`}
        >
          <div className="flex items-start gap-3">
            {result.matched ? (
              <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className={`font-medium ${result.matched ? "text-green-800" : "text-yellow-800"}`}>
                {result.message}
              </p>
              <p className={`text-sm mt-1 ${result.matched ? "text-green-700" : "text-yellow-700"}`}>
                Match confidence: {result.confidence}% (Required: {result.threshold}%)
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
