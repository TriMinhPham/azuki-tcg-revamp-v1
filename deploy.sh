#!/bin/bash
set -e

# Build the React app locally
echo "Building React application..."
npm run build

echo "Deploying to Google Cloud Run using the pre-built files..."
# Using Dockerfile-based deployment to ensure proper build
gcloud run deploy azuki-tcg \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --concurrency 80 \
  --timeout 300s \
  --set-build-env-vars="NODE_ENV=production"

echo "Deployment complete!"