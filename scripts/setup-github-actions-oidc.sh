#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/setup-github-actions-oidc.sh <PROJECT_ID> <GITHUB_OWNER> <GITHUB_REPO>
# Example:
#   ./scripts/setup-github-actions-oidc.sh cms-web-488112 trend7942 cms_s

PROJECT_ID="${1:-}"
GITHUB_OWNER="${2:-}"
GITHUB_REPO_NAME="${3:-}"

if [[ -z "${PROJECT_ID}" || -z "${GITHUB_OWNER}" || -z "${GITHUB_REPO_NAME}" ]]; then
  echo "Usage: $0 <PROJECT_ID> <GITHUB_OWNER> <GITHUB_REPO>"
  exit 1
fi

REGION="asia-northeast3"
AR_REPO="cms-web"
RUNTIME_SA_NAME="cms-web-sa"
DEPLOYER_SA_NAME="github-deployer"
POOL_ID="github-pool"
PROVIDER_ID="github-provider"

RUNTIME_SA="${RUNTIME_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
DEPLOYER_SA="${DEPLOYER_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
GITHUB_REPO="${GITHUB_OWNER}/${GITHUB_REPO_NAME}"

echo "[1/10] Set project"
gcloud config set project "${PROJECT_ID}"

PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"

echo "[2/10] Enable required APIs"
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  secretmanager.googleapis.com

echo "[3/10] Ensure Artifact Registry exists"
gcloud artifacts repositories describe "${AR_REPO}" --location "${REGION}" >/dev/null 2>&1 || \
gcloud artifacts repositories create "${AR_REPO}" \
  --repository-format=docker \
  --location "${REGION}" \
  --description "CMS web images"

echo "[4/10] Ensure deployer service account exists"
gcloud iam service-accounts describe "${DEPLOYER_SA}" >/dev/null 2>&1 || \
gcloud iam service-accounts create "${DEPLOYER_SA_NAME}" --display-name "GitHub Deployer"

echo "[5/10] Grant deploy permissions to deployer SA"
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member "serviceAccount:${DEPLOYER_SA}" \
  --role "roles/run.admin"

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member "serviceAccount:${DEPLOYER_SA}" \
  --role "roles/artifactregistry.writer"

gcloud iam service-accounts add-iam-policy-binding "${RUNTIME_SA}" \
  --member "serviceAccount:${DEPLOYER_SA}" \
  --role "roles/iam.serviceAccountUser"

echo "[6/10] Ensure workload identity pool exists"
gcloud iam workload-identity-pools describe "${POOL_ID}" --location global >/dev/null 2>&1 || \
gcloud iam workload-identity-pools create "${POOL_ID}" \
  --location global \
  --display-name "GitHub Pool"

echo "[7/10] Ensure workload identity provider exists"
gcloud iam workload-identity-pools providers describe "${PROVIDER_ID}" \
  --workload-identity-pool "${POOL_ID}" \
  --location global >/dev/null 2>&1 || \
gcloud iam workload-identity-pools providers create-oidc "${PROVIDER_ID}" \
  --workload-identity-pool "${POOL_ID}" \
  --location global \
  --issuer-uri "https://token.actions.githubusercontent.com" \
  --attribute-mapping "google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
  --attribute-condition "assertion.repository=='${GITHUB_REPO}' && assertion.ref=='refs/heads/main'"

echo "[8/10] Allow GitHub repo principal to impersonate deployer SA"
gcloud iam service-accounts add-iam-policy-binding "${DEPLOYER_SA}" \
  --role "roles/iam.workloadIdentityUser" \
  --member "principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository/${GITHUB_REPO}"

echo "[9/10] Ensure runtime SA can access required secrets"
for SECRET_NAME in SUPABASE_SERVICE_ROLE_KEY CLOUDFLARE_API_TOKEN GEMINI_API_KEY; do
  gcloud secrets add-iam-policy-binding "${SECRET_NAME}" \
    --member "serviceAccount:${RUNTIME_SA}" \
    --role "roles/secretmanager.secretAccessor" >/dev/null
done

echo "[10/10] Done. Configure GitHub Actions with values below"
WIF_PROVIDER="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/providers/${PROVIDER_ID}"
echo ""
echo "GitHub Actions -> Secrets"
echo "- GCP_WORKLOAD_IDENTITY_PROVIDER=${WIF_PROVIDER}"
echo "- GCP_SERVICE_ACCOUNT=${DEPLOYER_SA}"
echo "- NEXT_PUBLIC_SUPABASE_ANON_KEY=<your anon key>"
echo ""
echo "GitHub Actions -> Variables"
echo "- NEXT_PUBLIC_SUPABASE_URL=<your supabase url>"
echo "- NEXT_PUBLIC_CMS_ACTOR_ID=<actor uuid>"
echo "- NEXT_PUBLIC_CMS_ACTOR_TYPE=staff"
echo "- NEXT_PUBLIC_CMS_CORRELATION_ID=<correlation uuid>"
echo "- CLOUDFLARE_ACCOUNT_ID=<cloudflare account id>"
