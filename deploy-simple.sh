#!/bin/bash
set -e

echo "Building and deploying using simplified approach..."

# Build the Docker container locally using the simple Dockerfile
docker build -t azuki-tcg-simple -f Dockerfile.simple .

# Tag the container for Google Container Registry
docker tag azuki-tcg-simple gcr.io/kai-mailinh-dev/azuki-tcg-simple

# Push the container to Google Container Registry
docker push gcr.io/kai-mailinh-dev/azuki-tcg-simple

# Deploy to Cloud Run
gcloud run deploy azuki-tcg-simple \
  --image gcr.io/kai-mailinh-dev/azuki-tcg-simple \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --port 8080 \
  --set-env-vars="NODE_ENV=production" \
  --concurrency 80

echo "Deployment complete! Test your app at the URL above."
echo "You can visit [your-url]/test.html to check if the server is working."