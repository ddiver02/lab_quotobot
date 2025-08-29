#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   export GOOGLE_API_KEY=...                    # required
#   export NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co # required
#   export SUPABASE_SERVICE_ROLE_KEY=...          # required (server-side only)
#   export CORS_ORIGINS="https://your-app.vercel.app,https://preview-your-app.vercel.app" # optional
#   gcloud run deploy genkit-demo --image gcr.io/<project>/genkit-demo:latest \
#     --platform managed --region asia-northeast3 --allow-unauthenticated \
#     --set-env-vars GOOGLE_API_KEY="$GOOGLE_API_KEY",NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL",SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY"

if [[ -z "${GOOGLE_API_KEY:-}" || -z "${NEXT_PUBLIC_SUPABASE_URL:-}" || -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "Missing required envs: GOOGLE_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY" 1>&2
  exit 1
fi

ENV_VARS="GOOGLE_API_KEY=$GOOGLE_API_KEY,NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY"
if [[ -n "${CORS_ORIGINS:-}" ]]; then
  ENV_VARS+="\,CORS_ORIGINS=$CORS_ORIGINS"
fi

gcloud run deploy genkit-demo \
  --image gcr.io/testlab-470309/genkit-demo:latest \
  --platform managed \
  --region asia-northeast3 \
  --allow-unauthenticated \
  --set-env-vars "$ENV_VARS"
