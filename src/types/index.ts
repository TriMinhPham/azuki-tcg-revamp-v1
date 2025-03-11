/**
 * Type definitions for the application
 */

// NFT Trait type from OpenSea API
export interface NFTTrait {
  trait_type: string;
  value: string;
}

// NFT Data from OpenSea
export interface NFTData {
  identifier: string;
  image_url: string;
  traits: NFTTrait[];
  name?: string;
  collection?: string;
}

// Card move details
export interface CardMove {
  name: string;
  atk: string;
}

// Card details generated by OpenAI
export interface CardDetails {
  cardName: string;
  typeIcon: string;
  hp: string;
  move: CardMove;
  moveDescription?: string; // New field for move description
  weakness: string;
  resistance: string;
  retreatCost: string;
  rarity: string;
}

// Card data for rendering
export interface CardData {
  cardName: string;
  hp: string;
  type: string;
  move: {
    name: string;
    damage: string;
  };
  moveDescription?: string; // New field for move description
  weakness: string;
  resistance: string;
  retreatCost: string;
  rarity: string;
  normalImageUrl: string;
  fullArtImageUrl: string | null;
  allArtImageUrls?: string[]; // Added to include all 4 image variants
  cardColor: string;
  traits: string;
}

// Response from card API endpoint
export interface CardResponse {
  success: boolean;
  tokenId?: string;
  nftImage?: string;
  nftTraits?: NFTTrait[];
  identifier?: string;
  cardDetails?: CardDetails;
  description?: string;
  fullArtUrl?: string;
  fullArtProcessing?: boolean;
  cardColor?: string;
  temporary_image_urls?: string[];
  allImageUrls?: string[]; // Added to include all 4 image variants
  error?: string;
  // Additional fields for art generation status
  progress?: number;
  imageStatus?: string;
  completed?: boolean;
  processing?: boolean;
}

// Gallery item type for artwork history
export interface GalleryItem {
  tokenId: string;
  url: string;
  quadrants?: Array<{ url: string; number: number }>;
  timestamp: string;
  version: number;
  isFallback?: boolean;
  allImageUrls?: string[]; // Added for gallery items with multiple images
}

// Pagination data for gallery
export interface Pagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

// Gallery response from API
export interface GalleryResponse {
  success: boolean;
  data: GalleryItem[];
  pagination: Pagination;
}

// Cache entry type for art cache
export interface ArtCacheEntry {
  url: string;
  timestamp: string;
  tokenId: string;
  description?: string;
  allImageUrls?: string[];
  version?: number;
  isFallback?: boolean;
  temporary_image_urls?: string[];
  isGridResult?: boolean;
  task_id?: string;
}

// Cache entry for analysis results
export interface AnalysisCacheEntry {
  description: string;
  timestamp: string;
  traits?: string;
}

// Cache entry for card details
export interface CardDetailsCacheEntry {
  cardDetails: CardDetails;
  timestamp: string;
  description?: string;
  traitCount?: number;
}