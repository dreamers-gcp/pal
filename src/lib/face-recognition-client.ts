"use client";

let modelsLoaded = false;
let faceapi: typeof import("@vladmandic/face-api") | null = null;

/**
 * Lazy load face-api module (only in browser context)
 */
async function getFaceApi() {
  if (faceapi) return faceapi;
  
  try {
    faceapi = await import("@vladmandic/face-api");
    return faceapi;
  } catch (error) {
    console.error("Failed to load face-api module:", error);
    throw new Error("Face API library failed to load");
  }
}

/**
 * Load face-api models from public/models directory
 * This must be called in the browser context
 */
export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) {
    console.log("Face models already loaded");
    return;
  }

  try {
    const api = await getFaceApi();
    const MODEL_URL = "/models";
    console.log("Loading face detection models from:", MODEL_URL);

    await Promise.all([
      api.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      api.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      api.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      api.nets.faceExpressionNet.loadFromUri(MODEL_URL),
    ]);

    modelsLoaded = true;
    console.log("✓ Face API models loaded successfully");
  } catch (error) {
    console.error("Failed to load face API models:", error);
    throw new Error("Failed to load face detection models. Check that /public/models/ directory contains model files.");
  }
}

/**
 * Extract 128-dimensional face embedding from an image blob
 * Returns the embedding array ready to be sent to the backend
 */
export async function extractFaceEmbedding(imageBlob: Blob): Promise<number[]> {
  try {
    // Load models if not already loaded
    await loadFaceModels();
    
    const api = await getFaceApi();

    // Create image element from blob
    const url = URL.createObjectURL(imageBlob);
    const img = new Image();

    return new Promise((resolve, reject) => {
      img.onload = async () => {
        try {
          // Create canvas and draw image
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");

          if (!ctx) {
            throw new Error("Failed to get canvas context");
          }

          ctx.drawImage(img, 0, 0);

          // Detect face and extract descriptor
          console.log("Detecting face and extracting embedding...");
          const detection = await api
            .detectSingleFace(canvas, new api.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();

          URL.revokeObjectURL(url);

          if (!detection || !detection.descriptor) {
            throw new Error("No face detected in image. Please ensure your face is clearly visible and well-lit.");
          }

          // Convert descriptor to array
          const embedding = Array.from(detection.descriptor);
          console.log(
            "✓ Face embedding extracted successfully, dimensions:",
            embedding.length
          );

          resolve(embedding);
        } catch (error) {
          URL.revokeObjectURL(url);
          reject(error);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to load image"));
      };

      img.src = url;
    });
  } catch (error) {
    console.error("Face embedding extraction error:", error);
    throw error instanceof Error
      ? error
      : new Error("Failed to extract face embedding");
  }
}
