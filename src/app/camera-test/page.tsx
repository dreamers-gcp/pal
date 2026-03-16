"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CameraTestPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [status, setStatus] = useState("Ready");

  const testCamera = async () => {
    try {
      setStatus("Requesting camera permission...");
      console.log("1. Starting camera request");

      const constraints = {
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      console.log("2. Constraints:", constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("3. Stream obtained:", stream);
      console.log("4. Video tracks:", stream.getVideoTracks());

      if (videoRef.current) {
        setStatus("Setting up video...");
        console.log("5. Video ref exists, setting srcObject");
        videoRef.current.srcObject = stream;

        videoRef.current.onloadedmetadata = () => {
          console.log("6. Metadata loaded, video readyState:", videoRef.current?.readyState);
          setStatus("Playing video...");

          videoRef.current?.play().then(() => {
            console.log("7. Video playing successfully");
            setStatus("✓ Camera working! Video is playing");
            setIsStreaming(true);
          }).catch((err) => {
            console.error("8. Play error:", err);
            setStatus("✗ Error: Failed to play video - " + err.message);
          });
        };

        videoRef.current.onerror = (err) => {
          console.error("Video error:", err);
          setStatus("✗ Video element error");
        };

        // Timeout check
        setTimeout(() => {
          if (videoRef.current) {
            console.log("9. After 3s - readyState:", videoRef.current.readyState);
            console.log("9. Video dimensions:", videoRef.current.videoWidth, "x", videoRef.current.videoHeight);
          }
        }, 3000);
      }
    } catch (error) {
      console.error("Camera access error:", error);
      const err = error as any;
      setStatus(`✗ Error: ${err.name || "Unknown"} - ${err.message}`);
    }
  };

  const stopStream = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setIsStreaming(false);
      setStatus("Stream stopped");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Camera Test Page</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Use this page to test if your camera is working. Check the browser console (F12) for detailed logs.
            </p>

            <div className="space-y-2">
              <div className="relative w-full bg-black rounded-lg overflow-hidden border-2 border-gray-300" style={{ aspectRatio: "16/9" }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  disablePictureInPicture
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-sm font-mono bg-slate-100 p-2 rounded">
                Status: <strong>{status}</strong>
              </p>
            </div>

            <div className="flex gap-2">
              <Button onClick={testCamera} disabled={isStreaming} className="flex-1">
                {isStreaming ? "Camera Running..." : "Test Camera"}
              </Button>
              <Button onClick={stopStream} disabled={!isStreaming} variant="destructive" className="flex-1">
                Stop Camera
              </Button>
            </div>

            <div className="text-xs text-muted-foreground space-y-1 bg-slate-50 p-3 rounded border">
              <p><strong>Troubleshooting:</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>Open browser console (F12) to see detailed logs</li>
                <li>Check if your browser asks for camera permission</li>
                <li>Ensure you selected "Allow" for camera access</li>
                <li>Try a different browser if this doesn't work</li>
                <li>Check if another app is using the camera</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
