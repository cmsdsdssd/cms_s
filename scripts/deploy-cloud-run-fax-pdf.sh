#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   NEXT_PUBLIC_SUPABASE_URL=... \
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
#   ./scripts/deploy-cloud-run-fax-pdf.sh <PROJECT_ID> <SERVICE_NAME>

PROJECT_ID="${1:-}"
SERVICE_NAME="${2:-cms-web}"
REGION="asia-northeast3"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:$(date +%Y%m%d-%H%M%S)"

NEXT_PUBLIC_SUPABASE_URL_VALUE="${NEXT_PUBLIC_SUPABASE_URL:-}"
NEXT_PUBLIC_SUPABASE_ANON_KEY_VALUE="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}"

if [[ -z "${PROJECT_ID}" ]]; then
  echo "PROJECT_ID is required"
  echo "Usage: ./scripts/deploy-cloud-run-fax-pdf.sh <PROJECT_ID> <SERVICE_NAME>"
  exit 1
fi

if [[ -z "${NEXT_PUBLIC_SUPABASE_URL_VALUE}" ]]; then
  echo "NEXT_PUBLIC_SUPABASE_URL is required"
  exit 1
fi

if [[ -z "${NEXT_PUBLIC_SUPABASE_ANON_KEY_VALUE}" ]]; then
  echo "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"
  exit 1
fi

echo "[1/4] Configure Docker auth"
gcloud auth configure-docker --quiet

echo "[2/4] Build image"
docker build \
  --build-arg "NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL_VALUE}" \
  --build-arg "NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY_VALUE}" \
  -t "${IMAGE}" ./web

echo "[3/4] Push image"
docker push "${IMAGE}"

echo "[4/4] Deploy Cloud Run"
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --platform managed \
  --allow-unauthenticated \
  --timeout 600 \
  --port 8080 \
  --update-env-vars "TZ=Asia/Seoul,NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL_VALUE},NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY_VALUE}" \
  --update-secrets "SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest"

echo "Done"
echo "Image: ${IMAGE}"
