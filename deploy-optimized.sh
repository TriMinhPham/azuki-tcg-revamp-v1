#!/bin/bash
set -e

echo "Building and deploying using optimized Docker image..."

# Set environment
export NODE_ENV=production

# Build the optimized Docker image locally
echo "Building optimized Docker image..."
docker build -t azuki-tcg-optimized -f Dockerfile.optimized .

# Tag the image for Google Container Registry
echo "Tagging image for GCR..."
docker tag azuki-tcg-optimized gcr.io/kai-mailinh-dev/azuki-tcg-optimized

# Push the image to Google Container Registry
echo "Pushing image to GCR..."
docker push gcr.io/kai-mailinh-dev/azuki-tcg-optimized

# Deploy the image to Cloud Run
echo "Deploying to Cloud Run..."
gcloud run deploy azuki-tcg \
  --image gcr.io/kai-mailinh-dev/azuki-tcg-optimized \
  --platform managed \
  --region us-central1 \
  --memory 1Gi \
  --cpu 1 \
  --allow-unauthenticated \
  --port 8080 \
  --timeout 300s \
  --concurrency 80 \
  --set-env-vars="NODE_ENV=production" \
  --min-instances=0 \
  --max-instances=10

echo "Deployment complete! Your optimized application is now available."