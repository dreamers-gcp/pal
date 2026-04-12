#!/usr/bin/env bash
# Deploy face-service to Google Cloud Run (public HTTPS URL).
# Prerequisites: gcloud CLI installed, `gcloud auth login`, billing enabled on project.
set -euo pipefail

PROJECT_ID="face-service-492917"
REGION="asia-south1" # Mumbai; use asia-south2 for Delhi
SERVICE="face-api"
REPO="face-service"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${SERVICE}:latest"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

gcloud config set project "${PROJECT_ID}"

gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com \
  --project="${PROJECT_ID}"

if ! gcloud artifacts repositories describe "${REPO}" --location="${REGION}" --project="${PROJECT_ID}" &>/dev/null; then
  gcloud artifacts repositories create "${REPO}" \
    --repository-format=docker \
    --location="${REGION}" \
    --project="${PROJECT_ID}" \
    --description="PAL face-service"
fi

gcloud builds submit --tag "${IMAGE}" "${ROOT}/face-service"

gcloud run deploy "${SERVICE}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --platform managed \
  --memory 4Gi \
  --cpu 2 \
  --timeout 120 \
  --max-instances 5 \
  --allow-unauthenticated

echo ""
echo "Set FACE_SERVICE_URL on your Next.js host to the Service URL above (no trailing slash)."
