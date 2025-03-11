/**
 * Application constants 
 */

export const API_ENDPOINTS = {
  // Base URL for OpenSea API
  OPENSEA: 'https://api.opensea.io/api/v2',
  
  // Base URL for OpenAI API
  OPENAI: 'https://api.openai.com/v1',
  
  // Base URL for GoAPI.ai
  GOAPI: 'https://api.goapi.ai',
  
  // Midjourney API endpoint via GoAPI
  MIDJOURNEY: 'https://api.goapi.ai/mj/v2/imagine',
};

export const CONTRACT = {
  ADDRESS: '0xed5af388653567af2f388e6224dc7c4b3241c544', // Azuki contract
  CHAIN: 'ethereum',                                     // Network chain
};

export const CACHE_PATHS = {
  ART_CACHE: './cache/art_cache.json',
  ANALYSIS_CACHE: './cache/analysis_cache.json',
  CARD_DETAILS_CACHE: './cache/card_details_cache.json',
  SPLIT_IMAGES: './cache/split_images',
};

export const MAX_POLL_ATTEMPTS = 60; // Max polling attempts (5 minutes at 5-second intervals)
export const POLL_INTERVAL = 5000;   // Poll interval in milliseconds

export const PLACEHOLDER_IMAGES = {
  // Use local fallback images to avoid dependence on external services
  NORMAL: '/cardback.jpg',
  FULL_ART: '/cardback.jpg',
  FALLBACK_DESCRIPTION: 'A character with a modern anime style, featuring unique hair and clothing.',
  
  // Original remote images (commented out)
  // NORMAL: 'https://cdn.glitch.global/81a7ec98-48d4-49ed-a5ce-25049f0fb3a9/azuki-1834.png?v=1740923569892',
  // FULL_ART: 'https://placehold.co/600x800/3A0465/FFFFFF?text=Image+Unavailable',
};