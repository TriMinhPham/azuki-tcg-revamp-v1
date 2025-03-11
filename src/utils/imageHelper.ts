/**
 * Utilities for image handling and processing
 */

/**
 * Creates a proxy URL for an image to avoid CORS issues
 * @param url The original image URL
 * @param isMidjourney Whether the image is from Midjourney
 * @param options Additional options for the proxy
 * @returns A proxy URL
 */
export const createProxyUrl = (
  url: string, 
  isMidjourney = false, 
  options: {
    thumbnail?: boolean,
    quality?: 'low' | 'medium' | 'high',
    timeout?: number
  } = {}
): string => {
  if (!url) return url;
  
  const isTheapiUrl = url.includes('theapi.app');
  const timestamp = Date.now();
  const params = new URLSearchParams();
  
  // Add the base URL parameter
  params.append('url', url);
  params.append('timestamp', timestamp.toString());
  
  if (isTheapiUrl) {
    // Don't add midjourney parameter for theapi.app URLs
  } else if (isMidjourney || isMidjourneyUrl(url)) {
    // Add special handling for Midjourney CDN URLs
    params.append('midjourney', 'true');
  }
  
  // Add optional parameters if specified
  if (options.thumbnail) {
    params.append('thumbnail', '1');
  }
  
  if (options.quality) {
    params.append('quality', options.quality);
  }
  
  if (options.timeout) {
    params.append('timeout', options.timeout.toString());
  }
  
  return `/api/proxy-image?${params.toString()}`;
};

/**
 * Extracts the original URL from a proxy URL
 * @param proxyUrl The proxy URL
 * @returns The original URL or null if not found
 */
export const extractOriginalUrl = (proxyUrl: string): string | null => {
  try {
    if (proxyUrl && proxyUrl.startsWith('/api/proxy-image')) {
      const urlParams = new URLSearchParams(proxyUrl.split('?')[1]);
      return urlParams.get('url');
    }
    return null;
  } catch (err) {
    console.error('Error extracting original URL:', err);
    return null;
  }
};

/**
 * Pre-loads an image to ensure it's in browser cache
 * @param url The image URL to preload
 * @returns A promise that resolves when the image is loaded
 */
export const preloadImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error(`Failed to load image: ${e}`));
    img.src = url;
  });
};

/**
 * Determines if an image URL is from Midjourney's CDN
 * @param url The image URL to check
 * @returns Boolean indicating if it's a Midjourney URL
 */
export const isMidjourneyUrl = (url: string): boolean => {
  if (!url) return false;
  
  // Enhanced detection for Midjourney URLs
  return (
    url.includes('midjourney.com') || 
    url.includes('cdn.midjourney.com') ||
    // Check for UUIDs which are common in Midjourney URLs
    /cdn\.midjourney\.com\/[a-f0-9-]{36}\//.test(url) ||
    // Look for the ID pattern in the URL
    /\/[a-f0-9-]{8}-[a-f0-9-]{4}-[a-f0-9-]{4}-[a-f0-9-]{4}-[a-f0-9-]{12}\//.test(url)
  );
};

/**
 * Checks if an image URL is from theapi.app
 * @param url The image URL to check
 * @returns Boolean indicating if it's a theapi.app URL
 */
export const isTheApiUrl = (url: string): boolean => {
  return url.includes('theapi.app') || url.includes('img.theapi.app');
};

/**
 * Creates a fallback placeholder image URL
 * @param text Text to display on the placeholder
 * @param width Width of the placeholder
 * @param height Height of the placeholder
 * @returns URL to a placeholder image
 */
export const createPlaceholder = (
  text = 'Image Unavailable',
  width = 600,
  height = 800
): string => {
  return `https://placehold.co/${width}x${height}/3A0465/FFFFFF?text=${encodeURIComponent(text)}`;
};