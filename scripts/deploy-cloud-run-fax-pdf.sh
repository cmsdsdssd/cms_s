#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/deploy-cloud-run-fax-pdf.sh <PROJECT_ID> <SERVICE_NAME>

PROJECT_ID="${1:-}"
SERVICE_NAME="${2:-cms-web}"
REGION="asia-northeast3"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:$(date +%Y%m%d-%H%M%S)"

if [[ -z "${PROJECT_ID}" ]]; then
  echo "PROJECT_ID is required"
  echo "Usage: ./scripts/deploy-cloud-run-fax-pdf.sh <PROJECT_ID> <SERVICE_NAME>"
  exit 1
fi

echo "[1/3] Build image"
gcloud builds submit ./web --tag "${IMAGE}" --project "${PROJECT_ID}"

echo "[2/3] Deploy Cloud Run"
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --platform managed \
  --allow-unauthenticated \
  --timeout 600 \
  --port 8080 \
  --set-env-vars TZ=Asia/Seoul

echo "[3/3] Done"
echo "Image: ${IMAGE}"
