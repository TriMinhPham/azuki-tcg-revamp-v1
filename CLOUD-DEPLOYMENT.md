# Cloud Deployment Guide for Azuki TCG Revamp

This guide explains how to deploy the Azuki TCG application to various cloud platforms.

## Key Files for Cloud Deployment

- `server-export.js` - The main serverless-compatible server with API routes
- `api/index.js` - The primary API handler for Vercel serverless functions
- `api/health.js` - A standalone health check API endpoint
- `vercel.json` - Configuration for Vercel deployment
- `vercel-build.js` - Special build script for Vercel deployment

## Vercel Deployment

Vercel is the recommended platform for deploying this application as it natively supports both the static frontend and serverless API endpoints.

### Deployment Steps

1. Make sure you have the Vercel CLI installed:
   ```
   npm install -g vercel
   ```

2. Log into Vercel:
   ```
   vercel login
   ```

3. Deploy to a preview environment:
   ```
   npm run deploy:vercel
   ```

4. Deploy to production:
   ```
   npm run deploy:vercel:prod
   ```

### Environment Variables

The following environment variables must be set in your Vercel project settings:

- `OPENSEA_API_KEY` - API key for OpenSea
- `GPT_API_KEY` - API key for OpenAI GPT
- `GOAPI_API_KEY` - API key for GoAPI

You can set these through the Vercel dashboard or using the CLI:
```
vercel env add OPENSEA_API_KEY
vercel env add GPT_API_KEY
vercel env add GOAPI_API_KEY
```

## Google Cloud Run Deployment

The application can also be deployed to Google Cloud Run using Docker.

### Deployment Steps

1. Build the Docker image:
   ```
   npm run docker:build
   ```

2. Deploy to Google Cloud Run:
   ```
   npm run deploy:docker
   ```

Make sure to set the environment variables in your Google Cloud Run service configuration.

## Troubleshooting

### API Endpoints Not Working

If API endpoints are not working, check the following:

1. Verify that all environment variables are correctly set in your cloud platform
2. Check the serverless function logs in your cloud platform dashboard
3. Test the `/api/health` endpoint to verify basic API functionality

### Static Assets Not Loading

If static assets fail to load:

1. Verify that the build completed successfully
2. Check that the static asset paths in the HTML are correct
3. Ensure the cloud platform is configured to serve static files from the correct directory

### Debugging Serverless Functions

To debug serverless functions locally before deployment:

1. Run the serverless-compatible server:
   ```
   npm run server:vercel
   ```

2. Test API endpoints at `http://localhost:3000/api/...`

## Architecture Notes

The application uses a hybrid architecture:

- Frontend: Static React app built with Vite
- Backend: Express server that can run both as:
  - A traditional server (server.js)
  - Serverless functions (server-export.js)

This hybrid approach allows deployment to various cloud platforms while maintaining a consistent development experience.