/**
 * Card Service - Handles all card data operations
 * This separates API logic from UI components
 */
import { CardResponse, CardData } from '@/types';
import api from '@/utils/api';
import { createProxyUrl, isMidjourneyUrl } from '@/utils/imageHelper';
import { PLACEHOLDER_IMAGES } from '@/config/constants';

/**
 * Fetch card data from the API
 * @param tokenId The Azuki token ID
 */
export async function fetchCard(tokenId: string): Promise<CardResponse> {
  try {
    console.log(`[API] Requesting NFT card data for token #${tokenId} from: /api/card/${tokenId}`);
    const response = await api.get<CardResponse>(`/card/${tokenId}`);
    
    // Log detailed response for debugging
    console.log(`[API] Raw card data response status: ${response.status}`);
    console.log(`[API] Response data:`, response.data);
    
    // Check important fields in the response
    if (!response.data.nftImage) {
      console.warn(`[API] Missing nftImage field in response for token #${tokenId}`);
    }
    
    if (response.data.fullArtProcessing) {
      console.log(`[API] Full art processing is in progress for token #${tokenId}`);
    }
    
    return response.data;
  } catch (error) {
    console.error('[API] Error fetching card data:', error);
    
    // Log more details about the error
    if ('response' in error) {
      console.error(`[API] Error status: ${error.response?.status}`);
      console.error(`[API] Error data:`, error.response?.data);
    } else if ('request' in error) {
      console.error('[API] Request was made but no response received');
    } else {
      console.error('[API] Error setting up request:', error.message);
    }
    
    throw error;
  }
}

/**
 * Check the status of full art generation
 * @param tokenId The Azuki token ID
 */
export async function checkCardStatus(tokenId: string): Promise<CardResponse> {
  try {
    console.log(`[API] Checking card status for token #${tokenId}`);
    const response = await api.get<CardResponse>(`/debug/image/${tokenId}`);
    
    console.log(`[API] Card status response:`, response.data);
    
    // Log progress information
    if (response.data.progress !== undefined) {
      console.log(`[API] Art generation progress: ${response.data.progress}%`);
    }
    
    // Log image status
    if (response.data.imageStatus) {
      console.log(`[API] Image status: ${response.data.imageStatus}`);
    }
    
    // Check if we have a full art URL
    if (response.data.fullArtUrl) {
      console.log(`[API] Full art URL received: ${response.data.fullArtUrl.substring(0, 100)}...`);
    }
    
    return response.data;
  } catch (error) {
    console.error(`[API] Error checking card status for token #${tokenId}:`, error);
    
    if ('response' in error && error.response?.status === 404) {
      console.log(`[API] No image found for token #${tokenId}`);
      return { success: false, error: "No image found for this token ID" };
    }
    
    throw error;
  }
}

/**
 * Generate new art for a card
 * @param tokenId The Azuki token ID
 */
export async function generateNewCardArt(tokenId: string): Promise<CardResponse> {
  try {
    // Create API instance with longer timeout for generation
    const longTimeoutApi = api.getInstance({
      timeout: 120000 // 2 minutes
    });
    
    const response = await longTimeoutApi.post<CardResponse>(`/v2/generate-art/${tokenId}`);
    return response.data;
  } catch (error) {
    console.error('Error generating new card art:', error);
    throw error;
  }
}

/**
 * Transform API response into CardData structure
 * @param response API response from card endpoints
 * @param tokenId Optional tokenId to use if not in response
 */
export function transformResponseToCardData(response: CardResponse, tokenId?: string): CardData {
  console.log('[TRANSFORM] Starting to transform response to CardData', { tokenId });
  
  // Add defensive check for complete cardDetails
  const cardDetails = response.cardDetails || {
    cardName: "Generated Character",
    typeIcon: "🔥",
    hp: "100 HP",
    move: { name: "Magic Attack", atk: "40" },
    weakness: "💧 x2",
    resistance: "🪨 -20",
    retreatCost: "🌟",
    rarity: "★★"
  };
  
  // Log card details for debugging
  console.log('[TRANSFORM] Card details:', cardDetails);
  
  // Log NFT image information
  console.log('[TRANSFORM] NFT image URL:', response.nftImage);
  
  // Determine which image URL to use for full art
  let fullArtUrl = null;
  if (response.fullArtUrl && response.fullArtUrl.includes('cdn.midjourney.com')) {
    fullArtUrl = response.fullArtUrl;
    console.log('[TRANSFORM] Using Midjourney fullArtUrl:', fullArtUrl.substring(0, 100));
  } else if (response.temporary_image_urls && response.temporary_image_urls.length > 0) {
    // Look for Midjourney URL in temporary URLs
    const mjUrl = response.temporary_image_urls.find(url => url.includes('cdn.midjourney.com'));
    if (mjUrl) {
      fullArtUrl = mjUrl;
      console.log('[TRANSFORM] Using Midjourney URL from temporary_image_urls');
    } else {
      // If no Midjourney URL, use the first temporary URL
      fullArtUrl = response.temporary_image_urls[0];
      console.log('[TRANSFORM] Using first URL from temporary_image_urls');
    }
  } else if (response.fullArtUrl) {
    fullArtUrl = response.fullArtUrl;
    console.log('[TRANSFORM] Using non-Midjourney fullArtUrl:', fullArtUrl.substring(0, 100));
  }
  
  console.log('[TRANSFORM] Final full art URL:', fullArtUrl?.substring(0, 100));
  
  // Ensure move object exists with all required properties
  const move = cardDetails.move || { name: "Basic Attack", atk: "30" };
  
  // Force-use local placeholder for testing if the normal image is missing
  let normalImageUrl = response.nftImage;
  if (!normalImageUrl) {
    console.warn('[TRANSFORM] Missing nftImage in response, using placeholder');
    normalImageUrl = PLACEHOLDER_IMAGES.NORMAL;
  }
  
  console.log('[TRANSFORM] Using normal image URL:', normalImageUrl);
  
  // Format traits string - always use the provided tokenId (from URL) or the one in the response
  const displayTokenId = tokenId || response.tokenId || 'Unknown';
  const traitsString = response.nftTraits ? 
    `Azuki #${displayTokenId} - ${response.nftTraits.map(t => `${t.trait_type}: ${t.value}`).join(', ')}` :
    `Azuki #${displayTokenId}`;
  
  // Create the final card data
  const cardData = {
    cardName: cardDetails.cardName || "Unknown Card",
    hp: cardDetails.hp || "100 HP",
    type: cardDetails.typeIcon || "🔥",
    move: {
      name: move.name || "Basic Attack",
      damage: move.atk || "30"
    },
    weakness: cardDetails.weakness || "💧 x2",
    resistance: cardDetails.resistance || "🪨 -20",
    retreatCost: cardDetails.retreatCost || "🌟",
    rarity: cardDetails.rarity || "★",
    // Use original URLs, not proxy URLs (created later in components)
    normalImageUrl: normalImageUrl,
    // Only include fullArtImageUrl if it actually exists
    ...(fullArtUrl ? { fullArtImageUrl: fullArtUrl } : {}),
    // Include all image variants if available
    ...(response.allImageUrls && response.allImageUrls.length > 0 
      ? { allArtImageUrls: response.allImageUrls } 
      : response.temporary_image_urls && response.temporary_image_urls.length > 0
        ? { allArtImageUrls: response.temporary_image_urls }
        : {}),
    cardColor: response.cardColor || '#ff5722', // Default to fire color
    traits: traitsString
  };
  
  console.log('[TRANSFORM] Final card data:', cardData);
  
  return cardData;
}