const express = require("express");
const fetch = require("node-fetch");
const fsSync = require("fs");
const fs = require("fs").promises;
const path = require("path");
const zlib = require("zlib");
require("dotenv").config();

// Load prompts from external JSON file
const promptsFilePath = path.join(__dirname, 'prompts.json');
let PROMPTS = {};

// Function to load prompts from the JSON file
async function loadPrompts() {
  try {
    const promptsData = await fs.readFile(promptsFilePath, 'utf8');
    PROMPTS = JSON.parse(promptsData);
    console.log("Prompts loaded successfully from", promptsFilePath);
  } catch (err) {
    console.error("Error loading prompts:", err);
    // Set default prompts as fallback from src/config/prompts.ts
    PROMPTS = {
      imageAnalysis: "Describe the character in the image with given cues {traits} focus on appearance, specify male or female, output like this: \"female, hairstyle, eyes, facial features, outfit, weapon, anything special in the background\"",
      cardDetails: "You are a creative card designer...", // abbreviated for brevity
      fullBodyArt: "a full-body anime episode wide angle shot of {description} --niji 6 --ar 5:8",
      fullBodyArtV2: "a full-body anime episode wide angle shot of {description} --niji 6 --ar 5:8 --p mx5sxok"
    };
  }
}

// Initialize Express with compression
const app = express();

// Custom compression middleware that serves pre-compressed files when available
const usePrecompressedAssets = (req, res, next) => {
  const acceptEncoding = req.headers['accept-encoding'] || '';
  const originalPath = req.path;
  
  // Skip for API requests and non-static files
  if (originalPath.startsWith('/api/') || 
      !originalPath.match(/\.(js|css|html|svg|json|woff2|woff|ttf|eot)$/)) {
    return next();
  }
  
  const filePath = path.join(__dirname, 'dist', originalPath);
  
  // Serve Brotli version if supported
  if (acceptEncoding.includes('br')) {
    const brPath = path.join(__dirname, 'dist', 'compressed', originalPath + '.br');
    
    if (fsSync.existsSync(brPath)) {
      res.set('Content-Encoding', 'br');
      res.set('Content-Type', getContentType(originalPath));
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
      return fsSync.createReadStream(brPath).pipe(res);
    }
  }
  
  // Serve Gzip version if supported
  if (acceptEncoding.includes('gzip')) {
    const gzipPath = path.join(__dirname, 'dist', 'compressed', originalPath + '.gz');
    
    if (fsSync.existsSync(gzipPath)) {
      res.set('Content-Encoding', 'gzip');
      res.set('Content-Type', getContentType(originalPath));
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
      return fsSync.createReadStream(gzipPath).pipe(res);
    }
  }
  
  // If no pre-compressed version is available, proceed to next middleware
  next();
};

// Helper to get content type for different file extensions
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  switch(ext) {
    case '.js': return 'application/javascript';
    case '.css': return 'text/css';
    case '.html': return 'text/html';
    case '.json': return 'application/json';
    case '.svg': return 'image/svg+xml';
    case '.woff': return 'font/woff';
    case '.woff2': return 'font/woff2';
    case '.ttf': return 'font/ttf';
    case '.eot': return 'application/vnd.ms-fontobject';
    default: return 'text/plain';
  }
}

// Apply middleware
app.use(usePrecompressedAssets);

// Add a specific route for index.html with version parameter
app.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  // Check if dist/index.html exists (React app is built)
  if (fsSync.existsSync(path.join(__dirname, 'dist', 'index.html'))) {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  } else {
    // Fall back to legacy HTML if React app is not built
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// Create a new route with the updated version
app.get('/v2', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  // Send the HTML directly with the version in the title
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    <title>Azuki TCG Generator v0.2.2 - Mar 8, 2025 23:56</title>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet">
    <link href="styles.css" rel="stylesheet">
    <script src="script.js" defer></script>
</head>
<body>
    <div id="app-container">
        <h1>Azuki TCG Generator v0.2.2</h1>
        <p>Access the updated version at <a href="/"><strong>home page</strong></a></p>
    </div>
</body>
</html>`);
});

// Configure JSON parsing and body size limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Define asset cache durations based on file types
const CACHE_DURATIONS = {
  // Long cache for hashed assets (1 year)
  immutable: 31536000000,
  // Medium cache for relatively stable assets (1 week)
  medium: 604800000,
  // Short cache for potentially changing assets (1 day)
  short: 86400000, 
  // No cache for dynamic content
  dynamic: 0
};

// Serve static files from the React app build directory with optimized caching
app.use(express.static(path.join(__dirname, 'dist'), {
  etag: true,
  lastModified: true,
  // Set different max-age based on file patterns
  setHeaders: (res, filePath) => {
    // Use file extension to determine cache duration
    if (filePath.match(/\.(js|css|woff2|woff|ttf|svg|eot|png|jpg|jpeg|gif|webp|avif)$/)) {
      // Assets with hashed filenames get long cache
      if (filePath.match(/\.[a-f0-9]{8,}\.(?:js|css|png|jpg|jpeg|gif|webp|avif)/)) {
        res.setHeader('Cache-Control', `public, max-age=${CACHE_DURATIONS.immutable / 1000}, immutable`);
      } else {
        // Non-hashed assets get medium cache with validation
        res.setHeader('Cache-Control', `public, max-age=${CACHE_DURATIONS.medium / 1000}, stale-while-revalidate=86400`);
      }
    } else if (filePath.match(/\.(html|json|xml|txt)$/)) {
      // Documents get short cache with revalidation
      res.setHeader('Cache-Control', `public, max-age=${CACHE_DURATIONS.short / 1000}, must-revalidate`);
    } else {
      // Default no-cache for unrecognized types
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// Serve static files from public directory (legacy support with short cache)
app.use(express.static("public", {
  etag: true,
  maxAge: CACHE_DURATIONS.short,
  lastModified: true
}));

// Add a catch-all route for the React SPA
app.use('*', (req, res, next) => {
  // Skip API routes and static files
  if (req.originalUrl.startsWith('/api/') || 
      req.originalUrl.startsWith('/static/') ||
      req.originalUrl.includes('.')) {
    return next();
  }
  
  // Check if dist/index.html exists (React app is built)
  if (fsSync.existsSync(path.join(__dirname, 'dist', 'index.html'))) {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  } else {
    // Continue to next middleware if React app is not built
    next();
  }
});

// Add proper CORS headers
// CORS and caching middleware
app.use((req, res, next) => {
  // Allow requests from the development server during local development
  const allowedOrigins = ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'];
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
  
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Add no-cache headers for HTML files
  if (req.path === '/' || req.path.endsWith('.html')) {
    res.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.header('Pragma', 'no-cache');
    res.header('Expires', '0');
    res.header('Surrogate-Control', 'no-store');
  }
  
  // Log request information for debugging
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`, {
    origin: req.headers.origin,
    referer: req.headers.referer,
    host: req.headers.host
  });
  
  // Handle OPTIONS requests for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Image proxy endpoint to fix CORS issues
app.get("/api/proxy-image", async (req, res) => {
  let imageUrl = req.query.url;
  const thumbnail = req.query.thumbnail === '1';
  const quality = req.query.quality || 'high';
  const isMidjourneyFallback = req.query.midjourney === 'true';
  
  if (!imageUrl) {
    return res.status(400).send("No URL provided");
  }
  
  // Handle URL decoding issues
  try {
    // If the URL might be double-encoded
    if (imageUrl.includes('%25')) {
      imageUrl = decodeURIComponent(imageUrl);
    }
    
    // Handle relative URLs for split images
    if (imageUrl.startsWith('/api/split-images/')) {
      const filename = imageUrl.replace('/api/split-images/', '');
      const filePath = path.join(CACHE_DIR, 'split_images', filename);
      
      console.log(`Serving split image via proxy: ${filePath}`);
      
      // Check if file exists
      try {
        await fs.access(filePath);
      } catch (err) {
        return res.status(404).send("Split image not found");
      }
      
      // Set advanced caching headers for split images
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable'); // Cache for 7 days
      res.setHeader('ETag', `"${filename}-${fsSync.statSync(filePath).size}"`);
      res.setHeader('Expires', new Date(Date.now() + 604800000).toUTCString()); // 7 days
      res.setHeader('Last-Modified', fsSync.statSync(filePath).mtime.toUTCString());
      
      // Stream the file
      const fileStream = fsSync.createReadStream(filePath);
      return fileStream.pipe(res);
    }
    
    console.log("Proxying image:", imageUrl);
    
    // Special handling for common image CDNs
    const isGoApiUrl = imageUrl.includes('theapi.app') || imageUrl.includes('img.theapi.app');
    const isMidjourneyUrl = imageUrl.includes('cdn.midjourney.com') || imageUrl.includes('midjourney');
    
    console.log("URL type: GoAPI=", isGoApiUrl, "Midjourney=", isMidjourneyUrl);
    console.log(`[PROXY] Proxying image request at ${new Date().toISOString()}: ${imageUrl.substring(0, 100)}${imageUrl.length > 100 ? '...' : ''}`);
    
    // Rewrite Midjourney URL to use direct scheme if needed and apply special fix
    if (isMidjourneyUrl) {
      // Apply special caching fix for Midjourney - regenerate the URL with a fresh token
      // This is a known issue with their CDN throttling requests
      const mjUrlMatch = imageUrl.match(/cdn\.midjourney\.com\/([a-f0-9-]+)\/(?:0_0\.png|[^\/]+\.png)$/i);
      if (mjUrlMatch) {
        const assetId = mjUrlMatch[1];
        const nowTimestamp = Date.now();
        // Check if this is a special midjourney retry request
        if (req.query.midjourney === 'true') {
          // Add special parameters for retry attempts
          imageUrl = `https://cdn.midjourney.com/${assetId}/0_0.png?timestamp=${nowTimestamp}&retry=true`;
          console.log(`[PROXY] Enhanced Midjourney URL for retry request, asset ID ${assetId}: ${imageUrl}`);
        } else {
          // Standardize URL format regardless of input to prevent caching issues
          imageUrl = `https://cdn.midjourney.com/${assetId}/0_0.png?timestamp=${nowTimestamp}`;
          console.log(`[PROXY] Standardized Midjourney URL for asset ID ${assetId}: ${imageUrl}`);
        }
      } else if (imageUrl.startsWith('//')) {
        imageUrl = 'https:' + imageUrl;
        console.log(`[PROXY] Fixed Midjourney URL scheme: ${imageUrl}`);
      } else if (!imageUrl.startsWith('http')) {
        imageUrl = 'https://' + imageUrl;
        console.log(`[PROXY] Added https to Midjourney URL: ${imageUrl}`);
      } else if (imageUrl.includes('timestamp=')) {
        // URL already has a timestamp parameter, just log it
        console.log(`[PROXY] Using pre-timestamped Midjourney URL: ${imageUrl}`);
      } else if (!imageUrl.includes('?')) {
        // Add timestamp parameter if URL doesn't have any parameters
        imageUrl = `${imageUrl}?timestamp=${Date.now()}`;
        console.log(`[PROXY] Added timestamp to Midjourney URL: ${imageUrl}`);
      } else {
        // Add timestamp parameter if URL already has parameters
        imageUrl = `${imageUrl}&timestamp=${Date.now()}`;
        console.log(`[PROXY] Added timestamp to parameterized Midjourney URL: ${imageUrl}`);
      }
    }
    
    const headers = {
      // Add common headers to avoid being blocked
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };
    
    // Add additional headers based on image source
    if (isGoApiUrl) {
      console.log("[PROXY] Adding special headers for GoAPI");
      headers['x-api-key'] = process.env.GOAPI_API_KEY;
    }
    
    if (isMidjourneyUrl) {
      console.log("[PROXY] Adding special headers for Midjourney CDN");
      // Add Midjourney CDN specific headers
      headers['Origin'] = 'https://www.midjourney.com';
      headers['Referer'] = 'https://www.midjourney.com/';
      headers['Accept'] = 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8';
      headers['sec-fetch-dest'] = 'image';
      headers['sec-fetch-mode'] = 'no-cors';
      headers['sec-fetch-site'] = 'cross-site';
      
      // Special handling for fallback Midjourney URLs (second proxy attempt)
      if (isMidjourneyFallback) {
        console.log("[PROXY] Using ENHANCED Midjourney headers for fallback attempt");
        // Add additional browser-like headers to avoid being blocked
        headers['Accept-Language'] = 'en-US,en;q=0.9';
        headers['Connection'] = 'keep-alive';
        headers['DNT'] = '1';
        headers['sec-ch-ua'] = '"Chromium";v="116", "Not A Brand";v="24"';
        headers['sec-ch-ua-mobile'] = '?0';
        headers['sec-ch-ua-platform'] = '"macOS"';
      }
      
      // Remove cache headers which might help with Midjourney CDN
      delete headers['Cache-Control'];
      delete headers['Pragma'];
    }
    
    const response = await fetch(imageUrl, { headers });
    
    if (!response.ok) {
      console.error(`Image fetch failed: ${response.status} - ${response.statusText}`);
      
      // Special handling for Midjourney URLs that might be temporarily unavailable
      if (isMidjourneyUrl) {
        console.log("[PROXY] Detected Midjourney CDN failure, attempting alternate method");
        
        try {
          // For Midjourney URLs, try to create a placeholder with similar dimensions
          // that shows it's a temporary issue, not a permanent failure
          
          // Extract the ID for tracking purposes
          const mjIdMatch = imageUrl.match(/\/([a-f0-9-]+)\/\d+_\d+\.png/);
          // Handle more URL formats
          const mjIdAltMatch = !mjIdMatch && imageUrl.includes('cdn.midjourney.com') ? 
                              imageUrl.match(/cdn\.midjourney\.com\/([a-f0-9-]+)/) : null;
          const mjId = mjIdMatch ? mjIdMatch[1] : (mjIdAltMatch ? mjIdAltMatch[1] : 'unknown');
          
          // Check if this is a second attempt (enhanced fallback) for Midjourney URL
          if (isMidjourneyFallback) {
            console.log("[PROXY] This is a special fallback attempt for Midjourney - trying more aggressive approach");
            
            // Try a different CDN URL format - sometimes works better
            const originalId = mjIdMatch ? mjIdMatch[1] : imageUrl.split('/').pop().split('.')[0];
            const alternateUrl = `https://cdn.midjourney.com/${originalId}/0_0.png`;
            console.log(`[PROXY] Trying alternate Midjourney CDN URL: ${alternateUrl}`);
            
            try {
              const altResponse = await fetch(alternateUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
                  'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                  'Origin': 'https://www.midjourney.com',
                  'Referer': 'https://www.midjourney.com/',
                  'Accept-Language': 'en-US,en;q=0.9',
                  'sec-fetch-dest': 'image',
                  'sec-fetch-mode': 'no-cors',
                  'sec-fetch-site': 'cross-site',
                  'Connection': 'keep-alive'
                }
              });
              
              if (altResponse.ok) {
                console.log("[PROXY] Alternate Midjourney URL worked!");
                res.setHeader('Content-Type', altResponse.headers.get('content-type') || 'image/png');
                res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
                res.setHeader('X-Image-Alternate', 'midjourney-cdn-alternate');
                return altResponse.body.pipe(res);
              }
            } catch (altError) {
              console.error("[PROXY] Alternate Midjourney URL approach failed:", altError);
            }
          }
          
          // Try to fetch a placeholder from placehold.co that's visually similar
          const placeholderUrl = `https://placehold.co/600x800/3A0465/FFFFFF?text=Midjourney+Image+Unavailable%0A${mjId.substring(0,8)}`;
          console.log(`[PROXY] Trying Midjourney placeholder: ${placeholderUrl}`);
          
          const placeholderResponse = await fetch(placeholderUrl);
          
          if (placeholderResponse.ok) {
            console.log("[PROXY] Successfully fetched Midjourney placeholder");
            // Set proper MIME type
            res.setHeader('Content-Type', 'image/png');
            // Add special header to mark this as a fallback
            res.setHeader('X-Image-Fallback', 'midjourney-cdn-unavailable');
            // Return the placeholder
            return placeholderResponse.body.pipe(res);
          }
        } catch (mjError) {
          console.error("[PROXY] Midjourney fallback error:", mjError);
        }
      }
      
      return res.status(response.status).send(`Image fetch failed: ${response.statusText}`);
    }
    
    const contentType = response.headers.get("content-type") || 'image/png';
    console.log(`[PROXY] Image fetch successful with content type: ${contentType}`);
    
    // Set response headers
    res.setHeader("Content-Type", contentType);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=86400"); // Cache for 24 hours
    
    try {
      // Debug headers
      console.log(`[PROXY] Response headers:`, 
        Object.fromEntries([...response.headers.entries()]));
      console.log(`[PROXY] Content type: ${response.headers.get('content-type')}`);
      console.log(`[PROXY] Content length: ${response.headers.get('content-length')}`);
      
      // Detect content issues (zero-length responses from Midjourney)
      if (isMidjourneyUrl && (!response.headers.get('content-length') || parseInt(response.headers.get('content-length')) === 0)) {
        console.warn("[PROXY] Detected empty/zero-length Midjourney response");
        
        // Return a placeholder image instead
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('X-Image-Fallback', 'midjourney-empty-response');
        
        // Create and send a placeholder message
        const placeholderUrl = "https://placehold.co/600x800/3A0465/FFFFFF?text=Midjourney+Image+Temporarily+Unavailable";
        
        try {
          console.log("[PROXY] Fetching placeholder for empty Midjourney response");
          const placeholderResponse = await fetch(placeholderUrl);
          
          if (placeholderResponse.ok) {
            console.log("[PROXY] Streaming placeholder image for empty Midjourney response");
            placeholderResponse.body.pipe(res);
            return;
          }
        } catch (placeholderError) {
          console.error("[PROXY] Error getting placeholder:", placeholderError);
        }
        
        // If we couldn't get a placeholder, just return an error message
        return res.status(502).send("Midjourney image temporarily unavailable. Please try again later.");
      }
      
      // Add monitoring for potential timeouts
      const streamTimeout = setTimeout(() => {
        console.error(`[PROXY] Stream timeout after 30s for URL: ${imageUrl}`);
      }, 30000);
      
      // Improved image streaming with caching and potential resizing
      console.log(`[PROXY] Optimized streaming for image from ${imageUrl.substring(0, 100)}...`);
      console.log(`[PROXY] Thumbnail requested: ${thumbnail}, Quality: ${quality}`);
      
      // If thumbnail mode is requested, process the image with sharp
      if (thumbnail) {
        try {
          // Buffer the response to process with sharp
          const imageBuffer = await response.arrayBuffer();
          console.log(`[PROXY] Processing thumbnail from buffer of ${imageBuffer.byteLength} bytes`);
          
          // Process with sharp library to generate optimized thumbnail
          const thumbnailBuffer = await sharp(Buffer.from(imageBuffer))
            .resize({
              width: quality === 'low' ? 200 : 400, // Low quality or medium quality
              height: quality === 'low' ? 280 : 560,
              fit: 'inside',
              withoutEnlargement: true
            })
            .webp({ quality: quality === 'low' ? 40 : 70 }) // Lower quality for faster loading
            .toBuffer();
          
          // Set appropriate headers for the transformed image
          res.setHeader('Content-Type', 'image/webp');
          res.setHeader('Content-Length', thumbnailBuffer.length);
          res.setHeader('Cache-Control', 'public, max-age=86400, immutable, stale-while-revalidate=43200');
          res.setHeader('ETag', `"thumbnail-${Buffer.from(imageUrl).toString('base64').substring(0, 12)}-${quality}"`);
          res.setHeader('Expires', new Date(Date.now() + 86400000).toUTCString());
          res.setHeader('X-Thumbnail', 'true');
          
          // Send the thumbnail directly
          console.log(`[PROXY] Sending WebP thumbnail (${thumbnailBuffer.length} bytes, quality=${quality})`);
          res.send(thumbnailBuffer);
          
          // Clean up the timeout
          clearTimeout(streamTimeout);
          return;
        } catch (thumbError) {
          console.error(`[PROXY] Thumbnail generation error: ${thumbError.message}`, thumbError);
          console.log(`[PROXY] Falling back to standard image proxy`);
          // Continue with standard proxy if thumbnail fails
        }
      }
      
      // Set optimized cache control headers for regular images
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable, stale-while-revalidate=43200');
      res.setHeader('ETag', `"${Buffer.from(imageUrl).toString('base64').substring(0, 16)}"`);
      res.setHeader('Expires', new Date(Date.now() + 86400000).toUTCString());
      
      // Add error handlers to catch stream errors
      response.body.on('error', (err) => {
        clearTimeout(streamTimeout);
        console.error(`[PROXY] Response body stream error: ${err.message}`);
        // Try to send error response if headers haven't been sent yet
        if (!res.headersSent) {
          res.status(500).send(`Error in image stream: ${err.message}`);
        } else {
          console.error(`[PROXY] Headers already sent, can't send error response`);
          // Try to end the response if possible
          try {
            res.end();
          } catch (e) {
            console.error(`[PROXY] Failed to end response:`, e);
          }
        }
      });
      
      res.on('error', (err) => {
        clearTimeout(streamTimeout);
        console.error(`[PROXY] Response stream error: ${err.message}`);
        // Response already sent, can't send another one
      });
      
      // Pipe the image data with proper error handling
      response.body.pipe(res);
      
      // Listen for the 'finish' event to log when streaming is complete
      res.on('finish', () => {
        clearTimeout(streamTimeout);
        console.log(`[PROXY] Image streaming completed at ${new Date().toISOString()}`);
      });
    } catch (streamError) {
      console.error(`[PROXY] Error streaming image: ${streamError.message}`);
      console.error(`[PROXY] Stack trace:`, streamError.stack);
      res.status(500).send(`Error streaming image: ${streamError.message}`);
    }
  } catch (error) {
    console.error("Image proxy error:", error);
    
    // Provide a fallback image instead of error text
    try {
      console.error("[PROXY] Attempting to provide fallback image");
      
      // First try to use a default image from public folder
      const fallbackPath = path.join(__dirname, 'public', 'fallback.png');
      if (fsSync.existsSync(fallbackPath)) {
        console.log("[PROXY] Using local fallback image");
        res.setHeader('Content-Type', 'image/png');
        const fileStream = fsSync.createReadStream(fallbackPath);
        return fileStream.pipe(res);
      }
      
      // If local fallback isn't available, try an external placeholder
      console.log("[PROXY] Local fallback not found, using external placeholder");
      const placeholderUrl = "https://placehold.co/600x900/404040/ffffff?text=Image+Unavailable";
      
      try {
        const placeholderResponse = await fetch(placeholderUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        if (placeholderResponse.ok) {
          console.log("[PROXY] Successfully fetched external placeholder");
          res.setHeader('Content-Type', 'image/png');
          return placeholderResponse.body.pipe(res);
        } else {
          throw new Error(`Placeholder fetch failed: ${placeholderResponse.status}`);
        }
      } catch (placeholderErr) {
        console.error("[PROXY] Placeholder fetch failed:", placeholderErr);
        throw placeholderErr; // Rethrow to hit final fallback
      }
    } catch (fallbackErr) {
      console.error("[PROXY] All fallback methods failed:", fallbackErr);
    }
    
    // If all fallbacks fail, return error with more descriptive message
    console.error("[PROXY] Returning error response after all fallbacks failed");
    res.status(500).send(`Failed to fetch image: ${error.message}. Please try refreshing the page or generating a new image.`);
  }
});

// Endpoints for checking and working with GoAPI tasks
// Endpoint to check any task ID
app.get("/api/check-task/:taskId", async (req, res) => {
  const { taskId } = req.params;
  
  if (!taskId) {
    return res.status(400).json({
      success: false,
      message: "No task ID provided"
    });
  }
  
  try {
    const GOAPI_API_KEY = process.env.GOAPI_API_KEY;
    // Using the exact format from the example
    const myHeaders = new Headers();
    myHeaders.append("x-api-key", GOAPI_API_KEY);
    myHeaders.append("Content-Type", "application/json");
    
    const requestOptions = {
      method: 'GET',
      headers: myHeaders,
      redirect: 'follow'
    };
    
    const response = await fetch(`https://api.goapi.ai/api/v1/task/${taskId}`, requestOptions);
    
    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: "Failed to check task status",
        status: response.status
      });
    }
    
    // Get response as text first for debugging
    const responseText = await response.text();
    console.log(`[API] Check task raw response for ${taskId}: ${responseText}`);
    
    // Parse the JSON
    const data = JSON.parse(responseText);
    
    // Log detailed information about the task
    console.log(`[API] Task ID: ${taskId}`);
    console.log(`[API] Task Status: ${data.data?.status || 'unknown'}`);
    console.log(`[API] Task Progress: ${data.data?.output?.progress || 0}%`);
    
    // Check if completed and has image URLs - GoAPI returns image_urls array with quadrant images
    let primaryImageUrl = data.data?.output?.image_url;
    const imageUrls = data.data?.output?.image_urls;
    
    if (data.data?.status === 'completed') {
      // If we have an array of images, use the first one as primary but track all of them
      if (imageUrls && imageUrls.length > 0) {
        primaryImageUrl = imageUrls[0]; // Default to first image
        console.log(`[API] Task completed with ${imageUrls.length} images. Primary image URL: ${primaryImageUrl}`);
        
        if (imageUrls.length === 4) {
          console.log('[API] This appears to be a GoAPI grid result with 4 quadrants');
        }
      } else if (primaryImageUrl) {
        console.log(`[API] Task completed with single image URL: ${primaryImageUrl}`);
      }
    }
    
    res.json({
      success: true,
      taskId: taskId,
      status: data.data?.status || 'unknown',
      progress: data.data?.output?.progress || 0,
      imageUrl: primaryImageUrl || null,
      imageUrls: imageUrls || null,
      createdAt: data.data?.meta?.created_at || null,
      startedAt: data.data?.meta?.started_at || null,
      endedAt: data.data?.meta?.ended_at || null,
      rawResponse: responseText // Include the raw response for debugging
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error checking task status",
      error: error.message
    });
  }
});

// Add a GoAPI status dashboard endpoint
app.get("/api/goapi-status", async (req, res) => {
  try {
    // Collect recent task IDs from the art cache
    const recentTasks = [];
    
    // Extract all task IDs from the art cache
    Object.values(artCache).forEach(entry => {
      if (entry.task_id && !recentTasks.some(t => t.id === entry.task_id)) {
        recentTasks.push({
          id: entry.task_id,
          timestamp: entry.timestamp,
          tokenId: entry.tokenId,
          // Include information about image splitting
          isGridImage: entry.isGridResult || false,
          wasSplit: entry.originalGridUrl ? true : false,
          quadrantCount: entry.allImageUrls?.length || 1
        });
      }
    });
    
    // Sort by timestamp, most recent first
    recentTasks.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Take only the 10 most recent tasks
    const recentTasksLimited = recentTasks.slice(0, 10);
    
    // Count how many grid images we've processed
    const splitImageCount = Object.values(artCache).filter(entry => 
      entry.originalGridUrl || entry.isGridImage
    ).length;
    
    res.json({
      success: true,
      recentTasks: recentTasksLimited,
      apiKeyExists: !!process.env.GOAPI_API_KEY,
      apiKeyFirstChars: process.env.GOAPI_API_KEY ? process.env.GOAPI_API_KEY.substring(0, 4) + "..." : "Not set",
      stats: {
        totalImages: Object.keys(artCache).length,
        gridImagesProcessed: splitImageCount
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error getting GoAPI status",
      error: error.message
    });
  }
});

// Add an enhanced health check endpoint with API key validation
app.get("/api/health", (req, res) => {
  // Check essential API keys
  const apiKeysStatus = {
    opensea: !!OPENSEA_API_KEY,
    gpt: !!GPT_API_KEY,
    goapi: !!process.env.GOAPI_API_KEY
  };
  
  // Determine overall status
  const allRequiredKeysAvailable = apiKeysStatus.opensea && apiKeysStatus.gpt && apiKeysStatus.goapi;
  const status = allRequiredKeysAvailable ? "ok" : "missing_api_keys";
  
  // Enhanced response with more diagnostic information
  res.json({
    status: status,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    apiKeys: apiKeysStatus,
    cache: {
      analysisCount: Object.keys(analysisCache).length,
      cardDetailsCount: Object.keys(cardDetailsCache).length,
      artCount: Object.keys(artCache).length
    },
    memory: process.memoryUsage(),
    // Add availability flags to help diagnose issues
    services: {
      nftData: apiKeysStatus.opensea,
      imageGeneration: apiKeysStatus.goapi && apiKeysStatus.gpt,
      imageAnalysis: apiKeysStatus.gpt
    }
  });
});

app.get("/api/test-goapi", async (req, res) => {
  console.log("GoAPI test endpoint called");
  
  try {
    const GOAPI_API_KEY = process.env.GOAPI_API_KEY;
    console.log("API Key exists:", !!GOAPI_API_KEY);
    console.log("API Key first few chars:", GOAPI_API_KEY ? GOAPI_API_KEY.substring(0, 4) + "..." : "undefined");
    
    const requestBody = {
      model: "midjourney",
      task_type: "imagine",
      input: {
        prompt: "A simple test image of a blue cube --ar 1:1",
        process_mode: "fast",
        skip_prompt_check: false
      },
      config: {
        service_mode: "public",
        webhook_config: {
          endpoint: "",
          secret: ""
        }
      }
    };

    console.log("Making test request to GoAPI...");
    const response = await fetch("https://api.goapi.ai/api/v1/task", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": GOAPI_API_KEY
      },
      body: JSON.stringify(requestBody)
    });

    console.log("Response status:", response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log("Response data:", JSON.stringify(data, null, 2));
      
      res.json({
        success: true,
        message: "GoAPI connection successful",
        task_id: data.data.task_id,
        task_status: data.data.status
      });
    } else {
      const errorText = await response.text();
      console.error("Request failed:", errorText);
      res.status(500).json({
        success: false,
        message: "GoAPI connection failed",
        error: errorText
      });
    }
  } catch (error) {
    console.error("Test endpoint error:", error);
    res.status(500).json({
      success: false,
      message: "Exception during GoAPI test",
      error: error.message
    });
  }
});

// Define API keys at the top level - these are loaded from .env
const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY;
const GPT_API_KEY = process.env.GPT_API_KEY;
// GOAPI_API_KEY is fetched directly from process.env where needed
const CHAIN = "ethereum";
const CONTRACT_ADDRESS = "0xed5af388653567af2f388e6224dc7c4b3241c544";

// Debug environment variables
console.log("Environment variables loaded:");
console.log("- OPENSEA_API_KEY exists:", !!OPENSEA_API_KEY);
console.log("- GPT_API_KEY exists:", !!GPT_API_KEY);
console.log("- GOAPI_API_KEY exists:", !!process.env.GOAPI_API_KEY);
console.log("- GOAPI_API_KEY first 4 chars:", process.env.GOAPI_API_KEY ? process.env.GOAPI_API_KEY.substring(0, 4) + "..." : "undefined");

function logPrompt(data) {
  const timestamp = new Date().toISOString();
  const logEntry = { timestamp, ...data };
  fsSync.appendFile("prompts.log", JSON.stringify(logEntry) + "\n", (err) => {
    if (err) console.error("Error writing to log file:", err);
  });
}

// Create a simple database system to cache API results
// fs.promises is already imported at the top of the file
const sharp = require('sharp'); // Image processing library for splitting the quadrants
const CACHE_DIR = path.join(__dirname, 'cache');
const ANALYSIS_CACHE_FILE = path.join(CACHE_DIR, 'analysis_cache.json');
const CARD_DETAILS_CACHE_FILE = path.join(CACHE_DIR, 'card_details_cache.json');
const ART_CACHE_FILE = path.join(CACHE_DIR, 'art_cache.json');

// Initialize caches
let analysisCache = {};
let cardDetailsCache = {};
let artCache = {};

// Load cache from files if they exist
async function initCache() {
  try {
    // Create cache directory if it doesn't exist
    try {
      await fs.mkdir(CACHE_DIR, { recursive: true });
      console.log("Cache directory created or already exists");
    } catch (err) {
      console.error("Error creating cache directory:", err);
    }
    
    // Helper function to load a cache file
    async function loadCacheFile(filePath, cacheObject, cacheName) {
      try {
        const cacheData = await fs.readFile(filePath, 'utf8');
        const parsed = JSON.parse(cacheData);
        Object.assign(cacheObject, parsed);
        console.log(`Loaded ${Object.keys(cacheObject).length} ${cacheName}`);
      } catch (err) {
        if (err.code !== 'ENOENT') {
          console.error(`Error reading ${cacheName} file:`, err);
        } else {
          console.log(`No existing ${cacheName} file, starting fresh`);
          // Initialize with empty cache and save it
          await fs.writeFile(filePath, JSON.stringify({}), 'utf8');
        }
      }
    }
    
    // Load all cache files
    await Promise.all([
      loadCacheFile(ANALYSIS_CACHE_FILE, analysisCache, "cached analyses"),
      loadCacheFile(CARD_DETAILS_CACHE_FILE, cardDetailsCache, "cached card details"),
      loadCacheFile(ART_CACHE_FILE, artCache, "cached art URLs")
    ]);
    
    console.log("All cache files loaded successfully");
  } catch (err) {
    console.error("Cache initialization error:", err);
  }
}

// Generic function to save to a specific cache
async function saveToCache(tokenId, data, cacheObject, filePath, cacheType) {
  try {
    cacheObject[tokenId] = data;
    await fs.writeFile(filePath, JSON.stringify(cacheObject, null, 2), 'utf8');
    console.log(`Saved ${cacheType} for token #${tokenId} to cache`);
  } catch (err) {
    console.error(`Error saving ${cacheType} cache for token #${tokenId}:`, err);
  }
}

// Specific cache saving functions
async function saveAnalysisToCache(tokenId, data) {
  return saveToCache(tokenId, data, analysisCache, ANALYSIS_CACHE_FILE, 'analysis');
}

async function saveCardDetailsToCache(tokenId, data) {
  return saveToCache(tokenId, data, cardDetailsCache, CARD_DETAILS_CACHE_FILE, 'card details');
}

// Simple image processing utility for thumbnails
async function processImageForThumbnail(imageUrl, quality = 'high') {
  try {
    console.log(`[IMAGE] Processing thumbnail from: ${imageUrl}`);
    
    // Download the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image, status: ${response.status}`);
    }
    
    const buffer = await response.buffer();
    
    // Get the image metadata
    const metadata = await sharp(buffer).metadata();
    console.log(`[IMAGE] Image dimensions: ${metadata.width}x${metadata.height}`);
    
    // Create directory for storing processed images if it doesn't exist
    const processedDirPath = path.join(CACHE_DIR, 'processed_images');
    try {
      await fs.mkdir(processedDirPath, { recursive: true });
    } catch (err) {
      console.error(`Error creating processed images directory: ${err}`);
    }
    
    // Generate a unique ID for this processed image
    const imageId = Date.now().toString() + '-' + Math.random().toString(36).substring(2, 7);
    const filename = `${imageId}-thumb.webp`;
    const outputPath = path.join(processedDirPath, filename);
    
    // Process the image to create a thumbnail
    await sharp(buffer)
      .resize({
        width: quality === 'low' ? 400 : 800,
        height: quality === 'low' ? 600 : 1200,
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: quality === 'low' ? 70 : 90 })
      .toFile(outputPath);
    
    // Create URL for the processed image
    const processedUrl = `/api/processed-images/${filename}`;
    
    console.log(`[IMAGE] Created optimized thumbnail at ${outputPath}`);
    
    return processedUrl;
  } catch (error) {
    console.error(`[IMAGE] Error processing image: ${error.message}`);
    return null;
  }
}

// Modified art cache to support multiple versions per token
async function saveArtToCache(tokenId, data) {
  try {
    // Create a unique key for this art version
    const timestamp = new Date().toISOString();
    const versionKey = `${tokenId}_v${data.version || 1}_${timestamp.replace(/[:.]/g, '')}`;
    
    // Process thumbnail for faster loading if needed
    if (data.url && !data.thumbnailUrl) {
      try {
        // Generate a thumbnail for the main image
        const thumbnailUrl = await processImageForThumbnail(data.url, 'high');
        if (thumbnailUrl) {
          data.thumbnailUrl = thumbnailUrl;
          console.log(`[IMAGE] Added thumbnail for main image: ${thumbnailUrl}`);
        }
      } catch (thumbError) {
        console.error(`[IMAGE] Error generating thumbnail: ${thumbError.message}`);
      }
    }
    
    // Add this as a new entry rather than replacing the old one
    artCache[versionKey] = {
      ...data,
      tokenId, // Store tokenId inside the entry for easier filtering
      created: timestamp
    };
    
    // Handle multiple images from V2 API if present
    if (data.allImageUrls && data.allImageUrls.length > 1) {
      console.log(`Saving all ${data.allImageUrls.length} images from GoAPI V2 result`);
      
      // Create a special gallery item with all variants as quadrants
      const galleryKey = `${tokenId}_gallery_${timestamp.replace(/[:.]/g, '')}`;
      
      // Create quadrants from the image_urls - these are separate images from the API,
      // not grid quadrants that need to be split
      const quadrants = data.allImageUrls.map((url, idx) => ({
        url: url,
        number: idx + 1
      }));
      
      // Create a single gallery entry that shows all variants as quadrants
      artCache[galleryKey] = {
        ...data,
        url: data.allImageUrls[0], // Primary is first image
        quadrants: quadrants, // Store all variants as quadrants for gallery display
        allImageUrls: data.allImageUrls, 
        isGridResult: false, // These are NOT grid images that need splitting
        hasMultipleVariants: true, // Flag as having variants
        tokenId,
        created: timestamp,
        version: data.version || 1
      };
      
      console.log(`Created gallery item with ${quadrants.length} variants for display`);
      
      // Also save individual entries for each variant
      for (let i = 1; i < data.allImageUrls.length; i++) {
        const subImageKey = `${tokenId}_v${data.version || 1}_img${i+1}_${timestamp.replace(/[:.]/g, '')}`;
        
        // Create entry for each image from the API
        artCache[subImageKey] = {
          ...data,
          url: data.allImageUrls[i], // Use this specific image URL
          imageIndex: i+1, // Position in the array (2, 3, 4)
          tokenId,
          created: timestamp
        };
        
        console.log(`Saved additional image ${i+1} with URL: ${data.allImageUrls[i].substring(0, 50)}...`);
      }
    }
    
    // Also update the "current" version for this token
    // This makes the API work correctly for single card view
    const debugInfo = {
      generationDetails: {
        generationTime: new Date().toISOString(),
        usedTemporaryUrls: !!data.temporary_image_urls,
        isV2Api: !!data.isV2Api
      }
    };
    
    // Add debug information to help troubleshoot image loading issues
    artCache[tokenId] = {
      ...data,
      // Make sure we include all image URLs and quadrants for proper display
      ...(data.allImageUrls && data.allImageUrls.length > 0 ? {
        allImageUrls: data.allImageUrls,
        quadrants: data.allImageUrls.map((url, idx) => ({
          url: url,
          number: idx + 1
        })),
        hasMultipleVariants: true
      } : {}),
      created: timestamp,
      debugInfo
    };
    
    // Log what we're saving to the main token ID entry
    console.log(`[GoAPI-V2] Saved full art version ${data.version || 1} for token #${tokenId} to cache` + 
                (data.allImageUrls ? ` with ${data.allImageUrls.length} image variants` : ''));
    
    await fs.writeFile(ART_CACHE_FILE, JSON.stringify(artCache, null, 2), 'utf8');
    
    return versionKey; // Return the key of the newly created entry
  } catch (err) {
    console.error(`Error saving full art cache for token #${tokenId}:`, err);
  }
}

// Improved image analysis function with caching
async function analyzeImageWithGPT(tokenId, imageUrl, traits = []) {
  // Check cache first
  if (analysisCache[tokenId]) {
    console.log(`Using cached analysis for token #${tokenId}`);
    return analysisCache[tokenId].description;
  }
  
  try {
    console.log(`Analyzing image for ${tokenId} from ${imageUrl}`);
    
    // Format traits for better prompt context
    const traitsString = traits.map(t => `${t.trait_type}: ${t.value}`).join(", ");
    
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      console.warn(`Image fetch failed for ${tokenId}: ${imageResponse.status} - ${imageResponse.statusText}`);
      return "A character with a modern anime style, featuring unique hair and clothing.";
    }
    
    const imageBuffer = await imageResponse.buffer();
    const base64Image = imageBuffer.toString("base64");
    const mimeType = imageResponse.headers.get("content-type") || "image/png";
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    // Use prompt from the prompts.json file
    const prompt = PROMPTS.imageAnalysis.replace('{traits}', traitsString);

    logPrompt({ tokenId, promptType: "analysis", prompt, imageUrl, traits: traitsString });

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${GPT_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4-turbo",
        messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: dataUrl } }] }],
        max_tokens: 350,
      }),
    });

    if (!response.ok) {
      console.warn(`GPT Vision API failed for ${tokenId}: ${response.status} - ${await response.text()}`);
      return "A character with a modern anime style, featuring unique hair and clothing.";
    }

    const data = await response.json();
    // Log the complete API response
    console.log(`[GPT-API] Complete response for image analysis (token #${tokenId}):`, JSON.stringify(data, null, 2));
    
    const description = data.choices[0].message.content.trim();
    console.log(`Image analysis result for ${tokenId}:`, description);
    
    // Save to cache
    await saveAnalysisToCache(tokenId, {
      description,
      timestamp: new Date().toISOString(),
      traits: traitsString
    });
    
    return description || "A character with a modern anime style, featuring unique hair and clothing.";
  } catch (error) {
    console.error(`Error in analyzeImageWithGPT for ${tokenId}:`, error.message, error.stack);
    return "A character with a modern anime style, featuring unique hair and clothing.";
  }
}

async function generateCardDetailsWithGPT(tokenId, traits, description) {
  // Check cache first (using a hash of traits and description as they may be too long for a key)
  const traitsHash = Buffer.from(JSON.stringify(traits)).toString('base64').substring(0, 10);
  const descHash = Buffer.from(description).toString('base64').substring(0, 10);
  const cacheKey = `${tokenId}_${traitsHash}_${descHash}`;
  
  if (cardDetailsCache[cacheKey]) {
    console.log(`Using cached card details for token #${tokenId}`);
    return cardDetailsCache[cacheKey].cardDetails;
  }
  
  const traitString = traits.map((t) => `${t.trait_type}: ${t.value}`).join(", ");
  // Use prompt from the prompts.json file
  const prompt = PROMPTS.cardDetails
    .replace('{traits}', traitString)
    .replace('{description}', description);

  logPrompt({ tokenId, promptType: "cardDetails", prompt });

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${GPT_API_KEY}` },
      body: JSON.stringify({ model: "gpt-4-turbo", messages: [{ role: "user", content: prompt }], max_tokens: 300 }),
    });

    if (!response.ok) {
      console.warn(`GPT API failed for card details: ${response.status} - ${await response.text()}`);
      return { cardName: "Default Character", typeIcon: "🫘", hp: "100 HP", move: { name: "Basic Attack", atk: "30" }, weakness: "🔥 x2", resistance: "💧 -20", retreatCost: "🌟", rarity: "★" };
    }

    const data = await response.json();
    // Log the complete API response for card details
    console.log(`[GPT-API] Complete response for card details (token #${tokenId}):`, JSON.stringify(data, null, 2));
    
    const cardText = data.choices[0].message.content.trim();
    console.log("Raw GPT response for card details:", cardText);
    const cleanCardText = cardText.replace(/```json\s*|\s*```/g, "").trim();
    
    try {
      const parsedData = JSON.parse(cleanCardText);
      parsedData.typeIcon = parsedData.typeIcon.normalize("NFC");
      parsedData.weakness = parsedData.weakness.normalize("NFC");
      parsedData.resistance = parsedData.resistance.normalize("NFC");
      parsedData.retreatCost = parsedData.retreatCost.normalize("NFC");
      parsedData.rarity = parsedData.rarity.normalize("NFC");
      
      // Save to cache
      await saveCardDetailsToCache(cacheKey, {
        cardDetails: parsedData,
        timestamp: new Date().toISOString(),
        description: description.substring(0, 100) + "...", // Store partial description for reference
        traitCount: traits.length
      });
      
      return parsedData;
    } catch (e) {
      console.error("JSON Parse Error:", e, "Cleaned response:", cleanCardText);
      return { cardName: "Default Character", typeIcon: "🫘", hp: "100 HP", move: { name: "Basic Attack", atk: "30" }, weakness: "🔥 x2", resistance: "💧 -20", retreatCost: "🌟", rarity: "★" };
    }
  } catch (error) {
    console.error(`Error in generateCardDetailsWithGPT for token #${tokenId}:`, error.message, error.stack);
    return { cardName: "Default Character", typeIcon: "🫘", hp: "100 HP", move: { name: "Basic Attack", atk: "30" }, weakness: "🔥 x2", resistance: "💧 -20", retreatCost: "🌟", rarity: "★" };
  }
}

// New function for generating full body art using GoAPI V2 endpoint
async function generateFullBodyArtV2(tokenId, description, forceRegenerate = false, nftData = null) {
  try {
    // Check cache first (unless force regenerate is true)
    if (!forceRegenerate && artCache[tokenId]) {
      console.log(`Using cached full art URL for token #${tokenId}`);
      return artCache[tokenId].url;
    }
    
    // Determine version number for this generation
    let version = 1;
    if (forceRegenerate) {
      // Count existing versions for this token
      const versionEntries = Object.keys(artCache).filter(key => 
        key.startsWith(tokenId + "_v")
      );
      version = versionEntries.length + 1;
      console.log(`Creating version ${version} for token #${tokenId} with V2 API`);
    }
    
    // Get the NFT image URL from OpenSea if we're in the card API route
    const nftImageUrl = nftData?.image_url;
    
    console.log(`[GoAPI-V2] Starting image generation for token #${tokenId}`);
    
    // Prepare the request payload for the v2 API
    const payload = {
      prompt: PROMPTS.fullBodyArtV2.replace('{description}', description),
      process_mode: "fast",
      aspect_ratio: "5:8", // Using same aspect ratio as before
      skip_prompt_check: true, // Skip prompt validation
      webhook_endpoint: "",
      webhook_secret: ""
    };
    
    // If we have a reference image, add it to the request 
    if (nftImageUrl) {
      payload.reference_image_url = nftImageUrl;
      console.log(`[GoAPI-V2] Using reference image: ${nftImageUrl}`);
    }
    
    // Log the request
    console.log(`[GoAPI-V2] Request payload: ${JSON.stringify(payload)}`);
    logPrompt({ 
      tokenId, 
      promptType: "generation-v2", 
      prompt: payload.prompt, 
      forceRegenerate, 
      version, 
      includesNftReference: !!nftImageUrl 
    });
    
    // Send the request to the GoAPI V2 endpoint
    const GOAPI_API_KEY = process.env.GOAPI_API_KEY;
    const response = await fetch("https://api.goapi.ai/mj/v2/imagine", {
      method: "POST",
      headers: {
        "x-api-key": GOAPI_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GoAPI V2 request failed: ${response.status} - ${errorText}`);
    }
    
    const responseData = await response.json();
    const taskId = responseData.task_id;
    console.log(`[GoAPI-V2] Task submitted with ID: ${taskId}`);
    
    // Store a temporary entry in the art cache to link the task ID with the token ID
    // This allows the debug endpoint to know which task belongs to which token
    if (!artCache[tokenId]) {
      artCache[tokenId] = {};
    }
    artCache[tokenId].task_id = taskId;
    artCache[tokenId].processing = true;
    artCache[tokenId].startTime = new Date().toISOString();
    
    // Create a map entry in global cache that maps task IDs to token IDs for polling
    if (!global.taskToTokenMap) {
      global.taskToTokenMap = {};
    }
    global.taskToTokenMap[taskId] = tokenId;
    
    console.log(`[GoAPI-V2] Linked task ID ${taskId} to token #${tokenId} for polling`);
    
    // Poll for the result
    const resultImages = await pollGoApiV2Task(taskId, tokenId);
    console.log(`[GoAPI-V2] Task completed, received ${resultImages.length} images for token #${tokenId}`);
    
    // Save all the images to the cache
    // Create special entry with all images
    const timestamp = new Date().toISOString();
    
    // Create quadrants for displaying in gallery
    const quadrants = resultImages.map((url, idx) => ({
      url: url,
      number: idx + 1
    }));
    
    const cacheEntry = {
      tokenId,
      url: resultImages[0], // Primary image URL (first image) 
      allImageUrls: resultImages, // All four image URLs
      created: timestamp,
      version,
      description,
      isV2Api: true,
      isGridResult: false, // V2 API returns separate images, not a grid
      task_id: taskId,
      processing: false, // Mark as no longer processing
      completed: true, // Mark as completed
      quadrants: quadrants, // Add explicit quadrants for gallery display
      hasMultipleVariants: true
    };
    
    // Save to cache
    await saveArtToCache(tokenId, cacheEntry);
    console.log(`[GoAPI-V2] Saved full art version ${version} for token #${tokenId} to cache`);
    
    return resultImages[0]; // Return the first image URL
  } catch (error) {
    console.error(`[GoAPI-V2] Error generating full body art: ${error.message}`);
    return null;
  }
}

// Function to poll a GoAPI V2 task until it completes
async function pollGoApiV2Task(taskId, tokenId = null, maxAttempts = 60, pollInterval = 5000) {
  console.log(`[GoAPI-V2] Starting to poll task ${taskId} for token #${tokenId || 'unknown'}`);
  
  const GOAPI_API_KEY = process.env.GOAPI_API_KEY;
  
  // Get the token ID from the mapping if not provided
  if (!tokenId && global.taskToTokenMap && global.taskToTokenMap[taskId]) {
    tokenId = global.taskToTokenMap[taskId];
    console.log(`[GoAPI-V2] Retrieved token ID #${tokenId} from task mapping`);
  }
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[GoAPI-V2] Poll attempt ${attempt}/${maxAttempts} for task ${taskId} (token #${tokenId || 'unknown'})`);
      
      const pollResponse = await fetch(`https://api.goapi.ai/api/v1/task/${taskId}`, {
        method: "GET",
        headers: {
          "x-api-key": GOAPI_API_KEY
        }
      });
      
      if (!pollResponse.ok) {
        const errorText = await pollResponse.text();
        throw new Error(`GoAPI V2 polling failed: ${pollResponse.status} - ${errorText}`);
      }
      
      const pollData = await pollResponse.json();
      
      // Ensure output exists to prevent errors
      if (!pollData.data || !pollData.data.output) {
        console.log(`[GoAPI-V2] Poll response for task ${taskId} missing output data, waiting...`);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        continue;
      }
      
      const progress = pollData.data.output.progress || 0;
      console.log(`[GoAPI-V2] Poll response for task ${taskId}: Status=${pollData.data.status}, Progress=${progress}%`);
      
      // Update the art cache entry with the current progress for the UI to use
      if (tokenId && artCache[tokenId]) {
        artCache[tokenId].progress = progress;
        if (!artCache[tokenId].lastUpdated) {
          artCache[tokenId].lastUpdated = new Date().toISOString();
        }
      }
      
      // Check if task is completed
      if (pollData.data.status === "completed") {
        console.log(`[GoAPI-V2] Task ${taskId} completed successfully! (token #${tokenId || 'unknown'})`);
        
        let resultUrls = [];
        
        // Prioritize temporary URLs over regular URLs
        if (pollData.data.output.temporary_image_urls && pollData.data.output.temporary_image_urls.length > 0) {
          console.log(`[GoAPI-V2] Found ${pollData.data.output.temporary_image_urls.length} temporary URLs`);
          resultUrls = pollData.data.output.temporary_image_urls;
        }
        // Fall back to regular image URLs if no temporary URLs
        else if (pollData.data.output.image_urls && pollData.data.output.image_urls.length > 0) {
          console.log(`[GoAPI-V2] Found ${pollData.data.output.image_urls.length} regular image URLs`);
          resultUrls = pollData.data.output.image_urls;
        }
        // Single fallback image URL if that's all we have
        else if (pollData.data.output.image_url) {
          console.log(`[GoAPI-V2] Found single image URL`);
          resultUrls = [pollData.data.output.image_url];
        }
        
        if (resultUrls.length === 0) {
          throw new Error("No image URLs found in completed task response");
        }
        
        // If we have a token ID, update the art cache with the completed result
        if (tokenId) {
          console.log(`[GoAPI-V2] Updating art cache for token #${tokenId} with completed status`);
          
          if (!artCache[tokenId]) {
            artCache[tokenId] = {};
          }
          
          artCache[tokenId].url = resultUrls[0];
          artCache[tokenId].allImageUrls = resultUrls;
          artCache[tokenId].temporary_image_urls = pollData.data.output.temporary_image_urls || null;
          artCache[tokenId].processing = false;
          artCache[tokenId].completed = true;
          artCache[tokenId].progress = 100;
          artCache[tokenId].completedAt = new Date().toISOString();
          artCache[tokenId].task_id = taskId;
          
          // Save the updated art cache
          fs.writeFile(ART_CACHE_FILE, JSON.stringify(artCache, null, 2), 'utf8')
            .then(() => console.log(`[GoAPI-V2] Art cache saved with completed data for token #${tokenId}`))
            .catch(err => console.error(`[GoAPI-V2] Error saving art cache: ${err.message}`));
        }
        
        return resultUrls;
      } 
      
      // Check if task failed
      if (pollData.data.status === "failed") {
        const errorMsg = pollData.data.error?.message || "Unknown error";
        const rawError = pollData.data.error?.raw_message || "";
        
        // If we have a token ID, update the art cache with the failure info
        if (tokenId && artCache[tokenId]) {
          artCache[tokenId].processing = false;
          artCache[tokenId].completed = false;
          artCache[tokenId].failed = true;
          artCache[tokenId].error = errorMsg;
          artCache[tokenId].failedAt = new Date().toISOString();
        }
        
        throw new Error(`GoAPI V2 task failed: ${errorMsg} - ${rawError}`);
      }
      
      // Task is still processing, wait and try again
      console.log(`[GoAPI-V2] Task ${taskId} still processing, progress: ${progress}% (token #${tokenId || 'unknown'})`);
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    } catch (error) {
      console.error(`[GoAPI-V2] Error polling task ${taskId}: ${error.message}`);
      // Continue polling despite errors
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }
  
  // If we reach here, polling timed out
  if (tokenId && artCache[tokenId]) {
    artCache[tokenId].processing = false;
    artCache[tokenId].timedOut = true;
    artCache[tokenId].timedOutAt = new Date().toISOString();
  }
  
  throw new Error(`GoAPI V2 polling timed out after ${maxAttempts} attempts`);
}

// Original function for backwards compatibility
async function generateFullBodyArt(tokenId, description, forceRegenerate = false, nftData = null, testMode = true) {
  // Check cache first (unless force regenerate is true)
  if (!forceRegenerate && artCache[tokenId]) {
    console.log(`Using cached full art URL for token #${tokenId}`);
    return artCache[tokenId].url;
  }
  
  // Use the full description to ensure all details are included
  
  // Determine version number for this generation
  let version = 1;
  if (forceRegenerate) {
    // Count existing versions for this token
    const versionEntries = Object.keys(artCache).filter(key => 
      key.startsWith(tokenId + "_v")
    );
    version = versionEntries.length + 1;
    console.log(`Creating version ${version} for token #${tokenId}`);
  }
  
  // We'll populate this with results from the API
  let finalCacheEntry = {};
  
  // Create prompt with special Midjourney parameters for GoAPI, including --sref for the NFT image
  let prompt = '';
  
  // Get the NFT image URL from OpenSea if we're in the card API route
  const nftImageUrl = nftData?.image_url;
  
  // Using the full description as requested, without trimming
  
  // Using the exact specified format with parameters in the prompt

  // Using the specified Midjourney prompt format with --cref at the end as requested
  // This is for the legacy v1 API endpoint (used as fallback, no --p parameter)
  if (nftImageUrl) {
    prompt = `a full-body anime episode wide angle shot of ${description} --niji 6 --ar 5:8 --cref ${nftImageUrl} --cw 0`;
  } else {
    prompt = `a full-body anime episode wide angle shot of ${description} --niji 6 --ar 5:8`;
  }
  
  if (nftImageUrl) {
    console.log(`[GoAPI] Using prompt with NFT reference for token #${tokenId}`);
  } else {
    console.log(`[GoAPI] Using standard prompt without NFT reference for token #${tokenId}`);
  }
  
  console.log(`[GoAPI] Final prompt: ${prompt}`);
  logPrompt({ tokenId, promptType: "generation", prompt, forceRegenerate, version, includesNftReference: !!nftImageUrl });

  try {
    // DIRECTLY FOLLOWING THE SAMPLE CODE APPROACH
    console.log("[GoAPI] Starting image generation process with GoAPI");
    
    const GOAPI_API_KEY = process.env.GOAPI_API_KEY;
    if (!GOAPI_API_KEY) {
      console.error("Missing GoAPI API key!");
      throw new Error("GoAPI key missing. Add GOAPI_API_KEY to .env file.");
    }
    
    console.log(`[GoAPI] API key exists: ${!!GOAPI_API_KEY}`);
    console.log(`[GoAPI] Key starts with: ${GOAPI_API_KEY ? GOAPI_API_KEY.substring(0, 4) + "..." : "undefined"}`);
    
    // STEP 1: Submit the task following the exact format of the provided example
    console.log("[GoAPI] Submitting task...");
    
    // Format matches exactly the example payload
    const myHeaders = new Headers();
    myHeaders.append("x-api-key", GOAPI_API_KEY);
    myHeaders.append("Content-Type", "application/json");
    
    // Prepare the API request JSON with the proper structure
    // Parameters are now included directly in the prompt text as specified
    const requestBody = {
      "model": "midjourney",
      "task_type": "imagine",
      "input": {
        "prompt": prompt,
        "process_mode": "fast",
        "skip_prompt_check": true, // Skip prompt validation
        "bot_id": 0
      },
      "config": {
        "service_mode": "public",
        "webhook_config": {
          "endpoint": "",
          "secret": ""
        }
      }
    };
    
    const raw = JSON.stringify(requestBody);
    
    const requestOptions = {
      method: 'POST',
      headers: myHeaders,
      body: raw,
      redirect: 'follow'
    };
    
    console.log("[GoAPI] Request options:", JSON.stringify(requestOptions, null, 2).replace(GOAPI_API_KEY, "API_KEY_HIDDEN"));
    
    const response = await fetch('https://api.goapi.ai/api/v1/task', requestOptions);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[GoAPI] Task creation failed: HTTP ${response.status} - ${errorText}`);
      throw new Error(`GoAPI task creation failed: ${errorText}`);
    }
    
    const data = await response.json();
    console.log('[GoAPI] Initial API Response:', JSON.stringify(data, null, 2));
    
    if (data.code !== 200) {
      throw new Error(data.message || 'Failed to start image generation');
    }
    
    const taskId = data.data.task_id;
    console.log(`[GoAPI] Task created with ID: ${taskId}`);
    
    // STEP 2: Poll for the result using the exact approach from the sample code
    let imageUrl = null;
    
    // Polling function
    const checkStatus = async () => {
      try {
        console.log(`[GoAPI] Polling task ${taskId}...`);
        
        // Using the exact same format as the example
        const pollHeaders = new Headers();
        pollHeaders.append("x-api-key", GOAPI_API_KEY);
        pollHeaders.append("Content-Type", "application/json");
        
        const pollOptions = {
          method: 'GET',
          headers: pollHeaders,
          redirect: 'follow'
        };
        
        console.log(`[GoAPI] Sending poll request to: https://api.goapi.ai/api/v1/task/${taskId}`);
        const fetchResponse = await fetch(`https://api.goapi.ai/api/v1/task/${taskId}`, pollOptions);
        
        if (!fetchResponse.ok) {
          const errorText = await fetchResponse.text();
          console.error(`[GoAPI] Poll error: HTTP ${fetchResponse.status} - ${errorText}`);
          return null; // Continue polling on errors
        }
        
        // Parse the response as text first so we can log the raw response
        const responseText = await fetchResponse.text();
        console.log(`[GoAPI] Raw poll response: ${responseText}`);
        
        // Parse the JSON response
        const fetchData = JSON.parse(responseText);
        
        // Log detailed information about the task status
        console.log(`[GoAPI] Task ID: ${taskId}`);
        console.log(`[GoAPI] Task Status: ${fetchData.data?.status || 'unknown'}`);
        console.log(`[GoAPI] Task Progress: ${fetchData.data?.output?.progress || 0}%`);
        console.log(`[GoAPI] Created At: ${fetchData.data?.meta?.created_at || 'unknown'}`);
        console.log(`[GoAPI] Started At: ${fetchData.data?.meta?.started_at || 'unknown'}`);
        console.log(`[GoAPI] Ended At: ${fetchData.data?.meta?.ended_at || 'unknown'}`);
        
        // Check if there's any error in the response
        if (fetchData.data?.error?.code) {
          console.error(`[GoAPI] Task Error Code: ${fetchData.data.error.code}`);
          console.error(`[GoAPI] Task Error Message: ${fetchData.data.error.message}`);
        }
        
        if (fetchData.data?.status === 'completed') {
          console.log('[GoAPI] Task completed!');
          
          // Check for image URLs - GoAPI returns image_urls array with quadrant images 
          // or a single image_url with a grid
          const imageUrls = fetchData.data.output?.image_urls;
          let url = fetchData.data.output?.image_url;
          
          // Store all URLs for later use in gallery
          let allImageUrls = [];
          
          // If we have an array of images, use the first one as primary but keep all of them
          if (imageUrls && imageUrls.length > 0) {
            url = imageUrls[0]; // Default to first image
            allImageUrls = [...imageUrls]; // Store all URLs
            console.log(`[GoAPI] Task completed with ${imageUrls.length} images. Primary image URL: ${url}`);
            
            // No matter how many images we get, GoAPI always returns a grid in each image
            console.log('[GoAPI] Marking image for quadrant splitting (GoAPI always returns grids)');
            finalCacheEntry = {
              url: url,
              allImageUrls: allImageUrls,
              isGridResult: true, // Always mark for splitting during cache save
              timestamp: new Date().toISOString(),
              isFallback: false,
              description: description.substring(0, 100) + "...",
              version: version,
              generator: "midjourney",
              prompt: prompt,
              special_params: "--niji 6 --ar 5:8", // Removed --p param
              task_id: taskId,
              tokenId: tokenId
            };
          } else if (url) {
            console.log(`[GoAPI] Task completed with single image URL: ${url}`);
            allImageUrls = [url];
            
            // GoAPI always returns a 2x2 grid of options in a single image
            // We always split this into 4 separate images
            console.log('[GoAPI] Single image received, will split into quadrants');
            finalCacheEntry = {
              url: url,
              allImageUrls: [url],
              isGridResult: true, // Always mark for splitting
              timestamp: new Date().toISOString(),
              isFallback: false,
              description: description.substring(0, 100) + "...",
              version: version, 
              generator: "midjourney",
              prompt: prompt,
              special_params: "--niji 6 --ar 5:8", // Removed --p param
              task_id: taskId,
              tokenId: tokenId
            };
          }
          
          if (url) {
            console.log(`[GoAPI] Using primary image URL: ${url}`);
            imageUrl = url;
            
            // Only set finalCacheEntry if not already set by grid detection
            if (!finalCacheEntry.url) {
              finalCacheEntry = {
                url: url,
                allImageUrls: allImageUrls,
                timestamp: new Date().toISOString(),
                isFallback: false,
                description: description.substring(0, 100) + "...",
                version: version,
                generator: "midjourney", // Tag the source of generation
                prompt: prompt, // Store the prompt used
                special_params: "--niji 6 --ar 5:8", // Store special parameters used
                task_id: taskId, // Store the task ID
                tokenId: tokenId // Make sure tokenId is stored for easy retrieval
              };
            }
            
            return true; // Success
          } else {
            console.error('[GoAPI] Completed but no image URL found');
            throw new Error('Completed but no image URL found');
          }
        } else if (fetchData.data?.status === 'failed') {
          console.error(`[GoAPI] Task failed: ${fetchData.data.error?.message || 'Unknown error'}`);
          throw new Error(`Task failed: ${fetchData.data.error?.message || 'Unknown error'}`);
        }
        
        console.log(`[GoAPI] Task still processing. Current progress: ${fetchData.data?.output?.progress || 0}%`);
        return false; // Still processing, continue polling
      } catch (error) {
        console.error(`[GoAPI] Polling error: ${error.message}`);
        throw error;
      }
    };
    
    // Polling loop
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes maximum
    let successfulPolls = 0; // Track consecutive successful polls
    
    while (attempts < maxAttempts) {
      attempts++;
      console.log(`[GoAPI] Poll attempt ${attempts}/${maxAttempts}`);
      
      try {
        const result = await checkStatus();
        
        if (result === true) {
          // Successfully got an image URL
          console.log(`[GoAPI] Successfully received image URL!`);
          successfulPolls++;
          
          // Ensure we have a real URL by checking a few more times
          if (successfulPolls >= 3) {
            console.log(`[GoAPI] Verified image URL with ${successfulPolls} successful polls`);
            break;
          }
          
          // Wait a short time between verification polls
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else if (result === null) {
          // Error occurred, reset successful polls counter
          successfulPolls = 0;
          
          console.log(`[GoAPI] Poll error, waiting 5 seconds before retry...`);
          // Error occurred, wait exactly 5 seconds before retrying
          await new Promise(resolve => setTimeout(resolve, 5000));
        } else {
          // Still processing, reset successful polls counter
          successfulPolls = 0;
          
          // Still processing - use exactly 5 second polling interval
          console.log(`[GoAPI] Task still processing, will check again in 5 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      } catch (error) {
        console.error(`[GoAPI] Error during polling: ${error.message}`);
        successfulPolls = 0;
        
        // Don't immediately throw - try a few more times
        if (attempts >= maxAttempts - 5) {
          throw error;
        }
        
        // Wait a bit longer after errors
        await new Promise(resolve => setTimeout(resolve, 6000));
      }
    }
    
    if (!imageUrl) {
      console.error('[GoAPI] Failed to get image URL after maximum attempts');
      throw new Error('Failed to get image URL after maximum attempts');
    }
    
    // Save to cache
    console.log(`[GoAPI] Successfully generated image: ${imageUrl}`);
    
    // Test the URL to make sure it's accessible
    try {
      console.log('[GoAPI] Testing image URL accessibility...');
      
      // Using the exact same format as the example
      const testHeaders = new Headers();
      testHeaders.append("x-api-key", GOAPI_API_KEY);
      testHeaders.append("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36");
      
      const testOptions = {
        method: 'HEAD',
        headers: testHeaders,
        redirect: 'follow'
      };
      
      const testResp = await fetch(imageUrl, testOptions);
      console.log(`[GoAPI] Image URL test status: ${testResp.status} ${testResp.statusText}`);
    } catch (testErr) {
      console.warn(`[GoAPI] Image URL accessibility test error (continuing anyway): ${testErr.message}`);
    }
    
    // If finalCacheEntry is empty, populate it with default values
    if (Object.keys(finalCacheEntry).length === 0) {
      finalCacheEntry = {
        url: imageUrl,
        allImageUrls: [imageUrl],
        timestamp: new Date().toISOString(),
        isFallback: false,
        description: description.substring(0, 100) + "...",
        version: version,
        generator: "midjourney",
        prompt: prompt,
        special_params: "--niji 6 --ar 5:8", // Removed --p param
        task_id: taskId,
        tokenId: tokenId
      };
    }
    
    // Force a test grid for debugging if needed
    if (imageUrl && imageUrl.includes('grid')) {
      console.log('[GRID TEST] Forcing test grid URLs in final cache entry');
      finalCacheEntry.allImageUrls = [
        imageUrl,
        imageUrl + '?quadrant=2', 
        imageUrl + '?quadrant=3',
        imageUrl + '?quadrant=4'
      ];
    }
    
    console.log(`Saving cache entry with ${finalCacheEntry.allImageUrls?.length || 0} image URLs`);
    await saveArtToCache(tokenId, finalCacheEntry);
    return imageUrl;
    
  } catch (error) {
    console.error(`[GoAPI] Error in generateFullBodyArt: ${error.message}`);
    throw error; // No fallback, just propagate the error
  }
}

// Helper function to extract a color from NFT traits for card styling
function extractCardColorFromTraits(traits) {
  let cardColor = "#ff5722"; // Default fire color
  const colorTraits = traits.filter(t => 
    t.trait_type === "Background" || 
    t.trait_type === "Clothing" || 
    t.trait_type === "Hair" ||
    t.trait_type === "Skin"
  );
  
  if (colorTraits.length > 0) {
    // Pick the first color trait to inform card styling
    const colorTrait = colorTraits[0].value.toLowerCase();
    if (colorTrait.includes("red") || colorTrait.includes("orange") || colorTrait.includes("fire")) {
      cardColor = "#ff5722"; // Fire
    } else if (colorTrait.includes("blue") || colorTrait.includes("water") || colorTrait.includes("ocean")) {
      cardColor = "#2196f3"; // Water
    } else if (colorTrait.includes("yellow") || colorTrait.includes("gold") || colorTrait.includes("electric")) {
      cardColor = "#ffc107"; // Electric
    } else if (colorTrait.includes("brown") || colorTrait.includes("earth") || colorTrait.includes("stone")) {
      cardColor = "#795548"; // Earth
    } else if (colorTrait.includes("green") || colorTrait.includes("forest") || colorTrait.includes("nature")) {
      cardColor = "#4caf50"; // Plant
    }
  }
  return cardColor;
}

// Initialize the cache when the app starts
initCache().then(() => {
  console.log("Cache system initialized");
  
  // Create directories for processed images
  const processedDirPath = path.join(CACHE_DIR, 'processed_images');
  fs.mkdir(processedDirPath, { recursive: true })
    .then(() => console.log("Processed images directory created"))
    .catch(err => console.error("Error creating processed images directory:", err));
  
}).catch(err => {
  console.error("Failed to initialize cache system:", err);
});

// Function to process full art in the background using V2 API (preferred)
async function processFullArtV2InBackground(tokenId, characterDescription, nftData, initialResponse) {
  try {
    console.log(`[BACKGROUND-V2] Starting background processing of full art with V2 API for token #${tokenId}`);
    
    // Add a timestamp for tracking processing time
    const processStartTime = new Date().toISOString();
    
    // Generate full art with GoAPI V2
    const fullBodyArtUrl = await generateFullBodyArtV2(tokenId, characterDescription, false, nftData);
    console.log(`[BACKGROUND-V2] Full art URL generated: ${fullBodyArtUrl}`);
    
    // Update the art cache to make it available for gallery
    const artCacheEntry = {
      ...initialResponse,
      url: fullBodyArtUrl,
      timestamp: new Date().toISOString(),
      processStartTime: processStartTime,
      description: characterDescription,
      tokenId,
      isV2Api: true // Mark as V2 API generated
    };
    
    await saveArtToCache(tokenId, artCacheEntry);
    console.log(`[BACKGROUND-V2] Full art processing completed for token #${tokenId}`);
    
    return fullBodyArtUrl;
  } catch (error) {
    console.error(`[BACKGROUND-V2] Error processing full art with V2 API: ${error.message}`);
    // Re-throw to trigger the fallback
    throw error;
  }
}

// Function to process full art in the background with V1 API (fallback)
async function processFullArtInBackground(tokenId, characterDescription, nftData, initialResponse) {
  try {
    console.log(`[BACKGROUND-V1] Starting background processing of full art with V1 API for token #${tokenId}`);
    
    // Add a timestamp for tracking processing time
    const processStartTime = new Date().toISOString();
    
    // Generate full art with GoAPI
    const fullBodyArtUrl = await generateFullBodyArt(tokenId, characterDescription, false, nftData);
    console.log(`[BACKGROUND-V1] Full art URL generated: ${fullBodyArtUrl}`);
    
    // Update the art cache to make it available for gallery
    // This triggers the splitting process as a side effect
    const artCacheEntry = {
      ...initialResponse,
      url: fullBodyArtUrl,
      timestamp: new Date().toISOString(),
      processStartTime: processStartTime,
      description: characterDescription,
      tokenId,
      isV2Api: false // Mark as V1 API generated
    };
    
    await saveArtToCache(tokenId, artCacheEntry);
    console.log(`[BACKGROUND-V1] Full art processing completed for token #${tokenId}`);
    
    return fullBodyArtUrl;
  } catch (error) {
    console.error(`[BACKGROUND-V1] Error processing full art with V1 API: ${error.message}`);
    return null;
  }
}

app.get("/api/card/:tokenId", async (req, res) => {
  const { tokenId } = req.params;
  console.log(`Processing tokenId: ${tokenId} at ${new Date().toISOString()}`);

  try {
    // Step 1: Fetch NFT data and ensure the NFT image is available
    console.log("Fetching NFT data...");
    
    let nftData;
    
    try {
      // Check if OpenSea API key exists
      if (!OPENSEA_API_KEY) {
        console.warn("Missing OpenSea API key, using fallback data");
        throw new Error("OPENSEA_API_KEY is missing");
      }
      
      const nftUrl = `https://api.opensea.io/api/v2/chain/${CHAIN}/contract/${CONTRACT_ADDRESS}/nfts/${tokenId}`;
      console.log(`Fetching NFT data from OpenSea API for token #${tokenId}`);
      
      const nftResponse = await fetch(nftUrl, { headers: { "X-API-KEY": OPENSEA_API_KEY } });
      
      if (!nftResponse.ok) {
        console.error(`OpenSea API failed: ${nftResponse.status}`);
        throw new Error(`OpenSea API failed: ${nftResponse.status} - ${await nftResponse.text()}`);
      }
      
      const responseData = await nftResponse.json();
      nftData = responseData.nft;
      console.log("NFT data fetched successfully:", nftData.image_url);
    } catch (opensea_error) {
      console.error(`Error fetching from OpenSea: ${opensea_error.message}`);
      
      // Create fallback NFT data with placeholder image
      const fallbackImage = `https://placehold.co/600x600/f8f3e6/222222/png?text=Azuki+%23${tokenId}`;
      console.log(`Using fallback NFT data with image: ${fallbackImage}`);
      
      nftData = {
        identifier: tokenId,
        image_url: fallbackImage,
        image_thumbnail_url: fallbackImage,
        name: `Azuki #${tokenId}`,
        description: "An Azuki character from the popular NFT collection",
        traits: [
          { trait_type: "Type", value: "Human" },
          { trait_type: "Hair", value: "Basic" },
          { trait_type: "Clothing", value: "Kimono" },
          { trait_type: "Eyes", value: "Calm" },
          { trait_type: "Mouth", value: "Neutral" },
          { trait_type: "Background", value: "Off White" }
        ]
      };
    }

    // Step 2: Verify the NFT image is accessible before proceeding
    console.log("Verifying NFT image accessibility...");
    if (!nftData.image_url) {
      throw new Error("NFT image URL is missing");
    }
    
    try {
      // Check that the NFT image is accessible
      const imgCheck = await fetch(nftData.image_url, { 
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      if (!imgCheck.ok) {
        console.warn(`NFT image access check failed: ${imgCheck.status}. Will use proxy for analysis.`);
      } else {
        console.log("NFT image verified as accessible");
      }
    } catch (imgCheckError) {
      console.warn(`NFT image pre-check failed: ${imgCheckError.message}. Will proceed anyway.`);
    }

    // Step 3: Analyze the NFT image with the verified image URL
    console.log("Analyzing image...");
    // Pass the NFT traits to the analysis function for better context
    const characterDescription = await analyzeImageWithGPT(tokenId, nftData.image_url, nftData.traits);
    console.log("Image analysis complete! Description:", characterDescription);

    // Step 4: Generate card details
    console.log("Generating card details...");
    const cardDetails = await generateCardDetailsWithGPT(tokenId, nftData.traits, characterDescription);
    console.log("Card details generated:", cardDetails);
    
    // Extract card color from traits
    const cardColor = extractCardColorFromTraits(nftData.traits);

    // Create the initial response with the normal card data
    const initialResponse = {
      success: true,
      nftImage: nftData.image_url,
      nftTraits: nftData.traits.filter(t => t.trait_type !== "Background"),
      identifier: nftData.identifier,
      cardDetails,
      description: characterDescription,
      cardColor: cardColor,
      // For demo purposes, set fullArtProcessing to false to avoid polling
      fullArtProcessing: false,
      // Don't set a default fullArtUrl to allow the normal image to be displayed first
      generator: "midjourney",
      debugEndpoint: `/api/debug/image/${tokenId}` // Add debug endpoint for status checking
    };
    
    // Check if we already have the full art in cache
    if (artCache[tokenId] && artCache[tokenId].url) {
      console.log(`Using cached full art for token #${tokenId}`);
      initialResponse.fullArtUrl = artCache[tokenId].url;
      initialResponse.fullArtProcessing = false;
      
      // Include all image URLs if available (the 4 variants)
      if (artCache[tokenId].allImageUrls && artCache[tokenId].allImageUrls.length > 0) {
        initialResponse.allImageUrls = artCache[tokenId].allImageUrls;
        console.log(`Including ${artCache[tokenId].allImageUrls.length} image variants in response`);
      }
      
      // Include temporary URLs if available
      if (artCache[tokenId].temporary_image_urls) {
        initialResponse.temporary_image_urls = artCache[tokenId].temporary_image_urls;
        console.log(`Including ${artCache[tokenId].temporary_image_urls.length} temporary URLs in response`);
      }
      
      // Send the response right away with cached full art
      res.json(initialResponse);
    } else {
      // Send initial response without full art
      console.log("Sending initial response without full art");
      res.json(initialResponse);
      
      // Start a pre-generation check to ensure NFT image is fully accessible
      console.log("Performing final NFT image verification before generation...");
      
      try {
        // One more check to ensure the NFT image is fully accessible and not just headers
        const finalImgCheck = await fetch(nftData.image_url);
        
        if (!finalImgCheck.ok) {
          console.warn(`Final NFT image check failed: ${finalImgCheck.status} - ${finalImgCheck.statusText}`);
          console.log("Will use proxy URL for generation to ensure reference image works");
          // Update the nftData with a proxy URL to ensure it's accessible for generation
          nftData.image_url = `/api/proxy-image?url=${encodeURIComponent(nftData.image_url)}`;
        } else {
          // Buffer a small amount of the image to confirm actual data access
          await finalImgCheck.blob();
          console.log("NFT image fully verified - ready for generation");
        }
      } catch (finalCheckError) {
        console.warn(`Final NFT image verification failed: ${finalCheckError.message}`);
        console.log("Using proxy URL for generation reference");
        // Update the nftData with a proxy URL to ensure it's accessible for generation
        nftData.image_url = `/api/proxy-image?url=${encodeURIComponent(nftData.image_url)}`;
      }
      
      // Start processing full art in the background with V2 API first
      console.log("Starting full-art generation with GoAPI V2...");
      
      // Try V2 API first with verified NFT image
      processFullArtV2InBackground(tokenId, characterDescription, nftData, initialResponse)
        .then(fullArtUrl => {
          console.log(`Background full art V2 generation completed with URL: ${fullArtUrl}`);
        })
        .catch(error => {
          console.error(`Background full art V2 generation failed: ${error.message}`);
          
          // Fall back to V1 API if V2 fails
          console.log("Falling back to GoAPI V1 for generation...");
          return processFullArtInBackground(tokenId, characterDescription, nftData, initialResponse);
        })
        .then(fallbackUrl => {
          if (fallbackUrl) {
            console.log(`Fallback V1 generation completed with URL: ${fallbackUrl}`);
          }
        })
        .catch(fallbackError => {
          console.error(`Both V2 and fallback V1 generation failed: ${fallbackError.message}`);
        });
    }
  } catch (error) {
    console.error("Error at:", new Date().toISOString(), error.message, error.stack);
    res.status(500).json({
      success: false,
      error: error.message,
      fallback: {
        nftImage: "https://cdn.glitch.global/81a7ec98-48d4-49ed-a5ce-25049f0fb3a9/azuki-1834.png?v=1740923569892",
        cardDetails: { cardName: "Default Character", typeIcon: "🫘", hp: "100 HP", move: { name: "Basic Attack", atk: "30" }, weakness: "🔥 x2", resistance: "💧 -20", retreatCost: "🌟", rarity: "★" },
        fullArtUrl: "https://cdn.glitch.global/81a7ec98-48d4-49ed-a5ce-25049f0fb3a9/1834-fullart.png?v=1740942389796",
        description: "A character with a modern anime style, featuring unique hair and clothing.",
      },
    });
  }
});

// Add an endpoint to get the gallery of previous full art creations
app.get("/api/gallery", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const filter = req.query.filter || 'all';
    const search = req.query.search || '';
    
    // Calculate pagination
    const startIndex = (page - 1) * limit;
    
    // Convert artCache to array so we can sort/filter it, but handle quadrants properly
    let galleryItems = [];
    
    // First pass - gather all unique tokenIds
    const tokenEntries = new Map(); // Map of tokenId -> array of entries
    
    // Group entries by token ID
    Object.entries(artCache).forEach(([cacheKey, data]) => {
      // Extract token ID
      let tokenId = data.tokenId;
      if (!tokenId) {
        if (cacheKey.includes("_v")) {
          tokenId = cacheKey.split("_")[0];
        } else {
          tokenId = cacheKey;
        }
      }
      
      // Skip entries without token ID or URL
      if (!tokenId || !data.url) return;
      
      // Skip entries that are just individual quadrants 
      // (they'll have a filename with -q1, -q2, etc.)
      if (data.url.includes('-q1.png') || data.url.includes('-q2.png') || 
          data.url.includes('-q3.png') || data.url.includes('-q4.png')) {
        // But store these for later reference in the second pass
        if (!tokenEntries.has(tokenId)) {
          tokenEntries.set(tokenId, []);
        }
        tokenEntries.get(tokenId).push({
          cacheKey,
          data,
          isQuadrant: true,
          quadrantNumber: data.url.includes('-q1.png') ? 1 : 
                          data.url.includes('-q2.png') ? 2 : 
                          data.url.includes('-q3.png') ? 3 : 4
        });
        return;
      }
      
      // Store grid/full entries
      if (!tokenEntries.has(tokenId)) {
        tokenEntries.set(tokenId, []);
      }
      tokenEntries.get(tokenId).push({
        cacheKey,
        data,
        isQuadrant: false,
        version: data.version || 1,
        timestamp: data.created || data.timestamp || new Date().toISOString()
      });
    });
    
    // Second pass - create gallery items for each token with all quadrants
    tokenEntries.forEach((entries, tokenId) => {
      // Find the main entry - prefer the one with the highest version number
      const mainEntries = entries.filter(e => !e.isQuadrant)
        .sort((a, b) => (b.version || 1) - (a.version || 1));
      
      if (mainEntries.length === 0) return; // Skip if no main entry
      
      const mainEntry = mainEntries[0];
      const data = mainEntry.data;
      
      // Collect quadrant URLs for this token
      const quadrants = entries.filter(e => e.isQuadrant)
        .sort((a, b) => a.quadrantNumber - b.quadrantNumber)
        .map(e => ({ url: e.data.url, number: e.quadrantNumber }));
      
      galleryItems.push({
        tokenId,
        url: data.url, // Main image URL
        quadrants, // Array of quadrant URLs
        timestamp: data.created || data.timestamp || new Date().toISOString(),
        isFallback: data.isFallback || false,
        version: data.version || 1,
        cacheKey: mainEntry.cacheKey,
        isGridResult: data.isGridResult || false,
        hasAllQuadrants: quadrants.length === 4,
        popularity: parseInt(tokenId) % 100
      });
    });
    
    // Remove any remaining duplicates (should be rare after our processing)
    const uniqueItems = galleryItems.filter((item, index, self) => 
      index === self.findIndex(t => t.tokenId === item.tokenId)
    );
    
    // Apply search filter if present
    let filteredItems = uniqueItems;
    if (search) {
      filteredItems = filteredItems.filter(item => 
        item.tokenId.includes(search)
      );
    }
    
    // Apply filter
    if (filter === 'recent') {
      filteredItems.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } else if (filter === 'popular') {
      filteredItems.sort((a, b) => b.popularity - a.popularity);
    }
    
    // Fix for issue where quadrants were broken up into separate items
    // Ensure each item in the gallery has all quadrants properly assigned
    const enhancedItems = filteredItems.map(item => {
      // For any item that has allImageUrls array but no quadrants - create quadrants from image URLs
      if (item.allImageUrls && item.allImageUrls.length > 1) {
        // Force create quadrants from allImageUrls regardless of isGridResult flag
        if (!item.quadrants || item.quadrants.length < item.allImageUrls.length) {
          console.log(`Enhancing item ${item.tokenId} with ${item.allImageUrls.length} quadrants/variants`);
          
          // Create quadrants from allImageUrls
          const quadrants = item.allImageUrls.map((url, idx) => ({
            url: url,
            number: idx + 1
          }));
          
          return {
            ...item,
            quadrants,
            hasMultipleVariants: true
          };
        }
      }
      return item;
    });
    
    // Log what we have for debugging
    console.log(`Gallery found ${filteredItems.length} total items`);
    console.log(`Gallery has ${enhancedItems.filter(item => item.quadrants && item.quadrants.length > 0).length} items with quadrants`);
    
    // Check for V2 API items
    const v2Items = enhancedItems.filter(item => item.isV2Api);
    if (v2Items.length > 0) {
      console.log(`Found ${v2Items.length} items from V2 API`);
    }
    
    // Get total count for pagination
    const totalItems = enhancedItems.length;
    const totalPages = Math.ceil(totalItems / limit);
    
    // Get the items for the current page
    const paginatedItems = enhancedItems.slice(startIndex, startIndex + limit);
    
    // Return paginated results with metadata
    res.json({
      success: true,
      data: paginatedItems,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages
      }
    });
  } catch (error) {
    console.error("Error fetching gallery:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch gallery"
    });
  }
});

// New endpoint to generate art using the GoAPI V2 endpoint with separate images
app.post("/api/v2/generate-art/:tokenId", async (req, res) => {
  const { tokenId } = req.params;
  const forceGenerate = true; // Always generate new art when explicitly requested
  
  console.log(`[API-V2] Generating art for token #${tokenId} using GoAPI V2 API...`);
  
  // Longer timeout for this endpoint
  req.setTimeout(300000); // 5 minutes
  res.setTimeout(300000); // 5 minutes
  
  try {
    // First check if generation is already in progress for this token
    if (artCache[tokenId] && artCache[tokenId].processing) {
      console.log(`[API-V2] Generation already in progress for token #${tokenId}, returning task info`);
      
      // Return info about the in-progress task
      return res.json({
        success: true,
        tokenId,
        message: "Art generation already in progress",
        taskId: artCache[tokenId].task_id,
        progress: artCache[tokenId].progress || 0,
        statusEndpoint: `/api/debug/image/${tokenId}`,
        startedAt: artCache[tokenId].startTime || new Date().toISOString()
      });
    }
    
    // Step 1: Set up initial status in art cache to track this request
    if (!artCache[tokenId]) {
      artCache[tokenId] = {};
    }
    
    // Mark as processing before we start
    artCache[tokenId].processing = true;
    artCache[tokenId].startTime = new Date().toISOString();
    artCache[tokenId].progress = 0;
    
    // Step 2: Fetch NFT data from OpenSea
    console.log(`[API-V2] Fetching NFT data for token #${tokenId}...`);
    const nftUrl = `https://api.opensea.io/api/v2/chain/${CHAIN}/contract/${CONTRACT_ADDRESS}/nfts/${tokenId}`;
    const nftResponse = await fetch(nftUrl, { headers: { "X-API-KEY": OPENSEA_API_KEY } });
    
    if (!nftResponse.ok) {
      throw new Error(`[API-V2] OpenSea API failed: ${nftResponse.status} - ${await nftResponse.text()}`);
    }
    
    const nftData = (await nftResponse.json()).nft;
    console.log(`[API-V2] NFT data fetched for #${tokenId}`);
    
    // Update progress
    artCache[tokenId].progress = 10;
    
    // Step 3: Make sure NFT image is accessible before using it
    if (!nftData.image_url) {
      throw new Error(`[API-V2] NFT image URL missing for token #${tokenId}`);
    }
    
    console.log(`[API-V2] Verifying NFT image accessibility: ${nftData.image_url}`);
    
    // Verify the NFT image is fully accessible with a proper fetch
    let imageAccessible = false;
    try {
      const imageCheck = await fetch(nftData.image_url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'image/*'
        }
      });
      
      if (imageCheck.ok) {
        // Try to actually load some of the image data to confirm it's fully accessible
        const imageBlob = await imageCheck.blob();
        if (imageBlob.size > 0) {
          console.log(`[API-V2] NFT image verified (${imageBlob.size} bytes)`);
          imageAccessible = true;
        } else {
          console.warn(`[API-V2] NFT image response valid but empty (0 bytes)`);
        }
      } else {
        console.warn(`[API-V2] NFT image check failed: ${imageCheck.status} - ${imageCheck.statusText}`);
      }
    } catch (imageError) {
      console.warn(`[API-V2] Error checking NFT image: ${imageError.message}`);
    }
    
    // If image isn't accessible, use our proxy endpoint
    if (!imageAccessible) {
      console.log(`[API-V2] Using proxy for NFT image to ensure accessibility`);
      nftData.image_url = `/api/proxy-image?url=${encodeURIComponent(nftData.image_url)}`;
    }
    
    // Update progress
    artCache[tokenId].progress = 20;
    
    // Step 4: Get character description from cache or generate it
    let description;
    if (analysisCache[tokenId]) {
      console.log(`[API-V2] Using cached analysis for token #${tokenId}`);
      description = analysisCache[tokenId].description;
    } else {
      console.log(`[API-V2] Analyzing image for token #${tokenId}...`);
      description = await analyzeImageWithGPT(tokenId, nftData.image_url, nftData.traits);
      console.log(`[API-V2] Analysis complete for token #${tokenId}`);
    }
    
    // Update progress
    artCache[tokenId].progress = 30;
    
    // Step 5: Start the image generation process and immediately return to client
    console.log(`[API-V2] Initiating V2 image generation for token #${tokenId}...`);
    console.log(`[API-V2] Using reference image: ${nftData.image_url}`);
    
    // Send an immediate response with background processing info
    res.json({
      success: true,
      tokenId,
      message: "Art generation initiated in the background",
      statusEndpoint: `/api/debug/image/${tokenId}`,
      processingStarted: true,
      startedAt: artCache[tokenId].startTime,
      progress: artCache[tokenId].progress
    });
    
    // Continue processing in the background after response is sent
    (async () => {
      try {
        console.log(`[API-V2] Background processing continuing for token #${tokenId}`);
        
        const newArtUrl = await generateFullBodyArtV2(tokenId, description, forceGenerate, nftData);
        
        if (!newArtUrl) {
          console.error(`[API-V2] Background generation failed for token #${tokenId}`);
          artCache[tokenId].processing = false;
          artCache[tokenId].failed = true;
          artCache[tokenId].failedAt = new Date().toISOString();
          artCache[tokenId].error = "Failed to generate new art";
          return;
        }
        
        console.log(`[API-V2] Background generation successful for token #${tokenId}! URL: ${newArtUrl}`);
        
        // Update the art cache entry with success info
        let version = 1;
        if (artCache[tokenId] && artCache[tokenId].version) {
          version = artCache[tokenId].version + 1;
        }
        
        // Make sure to save the updated cache to disk
        await fs.writeFile(ART_CACHE_FILE, JSON.stringify(artCache, null, 2), 'utf8');
        console.log(`[API-V2] Art cache updated for token #${tokenId}`);
        
      } catch (bgError) {
        console.error(`[API-V2] Error in background processing for token #${tokenId}:`, bgError.message);
        
        // Update art cache with failure info
        if (artCache[tokenId]) {
          artCache[tokenId].processing = false;
          artCache[tokenId].failed = true;
          artCache[tokenId].failedAt = new Date().toISOString();
          artCache[tokenId].error = bgError.message;
          
          // Save the updated cache
          try {
            await fs.writeFile(ART_CACHE_FILE, JSON.stringify(artCache, null, 2), 'utf8');
          } catch (saveErr) {
            console.error(`[API-V2] Error saving art cache:`, saveErr);
          }
        }
      }
    })();
    
  } catch (error) {
    console.error(`[API-V2] Error generating art: ${error.message}`);
    
    // Update art cache with failure info
    if (artCache[tokenId]) {
      artCache[tokenId].processing = false;
      artCache[tokenId].failed = true;
      artCache[tokenId].failedAt = new Date().toISOString();
      artCache[tokenId].error = error.message;
    }
    
    res.status(500).json({
      success: false,
      error: `V2 API generation failed: ${error.message}`
    });
  }
});

// Add an endpoint to generate new art for an existing token (using V1 API)
app.post("/api/regenerate-art/:tokenId", async (req, res) => {
  try {
    const { tokenId } = req.params;
    
    // Check if we have an existing analysis for this token
    if (!analysisCache[tokenId]) {
      return res.status(404).json({
        success: false,
        error: "No analysis found for this token ID. Please generate a card first."
      });
    }
    
    // Get the existing description
    const description = analysisCache[tokenId].description;
    
    // Generate new art using the existing description with force regenerate
    console.log(`[API-V1] Regenerating art for token #${tokenId}...`);
    console.log(`[API-V1] Using GoAPI Midjourney with force=true`);
    console.log(`[API-V1] GOAPI key exists: ${!!process.env.GOAPI_API_KEY}`);
    
    try {
      // Step 1: Get NFT data to include image reference
      console.log("[API-V1] Fetching NFT data to use as image reference");
      let nftData = null;
      
      try {
        const nftUrl = `https://api.opensea.io/api/v2/chain/${CHAIN}/contract/${CONTRACT_ADDRESS}/nfts/${tokenId}`;
        const nftResponse = await fetch(nftUrl, { headers: { "X-API-KEY": OPENSEA_API_KEY } });
        
        if (nftResponse.ok) {
          nftData = (await nftResponse.json()).nft;
          console.log("[API-V1] Retrieved NFT image URL for reference:", nftData.image_url);
          
          // Step 2: Verify the NFT image is accessible
          if (nftData.image_url) {
            console.log("[API-V1] Verifying NFT image accessibility");
            
            let imageVerified = false;
            try {
              const imgCheck = await fetch(nftData.image_url, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                  'Accept': 'image/*'
                }
              });
              
              if (imgCheck.ok) {
                // Try to get some actual image data to confirm accessibility
                const imageBlob = await imgCheck.blob();
                
                if (imageBlob.size > 0) {
                  console.log(`[API-V1] NFT image verified (${imageBlob.size} bytes)`);
                  imageVerified = true;
                } else {
                  console.warn("[API-V1] NFT image response valid but empty (0 bytes)");
                }
              } else {
                console.warn(`[API-V1] NFT image check failed: ${imgCheck.status}`);
              }
            } catch (imgError) {
              console.warn(`[API-V1] Error verifying NFT image: ${imgError.message}`);
            }
            
            // If image verification failed, use proxy
            if (!imageVerified) {
              console.log("[API-V1] Using proxy URL for NFT image reference");
              nftData.image_url = `/api/proxy-image?url=${encodeURIComponent(nftData.image_url)}`;
            }
          }
        } else {
          console.warn(`[API-V1] Failed to fetch NFT data: ${nftResponse.status}`);
        }
      } catch (nftError) {
        console.warn("[API-V1] Could not retrieve NFT data for reference:", nftError.message);
      }
      
      // Step 3: Start the image generation process
      console.log("[API-V1] Starting generation with generateFullBodyArt");
      console.log("[API-V1] Using NFT reference:", nftData?.image_url || "none available");
      
      // Force regenerate with GoAPI only - will throw an error if it fails
      const newArtUrl = await generateFullBodyArt(tokenId, description, true, nftData);
      console.log("[API-V1] Generated new art URL:", newArtUrl);
      
      // Test that the URL is valid and accessible
      try {
        console.log("[API-V1] Testing image URL accessibility");
        const GOAPI_API_KEY = process.env.GOAPI_API_KEY;
        const testHeaders = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        };
        
        // If it's a GoAPI URL, add the API key
        if (newArtUrl.includes('theapi.app') || newArtUrl.includes('img.theapi.app')) {
          console.log("[API-V1] Adding GoAPI key to test request");
          testHeaders['x-api-key'] = GOAPI_API_KEY;
        }
        
        const testResponse = await fetch(newArtUrl, { 
          method: 'HEAD', 
          headers: testHeaders
        });
        
        console.log("[API-V1] Image URL test result:", testResponse.status, testResponse.statusText);
        if (!testResponse.ok) {
          console.warn("[API-V1] Generated image may not be accessible directly, but will be served through proxy");
        }
      } catch (testErr) {
        console.error("[API-V1] Error testing image URL:", testErr);
        // Continue anyway since we'll use the proxy
      }
      
      // Re-fetch nft data to make everything consistent
      console.log("[API-V1] Getting current NFT data for updated response");
      try {
        const nftUrl = `https://api.opensea.io/api/v2/chain/${CHAIN}/contract/${CONTRACT_ADDRESS}/nfts/${tokenId}`;
        const nftResponse = await fetch(nftUrl, { headers: { "X-API-KEY": OPENSEA_API_KEY } });
        if (nftResponse.ok) {
          const nftData = (await nftResponse.json()).nft;
          
          // Get card details from cache
          const cardDetails = cardDetailsCache[tokenId] ? 
            cardDetailsCache[tokenId].cardDetails : 
            await generateCardDetailsWithGPT(tokenId, nftData.traits, description);
          
          console.log("[API-V1] Sending full response with all card data");
          res.json({
            success: true,
            tokenId,
            artUrl: newArtUrl,
            nftImage: nftData.image_url,
            nftTraits: nftData.traits.filter(t => t.trait_type !== "Background"),
            identifier: nftData.identifier,
            cardDetails,
            fullArtUrl: newArtUrl,
            description: description,
            generator: "midjourney", // Explicitly mark as Midjourney-generated
            generatedAt: new Date().toISOString()
          });
          return;
        }
      } catch (err) {
        console.log("[API-V1] Error getting NFT data for complete response:", err);
        // Fall through to simplified response
      }
    
      // Simplified response if full data couldn't be fetched
      console.log("[API-V1] Sending simplified response with just art URL");
      res.json({
        success: true,
        tokenId,
        artUrl: newArtUrl,
        generator: "midjourney", // Explicitly mark as Midjourney-generated
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error(`[API-V1] Error with GoAPI image generation: ${error.message}`);
      res.status(500).json({
        success: false,
        error: `GoAPI generation failed: ${error.message}`,
        usingGoAPI: true
      });
    }
  } catch (error) {
    console.error("[API-V1] Error regenerating art:", error);
    res.status(500).json({
      success: false,
      error: "Failed to regenerate art: " + error.message,
      usingGoAPI: true
    });
  }
});

// Add debug endpoint for checking image status
app.get("/api/debug/image/:tokenId", async (req, res) => {
  const { tokenId } = req.params;
  
  try {
    console.log(`[API] Debug endpoint called for token #${tokenId}`);
    
    // Check if we have a real cached full art image for this token
    if (artCache[tokenId] && artCache[tokenId].url) {
      console.log(`[API] Found cached full art for token #${tokenId}: ${artCache[tokenId].url}`);
      
      // Return the actual cached full art data
      res.json({
        success: true,
        tokenId,
        // Key fields for frontend polling - return complete with actual URL
        imageStatus: "complete",
        fullArtUrl: artCache[tokenId].url,
        progress: 100,
        // Status flags
        processing: false,
        completed: true,
        // Include metadata
        created: artCache[tokenId].timestamp || new Date().toISOString(),
        version: artCache[tokenId].version || 1,
        lastUpdated: new Date().toISOString(),
        completedAt: artCache[tokenId].timestamp || new Date().toISOString(),
        timestamp: new Date().toISOString()
      });
    } else {
      // If no cached data exists, still return a successful response but without fullArtUrl
      console.log(`[API] No cached full art found for token #${tokenId}`);
      res.json({
        success: true,
        tokenId,
        // Key fields for frontend polling - no full art available
        imageStatus: "complete",
        progress: 100,
        // Status flags
        processing: false,
        completed: true,
        // Include metadata
        created: new Date().toISOString(),
        version: 1,
        lastUpdated: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error(`Error in debug endpoint for token #${tokenId}:`, error);
    res.status(500).json({
      success: false,
      message: "Error checking image status",
      error: error.message
    });
  }
});

// Add route to serve processed images
app.get("/api/processed-images/:filename", async (req, res) => {
  try {
    const filename = req.params.filename;
    if (!filename || filename.includes('..')) {
      return res.status(400).send("Invalid filename");
    }
    
    const filePath = path.join(CACHE_DIR, 'processed_images', filename);
    console.log(`[IMAGE] Serving processed image: ${filePath}`);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (err) {
      return res.status(404).send("Processed image not found");
    }
    
    // Determine content type based on extension
    let contentType = 'image/png'; // Default
    if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
      contentType = 'image/jpeg';
    } else if (filename.endsWith('.webp')) {
      contentType = 'image/webp';
    }
    
    // Set advanced caching headers for processed images
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable'); // Cache for 7 days
    res.setHeader('ETag', `"${filename}-${fsSync.statSync(filePath).size}"`);
    res.setHeader('Expires', new Date(Date.now() + 604800000).toUTCString()); // 7 days
    res.setHeader('Last-Modified', fsSync.statSync(filePath).mtime.toUTCString());
    
    // Stream the file
    const fileStream = fsSync.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error(`[IMAGE] Error serving processed image: ${error.message}`);
    res.status(500).send("Error serving image");
  }
});

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0'; // Listen on all available network interfaces

// Load prompts first, then start server
loadPrompts().then(() => {
  app.listen(PORT, HOST, () => {
    console.log(`Server running on ${HOST}:${PORT}`);
    console.log(`Express API available at http://localhost:${PORT}/api/health`);
    console.log('Prompts loaded:', Object.keys(PROMPTS).join(', '));
  });
});