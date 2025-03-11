/**
 * Advanced texture loading utility for Three.js
 * Provides texture caching, memory management, and progressive loading
 */
import * as THREE from 'three';
import { memoryManager } from './memoryManager';

// Configuration
const MAX_CONCURRENT_LOADS = 6;
const MEMORY_LIMIT_MB = 100; // Maximum texture memory usage in MB (approx)
const DEFAULT_ANISOTROPY = 4; // Default anisotropy level (can be increased for quality)

// Texture cache to prevent duplicate loading
const textureCache = new Map<string, THREE.Texture>();

// Loading queue for prioritizing textures
type QueueItem = {
  url: string;
  options: TextureOptions;
  resolve: (texture: THREE.Texture) => void;
  reject: (error: Error) => void;
  priority: 'high' | 'normal' | 'low';
  addedTime: number;
};

// Track active and queued loads
const loadingQueue: QueueItem[] = [];
let activeLoads = 0;
let estimatedMemoryUsage = 0;

// Loading manager to track progress
const loadingManager = new THREE.LoadingManager();
const textureLoader = new THREE.TextureLoader(loadingManager);

// Debug reporting interval
let lastReportTime = 0;
const REPORT_INTERVAL = 5000; // Report stats every 5 seconds (when active)

// Helper to estimate texture memory size in bytes
function estimateTextureSize(texture: THREE.Texture): number {
  if (!texture.image) return 0;
  
  const { width, height } = texture.image;
  
  // Base size: width * height * 4 bytes per pixel (RGBA)
  let bytes = width * height * 4;
  
  // Account for mipmaps (adds ~33% more memory)
  if (texture.generateMipmaps) {
    bytes = bytes * 1.33;
  }
  
  // Some formats are more efficient
  if (texture.format === THREE.RGBFormat) {
    bytes = bytes * 0.75; // 3 bytes per pixel instead of 4
  }
  
  return bytes;
}

// Texture loading options
export interface TextureOptions {
  anisotropy?: number;
  generateMipmaps?: boolean;
  wrapS?: THREE.Wrapping;
  wrapT?: THREE.Wrapping;
  minFilter?: THREE.TextureFilter;
  magFilter?: THREE.TextureFilter;
  colorSpace?: THREE.ColorSpace;
  flipY?: boolean;
  priority?: 'high' | 'normal' | 'low';
  onProgress?: (progress: number) => void;
}

// Public API

/**
 * Load a texture with memory management and caching
 * @param url - URL of the texture to load
 * @param options - Texture options
 * @returns Promise that resolves to the loaded texture
 */
export function loadTexture(url: string, options: TextureOptions = {}): Promise<THREE.Texture> {
  // Use placeholder for empty URLs to prevent errors
  if (!url) {
    console.warn('Empty texture URL provided, using placeholder');
    url = '/placeholder.png';
  }
  
  // Generate cache key based on URL and relevant options
  const cacheKey = getCacheKey(url, options);
  
  // Return cached texture if available
  if (textureCache.has(cacheKey)) {
    const texture = textureCache.get(cacheKey)!;
    // Update "last used" timestamp for cache management
    memoryManager.markAsUsed(texture);
    return Promise.resolve(texture);
  }
  
  // Check if we're already loading this texture
  const existingQueueItem = loadingQueue.find(item => getCacheKey(item.url, item.options) === cacheKey);
  if (existingQueueItem) {
    // Return the promise for the existing request
    return new Promise((resolve, reject) => {
      existingQueueItem.resolve = (texture) => {
        resolve(texture);
        existingQueueItem.resolve(texture);
      };
      existingQueueItem.reject = (error) => {
        reject(error);
        existingQueueItem.reject(error);
      };
    });
  }
  
  // Create a new loading promise
  return new Promise<THREE.Texture>((resolve, reject) => {
    // Add to queue
    loadingQueue.push({
      url,
      options,
      resolve,
      reject,
      priority: options.priority || 'normal',
      addedTime: Date.now()
    });
    
    // Process the queue
    processQueue();
  });
}

/**
 * Preload multiple textures with specified priority
 * @param urls - Array of texture URLs to preload
 * @param options - Texture options including priority
 * @returns Promise that resolves when all textures are loaded
 */
export function preloadTextures(
  urls: string[], 
  options: TextureOptions = {}
): Promise<THREE.Texture[]> {
  if (!urls || urls.length === 0) {
    return Promise.resolve([]);
  }
  
  // Report what we're loading
  console.debug(`[TextureLoader] Preloading ${urls.length} textures with priority ${options.priority || 'normal'}`);
  
  // Load all textures
  const promises = urls.map(url => loadTexture(url, options));
  return Promise.all(promises);
}

/**
 * Clear the texture cache to free memory
 * Will dispose all textures that aren't actively referenced
 */
export function clearTextureCache(): void {
  // Dispose of all textures in cache
  textureCache.forEach(texture => {
    texture.dispose();
  });
  
  // Clear cache
  textureCache.clear();
  estimatedMemoryUsage = 0;
  
  console.debug('[TextureLoader] Texture cache cleared');
}

/**
 * Get current texture loader statistics
 */
export function getTextureLoaderStats() {
  return {
    cacheSize: textureCache.size,
    queuedLoads: loadingQueue.length,
    activeLoads,
    estimatedMemoryUsageMB: estimatedMemoryUsage / (1024 * 1024)
  };
}

// Internal helpers

// Process the texture loading queue
function processQueue(): void {
  // If we have too many active loads, wait
  if (activeLoads >= MAX_CONCURRENT_LOADS) {
    return;
  }
  
  // Sort queue by priority and time added
  loadingQueue.sort((a, b) => {
    // Primary sort by priority
    const priorityOrder = { high: 0, normal: 1, low: 2 };
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    
    // Secondary sort by age (older first)
    return a.addedTime - b.addedTime;
  });
  
  // Take item from front of queue
  const item = loadingQueue.shift();
  if (!item) {
    return;
  }
  
  // Load the texture
  activeLoads++;
  const url = item.url;
  
  // Progress reporting
  logLoadingProgress();
  
  // Use Three.js TextureLoader to load the texture
  textureLoader.load(
    url,
    (texture) => {
      try {
        // Apply options
        texture.anisotropy = item.options.anisotropy ?? DEFAULT_ANISOTROPY;
        texture.generateMipmaps = item.options.generateMipmaps ?? true;
        texture.wrapS = item.options.wrapS ?? THREE.ClampToEdgeWrapping;
        texture.wrapT = item.options.wrapT ?? THREE.ClampToEdgeWrapping;
        texture.minFilter = item.options.minFilter ?? THREE.LinearMipmapLinearFilter;
        texture.magFilter = item.options.magFilter ?? THREE.LinearFilter;
        texture.colorSpace = item.options.colorSpace ?? THREE.SRGBColorSpace;
        texture.flipY = item.options.flipY ?? true;
        texture.needsUpdate = true;
        
        // Estimate memory usage
        const textureSizeBytes = estimateTextureSize(texture);
        estimatedMemoryUsage += textureSizeBytes;
        
        // Check if we need to clear some textures from memory
        if (estimatedMemoryUsage > MEMORY_LIMIT_MB * 1024 * 1024) {
          console.debug(`[TextureLoader] Memory limit (${MEMORY_LIMIT_MB}MB) exceeded, cleaning LRU textures`);
          // Use memory manager to clean up unused textures
          memoryManager.disposeUnused(30000); // Dispose textures unused for 30+ seconds
        }
        
        // Generate cache key and store in cache
        const cacheKey = getCacheKey(url, item.options);
        textureCache.set(cacheKey, texture);
        
        // Track with memory manager
        memoryManager.track(texture, 'texture');
        
        // Resolve promise
        item.resolve(texture);
      } catch (error) {
        console.error(`[TextureLoader] Error processing loaded texture: ${error}`);
        item.reject(error instanceof Error ? error : new Error(`${error}`));
      } finally {
        // Continue processing queue
        activeLoads--;
        processQueue();
      }
    },
    (progressEvent) => {
      // Progress reporting if provided
      if (item.options.onProgress) {
        item.options.onProgress(progressEvent ? progressEvent.loaded / progressEvent.total : 0);
      }
    },
    (error) => {
      console.warn(`[TextureLoader] Failed to load texture: ${url}`, error);
      item.reject(new Error(`Failed to load texture: ${url}`));
      activeLoads--;
      processQueue();
    }
  );
  
  // Process more items if we have capacity
  if (activeLoads < MAX_CONCURRENT_LOADS && loadingQueue.length > 0) {
    processQueue();
  }
}

// Generate a cache key for texture options
function getCacheKey(url: string, options: TextureOptions): string {
  const optionsKey = [
    options.anisotropy,
    options.generateMipmaps,
    options.wrapS,
    options.wrapT,
    options.minFilter,
    options.magFilter,
    options.colorSpace,
    options.flipY
  ].join('|');
  
  return `${url}|${optionsKey}`;
}

// Log loading progress (with rate limiting)
function logLoadingProgress(): void {
  const now = Date.now();
  if (now - lastReportTime > REPORT_INTERVAL && (activeLoads > 0 || loadingQueue.length > 0)) {
    const stats = getTextureLoaderStats();
    console.debug(`[TextureLoader] Status: ${activeLoads} active loads, ${loadingQueue.length} queued, ${stats.cacheSize} cached textures, ${stats.estimatedMemoryUsageMB.toFixed(1)}MB memory usage`);
    lastReportTime = now;
  }
}

// Purge cache based on least recently used
export function purgeUnusedTextures(olderThanMs: number = 60000): void {
  console.debug(`[TextureLoader] Purging textures unused for more than ${olderThanMs}ms`);
  memoryManager.disposeUnused(olderThanMs);
  
  // Update estimated memory usage based on remaining textures
  estimatedMemoryUsage = 0;
  textureCache.forEach(texture => {
    estimatedMemoryUsage += estimateTextureSize(texture);
  });
  
  console.debug(`[TextureLoader] After purge: ${textureCache.size} textures remaining, ${(estimatedMemoryUsage / (1024 * 1024)).toFixed(1)}MB memory usage`);
}

// Export texture loader for direct access
export { textureLoader };