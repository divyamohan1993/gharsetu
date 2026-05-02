#!/usr/bin/env bash
# GharSetu — one-shot Cloud Run deploy.
# Usage:  ./deploy.sh PROJECT_ID [REGION] [SERVICE]
#   or:   PROJECT_ID=foo REGION=asia-south1 SERVICE=gharsetu ./deploy.sh
set -euo pipefail

# ---------- args / env ------------------------------------------------------
PROJECT_ID="${1:-${PROJECT_ID:-}}"
REGION="${2:-${REGION:-asia-south1}}"
SERVICE="${3:-${SERVICE:-gharsetu}}"
REPO="${REPO:-gharsetu-images}"

if [[ -z "${PROJECT_ID}" ]]; then
  echo "ERROR: PROJECT_ID is required."
  echo "Usage: $0 PROJECT_ID [REGION] [SERVICE]"
  exit 1
fi

# ---------- helpers ---------------------------------------------------------
log()  { printf '\033[1;34m[deploy]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[deploy]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[deploy]\033[0m %s\n' "$*" >&2; exit 1; }

need() { command -v "$1" >/dev/null 2>&1 || die "Required command '$1' not found in PATH."; }

need gcloud
need openssl

# ---------- gcloud sanity ---------------------------------------------------
ACTIVE_ACCOUNT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' || true)"
[[ -n "${ACTIVE_ACCOUNT}" ]] || die "Run 'gcloud auth login' first."
log "Active account: ${ACTIVE_ACCOUNT}"

log "Setting project to ${PROJECT_ID}"
gcloud config set project "${PROJECT_ID}" >/dev/null

PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
CB_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

# ---------- enable services -------------------------------------------------
log "Enabling required GCP services (idempotent)"
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  --project="${PROJECT_ID}"

# ---------- artifact registry ----------------------------------------------
if ! gcloud artifacts repositories describe "${REPO}" --location="${REGION}" >/dev/null 2>&1; then
  log "Creating Artifact Registry repo ${REPO} in ${REGION}"
  gcloud artifacts repositories create "${REPO}" \
    --repository-format=docker \
    --location="${REGION}" \
    --description="GharSetu container images"
else
  log "Artifact Registry repo ${REPO} already exists."
fi

# ---------- secrets ---------------------------------------------------------
ensure_secret() {
  local name="$1"
  local value="$2"
  if gcloud secrets describe "${name}" >/dev/null 2>&1; then
    log "Secret ${name} already exists; skipping create."
  else
    log "Creating secret ${name}"
    printf '%s' "${value}" | gcloud secrets create "${name}" \
      --replication-policy=automatic \
      --data-file=-
  fi
  log "Granting secretAccessor on ${name} to ${RUNTIME_SA}"
  gcloud secrets add-iam-policy-binding "${name}" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/secretmanager.secretAccessor" \
    --quiet >/dev/null
}

prompt_secret() {
  local label="$1"
  local default="$2"
  local val=""
  if [[ -t 0 ]]; then
    read -r -s -p "Enter value for ${label} (press Enter to use default): " val
    echo
  fi
  if [[ -z "${val}" ]]; then val="${default}"; fi
  printf '%s' "${val}"
}

JWT_DEFAULT="$(openssl rand -hex 48)"
RZP_WEBHOOK_DEFAULT="$(openssl rand -hex 32)"

ensure_secret "jwt-secret"          "$(prompt_secret 'JWT_SECRET'           "${JWT_DEFAULT}")"
ensure_secret "rzp-secret"          "$(prompt_secret 'RZP_KEY_SECRET'       'simulated_secret_replace_me')"
ensure_secret "rzp-webhook-secret"  "${RZP_WEBHOOK_DEFAULT}"
ensure_secret "digilocker-secret"   "$(prompt_secret 'DIGILOCKER_CLIENT_SECRET' 'simulated_dl_secret_replace_me')"
ensure_secret "admin-password"      "$(prompt_secret 'ADMIN_PASSWORD'       'ChangeMe!2026')"

# ---------- cloud build IAM -------------------------------------------------
log "Granting Cloud Build SA roles (run.admin + iam.serviceAccountUser)"
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${CB_SA}" \
  --role="roles/run.admin" \
  --quiet >/dev/null
gcloud iam service-accounts add-iam-policy-binding "${RUNTIME_SA}" \
  --member="serviceAccount:${CB_SA}" \
  --role="roles/iam.serviceAccountUser" \
  --quiet >/dev/null

# ---------- build + deploy --------------------------------------------------
log "Submitting Cloud Build (this builds + pushes + deploys)"
gcloud builds submit \
  --config cloudbuild.yaml \
  --substitutions="_REGION=${REGION},_REPO=${REPO},_SERVICE=${SERVICE}" \
  .

# ---------- show URL --------------------------------------------------------
URL="$(gcloud run services describe "${SERVICE}" \
  --region="${REGION}" \
  --platform=managed \
  --format='value(status.url)')"

log "Deploy complete."
log "Service URL: ${URL}"
