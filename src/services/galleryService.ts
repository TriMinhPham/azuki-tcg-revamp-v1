/**
 * Gallery Service - Handles all gallery data operations
 * This separates API logic from UI components
 */
import { GalleryResponse, GalleryItem } from '@/types';
import api from '@/utils/api';

/**
 * Fetch gallery data with pagination and filtering
 * @param page Page number (1-based)
 * @param limit Items per page
 * @param filter Filter option (all, recent, popular)
 * @param search Search term
 */
export async function fetchGalleryItems(
  page = 1,
  limit = 12,
  filter = 'all',
  search = ''
): Promise<GalleryResponse> {
  try {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      filter,
      search
    });
    
    const response = await api.get<GalleryResponse>(`/gallery?${params.toString()}`);
    
    // Process gallery items to ensure all have proper quadrants
    if (response.data.data) {
      response.data.data = processGalleryItems(response.data.data);
    }
    
    return response.data;
  } catch (error) {
    console.error('Error fetching gallery data:', error);
    throw error;
  }
}

/**
 * Process gallery items to ensure consistent data structure
 * This fixes issues with quadrants and handles different API response formats
 * @param items Gallery items from API
 */
export function processGalleryItems(items: GalleryItem[]): GalleryItem[] {
  if (!items || items.length === 0) return [];
  
  console.log(`Processing ${items.length} gallery items...`);
  
  return items.map(item => {
    // Track if we've made changes
    let updatedItem = { ...item };
    
    // Log all item data sources for debugging
    console.log(`Processing gallery item ${item.tokenId}:`, {
      hasAllImageUrls: !!item.allImageUrls && item.allImageUrls.length > 0,
      allImageUrlsCount: item.allImageUrls?.length || 0,
      hasQuadrants: !!item.quadrants && item.quadrants.length > 0,
      quadrantsCount: item.quadrants?.length || 0,
      url: item.url?.substring(0, 50) + '...',
    });
    
    // ALWAYS create quadrants if we have allImageUrls
    if (item.allImageUrls && item.allImageUrls.length > 0) {
      // Force create quadrants from allImageUrls regardless of existing quadrants
      updatedItem.quadrants = item.allImageUrls.map((url, idx) => ({
        url: url,
        number: idx + 1
      }));
      updatedItem.hasMultipleVariants = true;
      console.log(`Created ${updatedItem.quadrants.length} quadrants from allImageUrls for token ${item.tokenId}`);
    }
    
    // Fix missing URL by using the first quadrant URL if available
    if (!updatedItem.url && updatedItem.quadrants && updatedItem.quadrants.length > 0) {
      updatedItem.url = updatedItem.quadrants[0].url;
      console.log(`Fixed missing URL for token ${item.tokenId} using first quadrant URL`);
    }
    
    // Ensure tokenId is populated
    if (!updatedItem.tokenId && updatedItem.cacheKey) {
      const tokenIdMatch = updatedItem.cacheKey.match(/^(\d+)_/);
      if (tokenIdMatch) {
        updatedItem.tokenId = tokenIdMatch[1];
        console.log(`Fixed missing tokenId for item using cacheKey: ${updatedItem.tokenId}`);
      }
    }
    
    return updatedItem;
  });
}

/**
 * Process a single gallery item when it's selected
 * Adds any missing URLs or data needed for display
 * @param item Gallery item
 */
export function prepareGalleryItemForDisplay(item: GalleryItem): GalleryItem {
  if (!item) return item;
  
  const prepared = { ...item };
  
  // Ensure main URL exists
  if (!prepared.url && prepared.quadrants && prepared.quadrants.length > 0) {
    prepared.url = prepared.quadrants[0].url;
  }
  
  // Process quadrants if needed
  if (prepared.allImageUrls && prepared.allImageUrls.length > 0) {
    // Ensure quadrants exist
    if (!prepared.quadrants || prepared.quadrants.length === 0) {
      prepared.quadrants = prepared.allImageUrls.map((url, idx) => ({
        url: url,
        number: idx + 1
      }));
      prepared.hasMultipleVariants = true;
    }
  }
  
  return prepared;
}