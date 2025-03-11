#!/bin/bash
set -e

# This script uses direct gcloud build and deploy approach,
# rather than the source-based deployment

# Set environment variables
export NODE_ENV=production

# Install all dependencies (including dev dependencies)
echo "Installing dependencies..."
rm -rf node_modules
npm install

# Create required directories first
echo "Creating necessary directories..."
mkdir -p cache/processed_images cache/split_images

# Build with vite and run optimization script
echo "Building application..."
npm run build

# Deploy to Google Cloud Run
echo "Deploying to Google Cloud Run..."
gcloud builds submit --config=cloudbuild.yaml

echo "Deployment complete!"