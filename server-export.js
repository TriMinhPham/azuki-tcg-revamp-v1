// Enhanced server export file for Vercel and other cloud platforms
const express = require("express");
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const cors = require("cors");
const path = require("path");
const fsSync = require("fs");
const fs = require("fs").promises;
require("dotenv").config();

// Import the cache system and helper functions
const sharp = require('sharp'); // Image processing library for thumbnails
const CACHE_DIR = path.join(__dirname, 'cache');
const ANALYSIS_CACHE_FILE = path.join(CACHE_DIR, 'analysis_cache.json');
const CARD_DETAILS_CACHE_FILE = path.join(CACHE_DIR, 'card_details_cache.json');
const ART_CACHE_FILE = path.join(CACHE_DIR, 'art_cache.json');

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

// Create router for API endpoints
const router = express.Router();

// Add CORS headers to all responses
router.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-KEY']
}));

// Parse JSON requests with a reasonable limit
router.use(express.json({ limit: '1mb' }));
router.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Define API keys - these are loaded from .env
const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY;
const GPT_API_KEY = process.env.GPT_API_KEY;
// GOAPI_API_KEY is fetched directly from process.env where needed
const CHAIN = "ethereum";
const CONTRACT_ADDRESS = "0xed5af388653567af2f388e6224dc7c4b3241c544";

// Debug environment variables for startup
console.log("Environment variables loaded:");
console.log("- OPENSEA_API_KEY exists:", !!OPENSEA_API_KEY);
console.log("- GPT_API_KEY exists:", !!GPT_API_KEY);
console.log("- GOAPI_API_KEY exists:", !!process.env.GOAPI_API_KEY);
console.log("- Running in:", process.env.VERCEL ? 'Vercel' : (process.env.NODE_ENV || 'development'));

// Enhanced API health check endpoint
router.get('/api/health', (req, res) => {
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
    environment: process.env.VERCEL ? 'vercel' : (process.env.NODE_ENV || 'development'),
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

// Simple test endpoint
router.get('/api/test', (req, res) => {
  res.json({
    message: 'API is working on ' + (process.env.VERCEL ? 'Vercel' : 'Server'),
    timestamp: new Date().toISOString(),
    cacheInitialized: Object.keys(artCache).length > 0
  });
});

// GoAPI test endpoint
router.get("/api/test-goapi", async (req, res) => {
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

// Initialize the caches in the background
initCache().then(() => {
  console.log("Cache system initialized");
}).catch(err => {
  console.error("Failed to initialize cache system:", err);
});

// Load prompts in the background
loadPrompts().then(() => {
  console.log("Prompts loaded:", Object.keys(PROMPTS).join(', '));
}).catch(err => {
  console.error("Failed to load prompts:", err);
});

// Standalone server only when not on Vercel
if (!process.env.VERCEL) {
  // Only when running as a standalone server, not as serverless function
  const app = express();
  app.use(router);
  app.use(express.static(path.join(__dirname, 'dist')));
  
  // Handle SPA routing
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
  
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Export the router for use in serverless functions
module.exports = router;