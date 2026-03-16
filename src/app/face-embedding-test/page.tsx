"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function FaceEmbeddingTestPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [status, setStatus] = useState("Ready to test face embedding extraction");
  const [result, setResult] = useState<{
    embedding?: number[];
    error?: string;
    dimensions?: number;
    firstFive?: number[];
  } | null>(null);

  const startCamera = async () => {
    try {
      setStatus("Requesting camera...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsStreaming(true);
        setStatus("Camera ready - click 'Test Embedding' to extract face");
      }
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : "Camera access denied"}`);
    }
  };

  const testEmbedding = async () => {
    if (!videoRef.current) {
      setStatus("Video element not ready");
      return;
    }

    try {
      setStatus("Extracting embedding...");
      
      // Draw video frame to canvas
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      
      if (!ctx) {
        setStatus("Canvas context error");
        return;
      }

      ctx.drawImage(videoRef.current, 0, 0);

      // Convert canvas to blob and send to API
      canvas.toBlob(async (blob) => {
        if (!blob) {
          setStatus("Failed to capture image");
          return;
        }

        const formData = new FormData();
        formData.append("image", blob);
        formData.append("testMode", "true");

        // Create a simple test endpoint that extracts embeddings
        const response = await fetch("/api/face/test-embedding", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (response.ok && data.embedding) {
          const embedding = data.embedding;
          setResult({
            embedding,
            dimensions: embedding.length,
            firstFive: embedding.slice(0, 5),
          });
          setStatus("✓ Embedding extracted successfully!");
        } else {
          setResult({ error: data.error || "Failed to extract embedding" });
          setStatus("✗ Embedding extraction failed");
        }
      }, "image/jpeg");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      setResult({ error: errorMsg });
      setStatus("✗ Error: " + errorMsg);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setIsStreaming(false);
      setStatus("Camera stopped");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Face Embedding Extraction Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Test the face embedding extraction to verify face-api is working correctly.
            </p>

            <div className="relative w-full bg-black rounded-lg overflow-hidden border-2 border-gray-300" style={{ aspectRatio: "4/3" }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: "scaleX(-1)" }}
              />
            </div>

            <p className="text-sm font-mono bg-slate-100 p-2 rounded">
              Status: <strong>{status}</strong>
            </p>

            <div className="flex gap-2">
              <Button onClick={startCamera} disabled={isStreaming} className="flex-1">
                {isStreaming ? "Camera Running..." : "Start Camera"}
              </Button>
              <Button onClick={testEmbedding} disabled={!isStreaming} className="flex-1">
                Test Embedding
              </Button>
              <Button onClick={stopCamera} disabled={!isStreaming} variant="destructive" className="flex-1">
                Stop Camera
              </Button>
            </div>
          </CardContent>
        </Card>

        {result && (
          <Card className={result.error ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}>
            <CardHeader>
              <CardTitle className={result.error ? "text-red-600" : "text-green-600"}>
                {result.error ? "Error" : "Success"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {result.error ? (
                <p className="text-red-800">{result.error}</p>
              ) : (
                <>
                  <p className="text-green-800">
                    <strong>Embedding Dimensions:</strong> {result.dimensions}
                  </p>
                  <p className="text-green-800">
                    <strong>First 5 values:</strong>
                  </p>
                  <p className="font-mono text-sm text-green-700 bg-green-100 p-2 rounded">
                    {result.firstFive?.map((v) => v.toFixed(4)).join(", ")}
                  </p>
                  <p className="text-xs text-green-700">
                    ✓ Face detection working correctly. Embedding is ready for enrollment/verification.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
