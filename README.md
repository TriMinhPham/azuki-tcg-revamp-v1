# Azuki TCG Generator - Optimized

A React and Three.js-based trading card generator for Azuki NFTs. This version includes significant performance optimizations and architectural improvements.

## Optimized for Google Cloud Run

This project has been optimized for Google Cloud Run deployment with:
- Significantly reduced bundle size (~200MB down from ~300MB)
- Advanced asset loading and memory management
- Improved Docker-based deployment with multi-stage builds
- Enhanced build process with code splitting

## Development

```bash
# Install dependencies
npm install

# Start development server (frontend + backend)
npm start

# Start just the frontend
npm run dev

# Start just the backend
npm run server
```

## Production Build & Deployment

### Local Production Build

```bash
# Build the frontend (no TypeScript checking)
npm run build

# Build with TypeScript type checking
npm run build:check

# Analyze bundle size
npm run analyze

# Run in production mode
npm run prod
```

### Docker Deployment Options

```bash
# Build the optimized Docker image (recommended)
npm run docker:build:optimized

# Run the optimized Docker container
npm run docker:run:optimized

# Standard Docker build
npm run docker:build

# Run standard Docker container
npm run docker:run
```

### Google Cloud Run Deployment Options

We now have several optimized deployment methods:

```bash
# Option 1: Optimized Docker deployment (RECOMMENDED)
# - Smallest image size
# - Best performance
# - Most reliable
npm run deploy:optimized

# Option 2: Simple Docker deployment
# - Good performance
# - More reliable than source-based
npm run deploy:simple

# Option 3: Source-based deployment
# - May have TypeScript issues
# - Fastest deployment for small changes
npm run deploy:gcloud

# Option 4: Traditional deployment (not recommended)
npm run deploy
```

IMPORTANT: The direct `gcloud run deploy --source .` command often fails with TypeScript errors in this project. The recommended approach is to use our optimized Docker-based deployment.

## New Architecture Improvements

This optimized version introduces several key improvements:

### 1. Progressive Loading
- Loading stages for improved perceived performance
- Prioritized asset loading (critical resources first)
- Dynamic component imports with React Suspense

### 2. Memory Management
- Texture caching with LRU policy
- Automatic resource disposal
- Memory usage monitoring and optimization

### 3. Optimized Asset Delivery
- Compressed assets (Brotli and Gzip)
- Intelligent caching headers
- Prioritized loading queues

### 4. Bundle Optimization
- Aggressive code splitting
- Advanced tree shaking
- Dead code elimination
- Optimized Three.js imports

## Environment Variables

Create a .env file with the following variables:

```
OPENAI_API_KEY=your_openai_api_key
OPENSEA_API_KEY=your_opensea_api_key
GOAPI_API_KEY=your_goapi_api_key
PORT=8080
```

## New Utility Features

- **Memory Manager**: Tracks and disposes Three.js resources
- **Texture Loader**: Advanced texture loading with prioritization
- **Progressive Loading**: Staged asset loading for better UX
- **Lazy Component Loading**: Optimized component loading
- **Build Optimization**: Enhanced bundle optimization