#!/bin/bash

# Download face-api.js models from CDN
# These models are required for face detection and recognition

MODELS_DIR="public/models"

# Create models directory if it doesn't exist
mkdir -p "$MODELS_DIR"

echo "Downloading face-api models..."

# Models to download
MODELS=(
  "tiny_face_detector_model-weights_manifest.json"
  "tiny_face_detector_model-shard1"
  "face_landmark_68_model-weights_manifest.json"
  "face_landmark_68_model-shard1"
  "face_recognition_model-weights_manifest.json"
  "face_recognition_model-shard1"
  "face_expression_model-weights_manifest.json"
  "face_expression_model-shard1"
)

BASE_URL="https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model"

for model in "${MODELS[@]}"; do
  echo "Downloading $model..."
  curl -s -o "$MODELS_DIR/$model" "$BASE_URL/$model"
  if [ $? -eq 0 ]; then
    echo "✓ Downloaded $model"
  else
    echo "✗ Failed to download $model"
  fi
done

echo ""
echo "Face-api models download complete!"
echo "Models saved to: $MODELS_DIR"
ls -lh "$MODELS_DIR"
